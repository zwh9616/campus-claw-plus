"""Authenticated, fixed loopback liveness probe with a 500ms total budget."""
import base64
import os
import re
import socket
import sys
import time


def check(token):
    if not isinstance(token, str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}', token):
        return 1
    raw = base64.urlsafe_b64decode(token + '=')
    if len(raw) != 32 or base64.urlsafe_b64encode(raw).decode().rstrip('=') != token:
        return 1
    deadline = time.monotonic() + .5
    try:
        with socket.create_connection(('127.0.0.1', 8091), timeout=.5) as connection:
            connection.settimeout(max(.001, deadline - time.monotonic()))
            connection.sendall(('GET /health HTTP/1.1\r\nHost: document-parser\r\n'
                                'Authorization: Bearer ' + token + '\r\nConnection: close\r\n\r\n').encode('ascii'))
            response = bytearray()
            while True:
                connection.settimeout(max(.001, deadline - time.monotonic()))
                if time.monotonic() >= deadline:
                    return 1
                chunk = connection.recv(1024)
                if not chunk:
                    break
                response.extend(chunk)
                if len(response) > 8192:
                    return 1
            head, separator, body = bytes(response).partition(b'\r\n\r\n')
            if not separator or not head.startswith(b'HTTP/1.1 200 ') or body != b'{"status":"ok"}':
                return 1
            headers = {}
            for line in head.split(b'\r\n')[1:]:
                key, colon, value = line.partition(b':')
                if not colon or key.lower() in headers:
                    return 1
                headers[key.lower()] = value.strip()
            return 0 if headers.get(b'content-type') == b'application/json' and headers.get(b'content-length') == b'15' else 1
    except (OSError, ValueError):
        return 1


if __name__ == '__main__':
    sys.exit(check(os.environ.get('DOCUMENT_PARSER_TOKEN')) if len(sys.argv) == 1 else 1)
