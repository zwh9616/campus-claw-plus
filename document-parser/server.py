"""DI-SC-14 private HTTP adapter; explicitly launched, not in default Compose."""
import base64
import hmac
import json
import os
import re
import socket
import socketserver
import sys
import tempfile
import threading
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from runner import MAX_INPUT, MAX_PROTOCOL, failed, run_child

MIMES = {'application/pdf': 'pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'}
FAILURES = {'corrupt': 422, 'encrypted': 422, 'unsupported_content': 422,
            'resource_limit': 422, 'parse_timeout': 504,
            'worker_interrupted': 503, 'internal_failure': 503}


def validate_token(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}', value):
        raise ValueError('DOCUMENT_PARSER_TOKEN invalid')
    raw = base64.urlsafe_b64decode(value + '=')
    if len(raw) != 32 or base64.urlsafe_b64encode(raw).decode().rstrip('=') != value:
        raise ValueError('DOCUMENT_PARSER_TOKEN invalid')
    return value.encode('ascii')


class InvalidRequest(Exception):
    pass


class ParserServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = False

    def __init__(self, address, token):
        self.token = validate_token(token)
        self.parsing = threading.Lock()
        self.connections = threading.BoundedSemaphore(16)
        super().__init__(address, Handler)

    def process_request(self, request, address):
        if not self.connections.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, address)
        except BaseException:
            self.connections.release()
            raise

    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.connections.release()

    def handle_error(self, request, client_address):
        # No raw request, exception, path, content or configuration in logs.
        pass


class Handler(socketserver.BaseRequestHandler):
    def reject_buffered_extra(self):
        # Connection: close forbids pipelining. Reject extra bytes already
        # present rather than accidentally accepting a second message/body.
        self.request.setblocking(False)
        try:
            if self.request.recv(1, socket.MSG_PEEK):
                raise InvalidRequest()
        except BlockingIOError:
            pass

    def recv(self, count, deadline):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise InvalidRequest()
        self.request.settimeout(remaining)
        value = self.request.recv(count)
        if not value:
            raise InvalidRequest()
        return value

    def request_data(self, started):
        header = bytearray()
        while not header.endswith(b'\r\n\r\n'):
            if len(header) >= 8192:
                raise InvalidRequest()
            header.extend(self.recv(1, started + 5))
        try:
            lines = header.decode('ascii').split('\r\n')
        except UnicodeDecodeError:
            raise InvalidRequest() from None
        parts = lines[0].split(' ')
        if len(parts) != 3 or parts[2] != 'HTTP/1.1':
            raise InvalidRequest()
        method, target, _ = parts
        headers = {}
        for line in lines[1:-2]:
            if ':' not in line:
                raise InvalidRequest()
            key, value = line.split(':', 1)
            if not re.fullmatch(r"[!#$%&'*+.^_`|~0-9A-Za-z-]+", key):
                raise InvalidRequest()
            key, value = key.lower(), value.strip(' \t')
            if key in headers or any(ord(c) < 32 or ord(c) == 127 for c in value):
                raise InvalidRequest()
            headers[key] = value
        if 'transfer-encoding' in headers:
            raise InvalidRequest()
        return method, target, headers

    def dispatch(self, started):
        method, target, headers = self.request_data(started)
        self.path = target if target in ('/health', '/v1/parse') else 'unknown'
        authorization = headers.get('authorization', '').encode('ascii')
        if not hmac.compare_digest(authorization, b'Bearer ' + self.server.token):
            return 401, {'error': 'unauthenticated'}
        if '?' in target or '#' in target:
            raise InvalidRequest()
        if target not in ('/health', '/v1/parse'):
            return 404, {'error': 'not_found'}
        if method != ('GET' if target == '/health' else 'POST'):
            return 405, {'error': 'method_not_allowed'}
        if target == '/health':
            if headers.get('content-length', '0') != '0':
                raise InvalidRequest()
            self.reject_buffered_extra()
            return 200, {'status': 'ok'}
        size = headers.get('content-length', '')
        if not re.fullmatch(r'[1-9][0-9]{0,7}', size) or int(size) > MAX_INPUT:
            raise InvalidRequest()
        format_ = MIMES.get(headers.get('content-type'))
        if format_ is None:
            raise InvalidRequest()
        if not self.server.parsing.acquire(blocking=False):
            return 503, {'error': 'busy'}
        try:
            data = bytearray()
            body_deadline = min(started + 35, time.monotonic() + 5)
            while len(data) < int(size):
                data.extend(self.recv(min(65536, int(size) - len(data)), body_deadline))
            self.reject_buffered_extra()
            with tempfile.TemporaryDirectory(prefix='di-rpc-') as directory:
                source = Path(directory) / 'source.bin'
                source.write_bytes(data)
                result = run_child([sys.executable, '-B', '-I', str(Path(__file__).with_name('worker.py')),
                                    format_, str(source)], timeout=min(30, max(.001, started + 35 - time.monotonic())))
            status = result.get('status')
            if status in ('ready', 'needs_ocr'):
                return 200, result
            if status == 'failed' and result.get('failure_reason') in FAILURES:
                return FAILURES[result['failure_reason']], result
            return 503, failed('internal_failure')
        finally:
            self.server.parsing.release()

    def handle(self):
        started, request_id = time.monotonic(), uuid.uuid4().hex
        self.path, status = 'unknown', 400
        try:
            try:
                status, payload = self.dispatch(started)
            except (InvalidRequest, TimeoutError, ConnectionError):
                status, payload = 400, {'error': 'invalid_request'}
            except Exception:
                status, payload = 503, failed('internal_failure')
            body = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
            if len(body) > MAX_PROTOCOL:
                status, body = 503, b'{"status":"failed","failure_reason":"internal_failure"}'
            self.request.settimeout(max(.001, min(2, started + 35 - time.monotonic())))
            response = (f'HTTP/1.1 {status} Response\r\nContent-Type: application/json\r\n'
                        f'Content-Length: {len(body)}\r\nConnection: close\r\nCache-Control: no-store\r\n'
                        f'X-Request-ID: {request_id}\r\n\r\n').encode('ascii')
            self.request.sendall(response + body)
        except OSError:
            pass
        finally:
            print(json.dumps({'request_id': request_id, 'path': self.path, 'status': status,
                              'duration_ms': round((time.monotonic() - started) * 1000)}), flush=True)


def main():
    try:
        token = os.environ.get('DOCUMENT_PARSER_TOKEN')
        validate_token(token)
        with ParserServer(('0.0.0.0', 8091), token) as server:
            server.serve_forever(poll_interval=.2)
    except (ValueError, OSError):
        print('Parser startup failed: validate token and private listener', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
