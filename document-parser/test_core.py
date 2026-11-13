"""DI-SC-02..06/14. Run inside the real, restricted parser image.

Acceptance gold is read-only. Development/negative inputs below are authored
independently; no production code imports this file or a fixture manifest.
"""
import hashlib
import io
import json
import os
import random
import re
import resource
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unicodedata
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, '/app')
from runner import MAX_INPUT, MAX_PROTOCOL, run_child
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject, NumberObject

FIXTURES = Path('/tests/testdata/acceptance-v1')
RESULTS = {'acceptance': [], 'negative': [], 'boundaries': [], 'scope': 'offline parser core only'}
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
CT = b'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
REL = b'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
WS = re.compile('[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+')


def normalized(value):
    return WS.sub(' ', unicodedata.normalize('NFC', value)).strip(' ')


def distance(left, right):
    if left == right:
        return 0
    row = list(range(len(right) + 1))
    for i, a in enumerate(left, 1):
        next_row = [i]
        for j, b in enumerate(right, 1):
            next_row.append(min(next_row[-1] + 1, row[j] + 1, row[j - 1] + (a != b)))
        row = next_row
    return row[-1]


def parse(data, format='pdf'):
    started = time.monotonic()
    process = subprocess.run([sys.executable, '-B', '-I', '/app/runner.py', format], input=data,
                             capture_output=True, timeout=35)
    result = json.loads(process.stdout)
    assert process.stderr == b'', 'untrusted document leaked diagnostic output'
    assert process.returncode == (1 if result['status'] == 'failed' else 0)
    assert time.monotonic() - started <= 31, '30s document budget exceeded'
    result['_ms'] = round((time.monotonic() - started) * 1000)
    return result


def pdf(pages=1, image_pages=(), content=None, encrypted=False, unused_image_pages=(), form_image=False):
    writer = PdfWriter()
    for index in range(pages):
        page = writer.add_blank_page(width=300, height=300)
        if index in image_pages or index in unused_image_pages:
            image = DecodedStreamObject()
            image.set_data(b'\x80')
            image.update({NameObject('/Type'): NameObject('/XObject'), NameObject('/Subtype'): NameObject('/Image'),
                          NameObject('/Width'): NumberObject(1), NameObject('/Height'): NumberObject(1),
                          NameObject('/ColorSpace'): NameObject('/DeviceGray'), NameObject('/BitsPerComponent'): NumberObject(8)})
            page[NameObject('/Resources')] = DictionaryObject({NameObject('/XObject'): DictionaryObject({NameObject('/Im'): writer._add_object(image)})})
            stream = DecodedStreamObject()
            stream.set_data(b'q Q' if index in unused_image_pages else b'q 200 0 0 200 0 0 cm /Im Do Q')
            if form_image:
                stream[NameObject('/Type')] = NameObject('/XObject')
                stream[NameObject('/Subtype')] = NameObject('/Form')
                stream[NameObject('/Resources')] = page['/Resources']
                page[NameObject('/Resources')] = DictionaryObject({NameObject('/XObject'): DictionaryObject({NameObject('/Fm'): writer._add_object(stream)})})
                outer = DecodedStreamObject()
                outer.set_data(b'q /Fm Do Q')
                stream = outer
            page[NameObject('/Contents')] = writer._add_object(stream)
        elif content is not None and index == 0:
            font = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
            page[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): writer._add_object(font)})})
            stream = DecodedStreamObject()
            stream.set_data(content)
            page[NameObject('/Contents')] = writer._add_object(stream.flate_encode())
    if encrypted:
        writer.encrypt('fixture-password')
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def docx(body='<w:p><w:r><w:t>Development source</w:t></w:r></w:p>', extra=(), types=CT, relationships=REL, raw_xml=None):
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, value in [('[Content_Types].xml', types), ('_rels/.rels', relationships),
                            ('word/document.xml', raw_xml or f'<w:document xmlns:w="{W}"><w:body>{body}</w:body></w:document>'.encode()), *extra]:
            archive.writestr(name, value)
    return out.getvalue()


def encrypted_zip(data):
    # Set genuine ZIP general-purpose encryption flags in local and central
    # headers; Python then refuses to read without a password. No bogus suffix.
    value = bytearray(data)
    for marker, offset in ((b'PK\x03\x04', 6), (b'PK\x01\x02', 8)):
        start = 0
        while (start := value.find(marker, start)) >= 0:
            value[start + offset] |= 1
            start += 4
    return bytes(value)


