"""Reviewer-owned live socket probes. Child extraction is NOT exercised locally."""
import base64
import contextlib
import io
import json
import os
from pathlib import Path
import socket
import sys
import threading
import time
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path('document-parser').resolve()))
import server

mutate_auth = '--mutate-auth' in sys.argv
if mutate_auth:
    # Owned process memory only; tracked implementation stays byte-for-byte unchanged.
    server.hmac.compare_digest = lambda *_: True

token = base64.urlsafe_b64encode(os.urandom(32)).decode().rstrip('=')
logs = io.StringIO()

class ReviewerProtocol(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = server.ParserServer(('127.0.0.1', 0), token)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()

    def send(self, raw, close=True):
        with socket.create_connection(self.http.server_address, timeout=7) as c:
            c.sendall(raw)
            if close:
                c.shutdown(socket.SHUT_WR)
            data = bytearray()
            while True:
                try:
                    chunk = c.recv(65536)
                except ConnectionResetError:
                    break
                if not chunk:
                    break
                data.extend(chunk)
        head, body = data.split(b'\r\n\r\n', 1)
        headers = dict(line.decode().split(': ', 1) for line in head.split(b'\r\n')[1:])
        self.assertEqual(headers['Content-Length'], str(len(body)))
        self.assertEqual(headers['Connection'], 'close')
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertRegex(headers['X-Request-ID'], r'^[0-9a-f]{32}$')
        return int(head.split(b' ')[1]), json.loads(body)

    def auth(self, target='/health', method='GET', fields=b'', body=b''):
        return (f'{method} {target} HTTP/1.1\r\nHost: document-parser\r\nAuthorization: Bearer {token}\r\n'.encode()
                + fields + b'\r\n' + body)

    def test_unauthenticated_large_body_does_not_call_child(self):
        with patch.object(server, 'run_child', side_effect=AssertionError('must not invoke extraction')):
            started = time.monotonic()
            self.assertEqual(self.send(b'POST /v1/parse HTTP/1.1\r\nHost: document-parser\r\nContent-Length: 10485760\r\n\r\n', close=False),
                             (401, {'error': 'unauthenticated'}))
            self.assertLess(time.monotonic() - started, 1)
            self.assertEqual(self.send(self.auth()), (200, {'status': 'ok'}))

    def test_malformed_headers_lengths_and_controlled_paths(self):
        for fields, body in [(b'Content-Length: +1\r\n', b'x'), (b'Content-Length: 99999999999999\r\n', b''),
                             (b'Content-Length: 1\r\ncontent-length: 1\r\n', b'x'),
                             (b'Content-Length: 1\r\nContent-Type: application/pdf\r\nTransfer-Encoding: identity\r\n', b'x'),
                             (b'Content-Length: 2\r\nContent-Type: application/pdf\r\n', b'x'),
                             (b'Content-Length: 1\r\nContent-Type: application/pdf\r\n', b'xx'),
                             (b'X-Bad: a\x00b\r\n', b'')]:
            with self.subTest(fields=fields):
                self.assertEqual(self.send(self.auth('/v1/parse', 'POST', fields, body))[0], 400)
        self.assertEqual(self.send(self.auth('/health?private=do-not-log'))[0], 400)
        self.assertEqual(self.send(self.auth('/other/do-not-log'))[0], 404)
        self.assertEqual(self.send(self.auth('/health', 'POST'))[0], 405)

    def test_saturated_parser_retains_immediate_health_and_busy(self):
        self.http.parsing.acquire()
        try:
            started = time.monotonic()
            self.assertEqual(self.send(self.auth('/v1/parse', 'POST', b'Content-Type: application/pdf\r\nContent-Length: 10485760\r\n'), close=False),
                             (503, {'error': 'busy'}))
            self.assertEqual(self.send(self.auth()), (200, {'status': 'ok'}))
            self.assertLess(time.monotonic() - started, 1)
        finally:
            self.http.parsing.release()

    def test_read_deadlines_are_live_and_release_parse_lock(self):
        for data in [b'GET /health HTTP/1.1\r\n', self.auth('/v1/parse', 'POST', b'Content-Type: application/pdf\r\nContent-Length: 2\r\n', b'x')]:
            started = time.monotonic()
            self.assertEqual(self.send(data, close=False), (400, {'error': 'invalid_request'}))
            self.assertGreater(time.monotonic() - started, 4.5)
            self.assertLess(time.monotonic() - started, 6.5)
        self.assertTrue(self.http.parsing.acquire(blocking=False))
        self.http.parsing.release()

    def test_child_mapping_oversized_output_and_cleanup_with_explicit_doubles(self):
        # Protocol dispatch only: these doubles do not prove PDF/Word extraction or Linux sandboxing.
        raw = self.auth('/v1/parse', 'POST', b'Content-Type: application/pdf\r\nContent-Length: 1\r\n', b'x')
        before = set(Path(server.tempfile.gettempdir()).glob('di-rpc-*'))
        with patch.object(server, 'run_child', return_value={'status': 'ready', 'body': 'x' * server.MAX_PROTOCOL}):
            self.assertEqual(self.send(raw), (503, {'status': 'failed', 'failure_reason': 'internal_failure'}))
        with patch.object(server, 'run_child', return_value={'status': 'failed', 'failure_reason': 'parse_timeout'}):
            self.assertEqual(self.send(raw)[0], 504)
        self.assertEqual(set(Path(server.tempfile.gettempdir()).glob('di-rpc-*')), before)

with contextlib.redirect_stdout(logs):
    suite = (unittest.defaultTestLoader.loadTestsFromName('test_unauthenticated_large_body_does_not_call_child', ReviewerProtocol)
             if mutate_auth else unittest.defaultTestLoader.loadTestsFromTestCase(ReviewerProtocol))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
lines = [json.loads(line) for line in logs.getvalue().splitlines()]
safe = token not in logs.getvalue() and 'do-not-log' not in logs.getvalue() and all(set(line) == {'request_id', 'path', 'status', 'duration_ms'} for line in lines)
assert safe
print(json.dumps({'scope': 'Reviewer live local HTTP protocol only; explicit child doubles; no local extraction, container, SQL or sandbox claim',
                  'groups': result.testsRun, 'safe_logs': safe, 'requests': len(lines), 'exit_code': 0 if result.wasSuccessful() else 1}))
sys.exit(0 if result.wasSuccessful() else 1)
