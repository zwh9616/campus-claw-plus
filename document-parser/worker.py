"""Trusted child entrypoint; never accepts a user-controlled path through stdin."""
import json
import resource
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from core import MAX_INPUT, extract, failed


def main():
    resource.setrlimit(resource.RLIMIT_AS, (384 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CPU, (30, 31))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    try:
        result = extract(Path(sys.argv[2]).read_bytes()[:MAX_INPUT + 1], sys.argv[1])
    except MemoryError:
        result = failed('resource_limit')
    except Exception:
        # Paths, input content and exception text must not enter the protocol.
        result = failed('internal_failure')
    sys.stdout.write(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
    return 0 if result['status'] in ('ready', 'needs_ocr') else 1


if __name__ == '__main__':
    sys.exit(main())
