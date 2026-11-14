"""DI-SC-14 real loopback HTTP and real bounded PDF/DOCX child in isolated image."""
import base64
import contextlib
import io
import json
import os
import socket
import sys
import threading
import time
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, '/app')
import server

TOKEN = base64.urlsafe_b64encode(os.urandom(32)).decode().rstrip('=')
CORPUS = Path('/tests/testdata/acceptance-v1')
RESULTS = {'scope': 'private adapter component only; no default Compose, DB or queue activation', 'documents': []}


class RpcTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = server.ParserServer(('127.0.0.1', 0), TOKEN)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()

    def raw(self, data):
        with socket.create_connection(self.http.server_address, timeout=7) as client:
            client.sendall(data)
            client.shutdown(socket.SHUT_WR)
            out = bytearray()
            while True:
                try:
                    chunk = client.recv(65536)
                except ConnectionResetError:
                    break
                if not chunk:
                    break
                out.extend(chunk)
        head, body = bytes(out).split(b'\r\n\r\n', 1)
        self.assertIn(b'Cache-Control: no-store', head)
        return int(head.split(b' ')[1]), json.loads(body)

    def request(self, method='GET', path='/health', data=b'', auth=True, mime='application/pdf'):
        headers = f'{method} {path} HTTP/1.1\r\nHost: document-parser\r\n'
        if auth:
            headers += 'Authorization: Bearer ' + TOKEN + '\r\n'
        if method == 'POST':
            headers += f'Content-Type: {mime}\r\nContent-Length: {len(data)}\r\n'
        return self.raw(headers.encode() + b'\r\n' + data)

    def test_token_startup_validation(self):
        self.assertEqual(len(server.validate_token(TOKEN)), 43)
        for value in [None, '', ' ' + TOKEN, TOKEN + '=', 'a' * 42, 'a' * 44, 'a' * 42 + 'B']:
            with self.subTest(shape=type(value).__name__), self.assertRaises(ValueError) as failure:
                server.validate_token(value)
            self.assertEqual(str(failure.exception), 'DOCUMENT_PARSER_TOKEN invalid')

    def test_health_and_auth_before_body(self):
        self.assertEqual(self.request(), (200, {'status': 'ok'}))
        self.assertEqual(self.request(auth=False), (401, {'error': 'unauthenticated'}))
        start = time.monotonic()
        self.assertEqual(self.raw(b'POST /v1/parse HTTP/1.1\r\nContent-Length: 10485760\r\n\r\n'),
                         (401, {'error': 'unauthenticated'}))
        self.assertLess(time.monotonic() - start, .5)
        self.assertEqual(self.request(path='/unknown'), (404, {'error': 'not_found'}))
        self.assertEqual(self.request(path='/v1/parse'), (405, {'error': 'method_not_allowed'}))
        self.assertEqual(self.request(path='/health?token=ignored'), (400, {'error': 'invalid_request'}))

    def test_header_and_body_framing(self):
        prefix = ('POST /v1/parse HTTP/1.1\r\nAuthorization: Bearer ' + TOKEN + '\r\n').encode()
        cases = [b'Content-Length: 1\r\nContent-Length: 1\r\n',
                 b'Authorization: Bearer duplicate\r\n', b'Transfer-Encoding: chunked\r\n',
                 b'Content-Length: 10485761\r\n', b'Content-Length: -1\r\n',
                 b'Content-Length: 01\r\n', b'Content-Length: 0\r\n',
                 b'Content-Length: 1\r\nContent-Type: text/plain\r\n',
                 b'Content-Length: 4\r\nContent-Type: application/pdf\r\n',
                 b'Content-Type: application/pdf\r\nContent-Type: application/pdf\r\n',
                 b'Invalid Header: x\r\n', b' folded: x\r\n', b'X-Test: ' + b'x' * 8200 + b'\r\n']
        for fields in cases:
            with self.subTest(index=cases.index(fields)):
                self.assertEqual(self.raw(prefix + fields + b'\r\nx'), (400, {'error': 'invalid_request'}))
        self.assertEqual(self.request(), (200, {'status': 'ok'}), 'Malformed requests must not poison later requests')

    def test_real_corpus_over_http(self):
        for case in json.loads((CORPUS / 'manifest.json').read_text())['cases']:
            data = (CORPUS / case['file']).read_bytes()
            mime = next(key for key, value in server.MIMES.items() if value == case['format'])
            status, result = self.request('POST', '/v1/parse', data, mime=mime)
            with self.subTest(file=case['file']):
                self.assertEqual(status, 200)
                self.assertEqual(result['status'], 'ready')
                self.assertTrue(result['body'])
                self.assertTrue(result['locations'])
                self.assertEqual(set(result), {'status', 'body', 'locations', 'source_page_count'})
            RESULTS['documents'].append({'file': case['file'], 'status': status, 'locations': len(result['locations'])})
        self.assertEqual(len(RESULTS['documents']), 40)
        self.assertEqual(list(Path('/tmp').glob('di-rpc-*')), [])

    def test_busy_is_immediate_health_stays_live(self):
        self.http.parsing.acquire()
        try:
            self.assertEqual(self.request('POST', '/v1/parse', b'bad'), (503, {'error': 'busy'}))
            self.assertEqual(self.request(), (200, {'status': 'ok'}))
        finally:
            self.http.parsing.release()
        self.assertEqual(self.request('POST', '/v1/parse', b'bad')[0], 422)

    def test_failure_mapping_over_http(self):
        self.assertEqual(self.request('POST', '/v1/parse', b'not a PDF')[0], 422)
        for reason, code in server.FAILURES.items():
            # Mapping injection is separate from the 40 actual extraction requests.
            with self.subTest(reason=reason), patch.object(server, 'run_child', return_value=server.failed(reason)):
                self.assertEqual(self.request('POST', '/v1/parse', b'fixture'), (code, server.failed(reason)))

    def test_absolute_read_budgets_and_extra_body(self):
        prefix = ('POST /v1/parse HTTP/1.1\r\nAuthorization: Bearer ' + TOKEN + '\r\n').encode()
        self.assertEqual(self.raw(prefix + b'Content-Type: application/pdf\r\nContent-Length: 1\r\n\r\nxx')[0], 400)
        self.assertEqual(self.raw(('GET /health HTTP/1.1\r\nAuthorization: Bearer ' + TOKEN + '\r\n\r\nx').encode())[0], 400)
        for message in [b'GET /health HTTP/1.1\r\n', prefix + b'Content-Type: application/pdf\r\nContent-Length: 2\r\n\r\nx']:
            with socket.create_connection(self.http.server_address, timeout=7) as client:
                started = time.monotonic()
                client.sendall(message)
                response = client.recv(8192)
                self.assertIn(b'HTTP/1.1 400 ', response)
                self.assertGreater(time.monotonic() - started, 4.5)
                self.assertLess(time.monotonic() - started, 6.5)


if __name__ == '__main__':
    logs = io.StringIO()
    with contextlib.redirect_stdout(logs):
        result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(RpcTests))
    log_lines = [json.loads(line) for line in logs.getvalue().splitlines()]
    safe_logs = TOKEN not in logs.getvalue() and all(set(line) == {'request_id', 'path', 'status', 'duration_ms'} for line in log_lines)
    RESULTS.update(groups=result.testsRun, safe_logs=safe_logs, exit_code=0 if result.wasSuccessful() and safe_logs else 1)
    print(json.dumps(RESULTS))
    sys.exit(RESULTS['exit_code'])