class ParserTests(unittest.TestCase):
    def assert_negative(self, id, data=None, format='pdf', result=None):
        expected = next(c for c in json.loads((FIXTURES / 'negative-cases.json').read_text())['cases'] if c['id'] == id)
        actual = result if result is not None else parse(data, format)
        self.assertEqual(actual['status'], expected['expected'], id)
        self.assertEqual(actual.get('failure_reason'), expected['reason'], id)
        self.assertNotIn('body', actual, 'failure/needs_ocr must not expose partial text')
        self.assertNotIn('locations', actual)
        RESULTS['negative'].append({'id': id, 'status': actual['status'], 'reason': actual.get('failure_reason'), 'ms': actual.get('_ms')})

    def test_01_frozen_acceptance_quality_and_locations(self):
        manifest = json.loads((FIXTURES / 'manifest.json').read_text())
        self.assertTrue(manifest['frozen_before_parser_implementation'])
        self.assertEqual(len(manifest['cases']), 40)
        for case in manifest['cases']:
            with self.subTest(file=case['file']):
                data = (FIXTURES / case['file']).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), case['sha256'])
                self.assertEqual(len(data), case['bytes'])
                result = parse(data, case['format'])
                self.assertEqual(result['status'], 'ready')
                gold = normalized('\n\n'.join(b['text'] for b in case['gold']))
                body = normalized(result['body'])
                cer = distance(gold, body) / len(gold)
                self.assertLessEqual(cer, .005, case['file'])
                self.assertEqual(len(result['locations']), len(case['gold']))
                for location, block in zip(result['locations'], case['gold'], strict=True):
                    self.assertEqual((location['kind'], location['unit']), (block['kind'], block['unit']))
                    self.assertGreater(location['char_end'], location['char_start'])
                    quote = result['body'][location['char_start']:location['char_end']]
                    self.assertEqual(normalized(quote), normalized(block['text']))
                critical = re.findall(r'验收关键句[^。]+。', gold)
                self.assertTrue(critical)
                self.assertTrue(all(sentence in body for sentence in critical))
                if case['format'] == 'docx':
                    self.assertIsNone(result['source_page_count'])
                else:
                    self.assertEqual(result['source_page_count'], len(case['gold']))
                RESULTS['acceptance'].append({'file': case['file'], 'cer': cer, 'gold_codepoints': len(gold),
                    'locations': len(case['gold']), 'critical_phrases': len(critical), 'ms': result['_ms']})

    def test_02_pdf_failures_and_scan_states(self):
        for id, data in [('empty', b''), ('wrong-signature', b'not a PDF'), ('truncated-pdf', b'%PDF-1.7\n%%EOF'),
                         ('encrypted-pdf', pdf(encrypted=True)), ('scan-only-pdf', pdf(image_pages=(0,))),
                         ('mixed-text-scan-pdf', pdf(pages=2, image_pages=(1,), content=b'BT /F1 12 Tf (secret partial source) Tj ET')),
                         ('blank-pdf', pdf()), ('pdf-page-over-limit', pdf(pages=201)),
                         ('pdf-content-over-limit', pdf(content=b' ' * (32 * 1024 * 1024 + 1)))]:
            with self.subTest(id=id):
                self.assert_negative(id, data)

    def test_03_input_and_page_boundaries(self):
        aes = Path('/tests/testdata/development/aes-empty-password.pdf').read_bytes()
        manifest = json.loads(Path('/tests/testdata/development/manifest.json').read_text())
        self.assertEqual(hashlib.sha256(aes).hexdigest(), manifest['sha256'])
        encrypted = parse(aes)
        self.assertEqual((encrypted['status'], encrypted['failure_reason']), ('failed', 'encrypted'))
        source = pdf(content=b'BT /F1 12 Tf (boundary) Tj ET')
        for size in (MAX_INPUT - 1, MAX_INPUT):
            self.assertEqual(parse(source + b' ' * (size - len(source)))['status'], 'ready')
            RESULTS['boundaries'].append({'input_bytes': size, 'status': 'ready'})
        self.assert_negative('input-over-limit', source + b' ' * (MAX_INPUT + 1 - len(source)))
        result = parse(pdf(pages=200, content=b'BT /F1 12 Tf (page one) Tj ET'))
        self.assertEqual(result['status'], 'ready')
        self.assertEqual(result['source_page_count'], 200)
        RESULTS['boundaries'].append({'pdf_pages': 200, 'status': 'ready'})
        shared = parse(pdf(pages=2, unused_image_pages=(1,), content=b'BT /F1 12 Tf (source) Tj ET'))
        self.assertEqual(shared['status'], 'ready', 'unused shared images do not make a blank page a scan')
        self.assertEqual(shared['source_page_count'], 2)
        form = parse(pdf(image_pages=(0,), form_image=True))
        self.assertEqual(form['status'], 'needs_ocr', 'painted image inside a Form must be detected')

    def test_04_zip_security(self):
        negatives = [('zip-traversal', docx(extra=[('../escape', b'never write')])),
                     ('zip-entry-over-limit', docx(extra=[(f'parts/{n}', b'x') for n in range(1998)])),
                     ('zip-ratio-bomb', docx(extra=[('bomb.xml', b'x' * (1024 * 1024))])),
                     ('zip-encrypted', encrypted_zip(docx())),
                     ('macro-word', docx(types=CT.replace(b'wordprocessingml.document.main', b'ms-word.document.macroEnabled.main'))),
                     ('legacy-word', bytes.fromhex('d0cf11e0a1b11ae1') + b'legacy doc')]
        # Duplicate names are intentionally produced only in this test fixture.
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', UserWarning)
            negatives.append(('zip-duplicate', docx(extra=[('word/document.xml', b'duplicate')])))
        for id, data in negatives:
            with self.subTest(id=id):
                self.assert_negative(id, data, 'docx')
        rng = random.Random(20261113)
        # ~33MiB expanded, ~8MiB compressed, ratio far below 100; tests total
        # expansion independently of both the input and compression-ratio caps.
        expanded = b''.join((block := rng.randbytes(4096)) * 4 for _ in range(2113))
        oversized = docx(extra=[('expanded.xml', expanded)])
        self.assertLess(len(oversized), MAX_INPUT)
        self.assert_negative('zip-expanded-over-limit', oversized, 'docx')

    def test_05_xml_security(self):
        for encoding in ('utf-8', 'utf-16'):
            evil = f'<?xml version="1.0" encoding="{encoding}"?><!DOCTYPE w:document [<!ENTITY stolen SYSTEM "http://example.invalid/private">]><w:document xmlns:w="{W}"><w:body><w:p><w:r><w:t>&stolen;</w:t></w:r></w:p></w:body></w:document>'
            result = parse(docx(raw_xml=evil.encode(encoding)), 'docx')
            if encoding == 'utf-8':
                self.assert_negative('xml-dtd-entity', result=result)
            else:
                self.assertEqual((result['status'], result['failure_reason']), ('failed', 'unsupported_content'))
        relationship = REL.replace(b'</Relationships>', b'<Relationship Id="evil" Type="hyperlink" TargetMode="External" Target="http://example.invalid/private"/></Relationships>')
        self.assert_negative('external-relationship', docx(relationships=relationship), 'docx')

    def test_06_docx_body_and_block_limits(self):
        rng = random.Random(42)
        # Low compression ratio, ASCII output >2MiB while ZIP/input remain safe.
        large = rng.randbytes(1600000).hex()
        self.assert_negative('output-over-limit', docx(body=f'<w:p><w:r><w:t>{large}</w:t></w:r></w:p>'), 'docx')
        self.assert_negative('docx-block-over-limit', docx(body='<w:p/>' * 20001), 'docx')
        for count in (19999, 20000):
            # Repetitive XML itself violates the independent ratio cap unless
            # stored; boundary fixture is rewritten with ZIP_STORED below.
            data = docx(body='<w:p/>' * (count - 1) + '<w:p><w:r><w:t>final</w:t></w:r></w:p>')
            stored = io.BytesIO()
            with zipfile.ZipFile(io.BytesIO(data)) as old, zipfile.ZipFile(stored, 'w') as new:
                for item in old.infolist():
                    new.writestr(item.filename, old.read(item.filename))
            result = parse(stored.getvalue(), 'docx')
            self.assertEqual(result['status'], 'ready')
            self.assertEqual(result['locations'][0]['unit'], count)
            RESULTS['boundaries'].append({'docx_units': count, 'status': 'ready'})

    def test_07_runner_real_child_resource_failures(self):
        # Real subprocess kill/wait, not a mocked timer or return value. The
        # production CLI never accepts these commands or altered timeouts.
        timed = run_child([sys.executable, '-c', 'import time;time.sleep(20)'], timeout=.2)
        self.assert_negative('child-timeout', result=timed)
        with tempfile.TemporaryDirectory(prefix='test-descendant-') as directory:
            pidfile = Path(directory) / 'child.pid'
            script = 'import subprocess,sys;from pathlib import Path;p=subprocess.Popen([sys.executable,"-c","import time;time.sleep(20)"]);Path(sys.argv[1]).write_text(str(p.pid))'
            self.assertEqual(run_child([sys.executable, '-c', script, str(pidfile)], timeout=.3)['failure_reason'], 'parse_timeout')
            pid = int(pidfile.read_text())
            # An exited descendant may briefly remain a zombie under the test
            # container's PID1. It must no longer execute or retain the pipe.
            for _ in range(20):
                stat = Path(f'/proc/{pid}/stat')
                if not stat.exists() or stat.read_text().split()[2] == 'Z':
                    break
                time.sleep(.01)
            else:
                self.fail('timed-out descendant remained alive')
        memory = 'import sys;sys.path.insert(0,"/app");import worker;worker.extract=lambda *args: bytearray(448*1024*1024);sys.argv=["worker.py","pdf","/tests/testdata/acceptance-v1/clear-01.pdf"];sys.exit(worker.main())'
        self.assert_negative('child-memory-limit', result=run_child([sys.executable, '-c', memory]))
        killed = run_child([sys.executable, '-c', 'import os,signal;os.kill(os.getpid(),signal.SIGTERM)'])
        self.assert_negative('child-interrupted', result=killed)
        for command in ([sys.executable, '-c', 'print("not json")'],
                        [sys.executable, '-c', 'print("{\\"status\\":\\"ready\\"}");raise SystemExit(1)']):
            self.assertEqual(run_child(command)['failure_reason'], 'internal_failure')
        too_large = run_child([sys.executable, '-c', f'import sys;sys.stdout.write("x"*{MAX_PROTOCOL + 1})'])
        self.assertEqual(too_large['failure_reason'], 'resource_limit')
        self.assertEqual(len(list(Path('/tmp').glob('di-*'))), 0, 'temporary source remained')

    def test_08_container_isolation(self):
        import importlib.util
        self.assertEqual(os.getuid(), 65532)
        self.assertIsNone(importlib.util.find_spec('pip'), 'Runtime must not carry the unused package installer')
        self.assertIsNone(importlib.util.find_spec('ensurepip'))
        self.assertFalse(Path('/app/test_core.py').exists(), 'tests must not ship inside runtime image')
        self.assertFalse(any('MYSQL' in k or 'TOKEN' in k or 'PASSWORD' in k for k in os.environ))
        with self.assertRaises(OSError):
            Path('/app/untrusted-write').write_text('denied')
        # Docker network=none provides only loopback. An untrusted URL cannot
        # leave the container even if a future parser regression attempted it.
        with socket.socket() as connection:
            connection.settimeout(.2)
            with self.assertRaises(OSError):
                connection.connect(('192.0.2.1', 80))
        RESULTS['isolation'] = {'uid': os.getuid(), 'read_only_root': True, 'external_connect_denied': True,
                                'tmp_sources_after_tests': len(list(Path('/tmp').glob('di-*')))}


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ParserTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    expected = {c['id'] for c in json.loads((FIXTURES / 'negative-cases.json').read_text())['cases']}
    actual = {c['id'] for c in RESULTS['negative']}
    RESULTS['unexecuted_negative'] = sorted(expected - actual)
    RESULTS['groups'] = result.testsRun
    RESULTS['exit_code'] = 0 if result.wasSuccessful() and not expected - actual else 1
    RESULTS['peak_test_process_rss_kib'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    print(json.dumps(RESULTS, ensure_ascii=False))
    sys.exit(RESULTS['exit_code'])
