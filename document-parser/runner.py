"""Bounded one-document stdin CLI. This is not an activated backend service."""
import argparse
import json
import os
import selectors
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

MAX_INPUT = 10 * 1024 * 1024
MAX_PROTOCOL = 8 * 1024 * 1024
TIMEOUT = 30
REASONS = {'corrupt', 'encrypted', 'unsupported_content', 'resource_limit',
           'parse_timeout', 'worker_interrupted', 'internal_failure'}


def failed(reason):
    return {'status': 'failed', 'failure_reason': reason}


def run_child(command, timeout=TIMEOUT):
    """Internal boundary; the CLI cannot provide command or timeout arguments."""
    started = time.monotonic()
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                               stdin=subprocess.DEVNULL, start_new_session=True, close_fds=True)
    output = bytearray()
    try:
        with selectors.DefaultSelector() as selector:
            selector.register(process.stdout, selectors.EVENT_READ)
            while selector.get_map():
                remaining = timeout - (time.monotonic() - started)
                if remaining <= 0:
                    return failed('parse_timeout')
                for key, _ in selector.select(min(remaining, 0.1)):
                    chunk = os.read(key.fd, 65536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                    else:
                        output.extend(chunk)
                        if len(output) > MAX_PROTOCOL:
                            return failed('resource_limit')
            try:
                process.wait(timeout=max(0.001, timeout - (time.monotonic() - started)))
            except subprocess.TimeoutExpired:
                return failed('parse_timeout')
        if process.returncode in (-signal.SIGKILL, -signal.SIGXCPU):
            return failed('resource_limit')
        if process.returncode < 0:
            return failed('worker_interrupted')
        try:
            result = json.loads(output)
            status = result.get('status')
            if status not in ('ready', 'needs_ocr', 'failed'):
                return failed('internal_failure')
            if (status == 'failed') != (process.returncode != 0):
                return failed('internal_failure')
            if status == 'failed' and result.get('failure_reason') not in REASONS:
                return failed('internal_failure')
            return result
        except (ValueError, AttributeError):
            return failed('internal_failure')
    finally:
        # Reap the whole owned process group even if its leader exited while a
        # descendant kept stdout open. Never leave work behind after timeout.
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait()
        process.stdout.close()


def main():
    parser = argparse.ArgumentParser(description='Offline DI text extraction; binary stdin, JSON stdout')
    parser.add_argument('format', choices=('pdf', 'docx'))
    args = parser.parse_args()
    data = sys.stdin.buffer.read(MAX_INPUT + 1)
    if len(data) > MAX_INPUT:
        result = failed('resource_limit')
    elif not data:
        result = failed('corrupt')
    else:
        # Only this parent selects a path. No archive extraction, user paths,
        # URLs, filename metadata or environment configuration are accepted.
        with tempfile.TemporaryDirectory(prefix='di-') as directory:
            source = Path(directory) / 'source.bin'
            source.write_bytes(data)
            result = run_child([sys.executable, '-B', '-I', str(Path(__file__).with_name('worker.py')),
                                args.format, str(source)])
    sys.stdout.write(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    return 0 if result['status'] in ('ready', 'needs_ocr') else 1


if __name__ == '__main__':
    sys.exit(main())
