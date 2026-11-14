"""DI-SC-14 actual fixed-port authenticated probe and startup processes."""
import base64
import contextlib
import importlib.util
import io
import json
import os
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


server = load('private_server', '/app/server.py')
health = load('private_health', '/app/health.py')
token = base64.urlsafe_b64encode(os.urandom(32)).decode().rstrip('=')
logs = io.StringIO()
groups = 0
with contextlib.redirect_stdout(logs):
    with server.ParserServer(('127.0.0.1', 8091), token) as actual:
        thread = threading.Thread(target=actual.serve_forever, kwargs={'poll_interval': .02}, daemon=True)
        thread.start()
        try:
            assert health.check(token) == 0
            assert health.check(base64.urlsafe_b64encode(bytes(32)).decode().rstrip('=')) == 1
            actual.parsing.acquire()
            try:
                assert health.check(token) == 0, 'busy parser is still alive'
            finally:
                actual.parsing.release()
            groups += 1
        finally:
            actual.shutdown()
            thread.join(1)
    # A real slow/malformed listener cannot consume more than the total budget.
    for response in [b'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{"status":"no"}', None]:
        with socket.socket() as listener:
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            listener.bind(('127.0.0.1', 8091)); listener.listen(1)
            def reply():
                connection, _ = listener.accept()
                with connection:
                    connection.recv(8192)
                    if response is None:
                        time.sleep(.7)
                    else:
                        connection.sendall(response)
            thread = threading.Thread(target=reply, daemon=True); thread.start()
            started = time.monotonic()
            assert health.check(token) == 1
            assert time.monotonic() - started < .65
            thread.join(1)
    groups += 1
    # No listener remains: removing argument rejection would hang and fail,
    # rather than being accidentally rejected just because the port is busy.
    for value, args in [(None, []), ('sentinel-private-value', []), (token, ['--unexpected'])]:
        environment = {k: v for k, v in os.environ.items() if k != 'DOCUMENT_PARSER_TOKEN'}
        if value is not None:
            environment['DOCUMENT_PARSER_TOKEN'] = value
        child = subprocess.run([sys.executable, '-B', '-I', '/app/server.py', *args], env=environment,
                               capture_output=True, timeout=2, check=False)
        assert child.returncode != 0 and not child.stdout
        record = json.loads(child.stderr)
        assert record['module'] == 'document_parser' and record['request_id'] is None
        if value:
            assert value.encode() not in child.stderr
    groups += 1
assert token not in logs.getvalue()
for line in logs.getvalue().splitlines():
    record = json.loads(line)
    assert set(record) == {'request_id', 'path', 'status', 'duration_ms'}
print(json.dumps({'exit_code': 0, 'groups': groups, 'safe_logs': True,
                  'scope': 'actual fixed loopback probe, busy liveness, total timeout and bad startup processes'}))
