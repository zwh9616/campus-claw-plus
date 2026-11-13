"""DI-SC-03..06: bounded, offline extraction. No HTTP, DB, URL or OCR adapter."""
import io
import logging
import posixpath
import re
import unicodedata
import zipfile
from xml.etree import ElementTree as ET

from pypdf import PdfReader
from pypdf.errors import DependencyError, PdfReadError, PdfStreamError
from pypdf.generic import ContentStream

MAX_INPUT = 10 * 1024 * 1024
MAX_EXPANDED = 32 * 1024 * 1024
MAX_BODY = 2 * 1024 * 1024
MAX_PAGES = 200
MAX_ENTRIES = 2000
MAX_BLOCKS = 20000
MAX_RATIO = 100
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
CT = '{http://schemas.openxmlformats.org/package/2006/content-types}'
REL = '{http://schemas.openxmlformats.org/package/2006/relationships}'
WORD_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'

# Third-party warnings may contain attacker-controlled source strings/paths.
logging.getLogger('pypdf').addHandler(logging.NullHandler())
logging.getLogger('pypdf').propagate = False
logging.getLogger('pypdf').setLevel(logging.CRITICAL + 1)


class Rejected(Exception):
    def __init__(self, reason):
        self.reason = reason


def failed(reason):
    return {'status': 'failed', 'failure_reason': reason}


class Text:
    def __init__(self):
        self.parts = []
        self.locations = []
        self.chars = 0
        self.bytes = 0
        self.first = True

    def add(self, kind, unit, value):
        value = value.replace('\r\n', '\n').replace('\r', '\n')
        if self.first:
            value = value.removeprefix('\ufeff')
        if any(unicodedata.category(c) in ('Cc', 'Cs') and c not in '\t\n' for c in value):
            raise Rejected('unsupported_content')
        if not value.strip():
            return
        self.first = False
        separator = '\n\n' if self.parts else ''
        self.bytes += len((separator + value).encode('utf-8'))
        if self.bytes > MAX_BODY:
            raise Rejected('resource_limit')
        self.chars += len(separator)
        start = self.chars
        self.parts.append(separator + value)
        self.chars += len(value)
        self.locations.append({'kind': kind, 'unit': unit, 'char_start': start, 'char_end': self.chars})

    def finish(self, page_count):
        if not self.parts:
            raise Rejected('unsupported_content')
        return {'status': 'ready', 'body': ''.join(self.parts), 'locations': self.locations,
                'source_page_count': page_count}


def pdf(data):
    if not data.startswith(b'%PDF-') or not data.rstrip().endswith(b'%%EOF'):
        raise Rejected('corrupt')
    try:
        reader = PdfReader(io.BytesIO(data), strict=True)
    except DependencyError:
        # PdfReader tries the empty password while opening AES files. Reject
        # encryption consistently without installing/executing optional crypto.
        raise Rejected('encrypted') from None
    if reader.is_encrypted:
        raise Rejected('encrypted')
    count = len(reader.pages)
    if count > MAX_PAGES:
        raise Rejected('resource_limit')
    text = Text()
    expanded = 0
    seen_streams = set()

    def inspect_stream(stream):
        nonlocal expanded
        stream = stream.get_object()
        key = id(stream)
        if key not in seen_streams:
            seen_streams.add(key)
            decoded = stream.get_data()
            expanded += len(decoded)
            if expanded > MAX_EXPANDED:
                raise Rejected('resource_limit')
        return stream

    def uses_images(contents, resources, depth=0, ancestors=frozenset()):
        if contents is None:
            return False
        if depth > 32:
            raise Rejected('resource_limit')
        resources = resources.get_object() if hasattr(resources, 'get_object') else resources
        objects = resources.get('/XObject', {})
        objects = objects.get_object() if hasattr(objects, 'get_object') else objects
        found = False
        for operands, operator in ContentStream(contents, reader).operations:
            if operator == b'INLINE IMAGE':
                found = True
                continue
            if operator != b'Do':
                continue
            if len(operands) != 1 or operands[0] not in objects:
                raise Rejected('corrupt')
            reference = objects[operands[0]]
            obj = reference.get_object()
            if id(obj) in ancestors:
                raise Rejected('corrupt')
            if obj.get('/Subtype') == '/Image':
                found = True  # Never decompress image pixels in phase A.
            elif obj.get('/Subtype') == '/Form':
                inspect_stream(obj)
                child_resources = obj.get('/Resources', resources)
                found = uses_images(obj, child_resources, depth + 1, ancestors | {id(obj)}) or found
        return found

    needs_ocr = False
    for index, page in enumerate(reader.pages, 1):
        contents = page.get('/Contents')
        if contents is not None:
            contents = contents.get_object()
            for stream in contents if isinstance(contents, list) else [contents]:
                inspect_stream(stream)
        # Only actually painted images count. Shared but unused resources on a
        # blank page must not turn an otherwise text-layer PDF into needs_ocr.
        images = uses_images(contents, page.get('/Resources', {}))
        value = page.extract_text(extraction_mode='plain')
        if not value.strip() and images:
            needs_ocr = True
        text.add('pdf_page', index, value)
    if needs_ocr:
        return {'status': 'needs_ocr', 'source_page_count': count}
    return text.finish(count)


def xml(data):
    # Restrict supported XML encodings before parsing: declarations/entities are
    # rejected even in UTF-16. No external resolver is installed or invoked.
    try:
        value = data.decode('utf-16' if data.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')
    except UnicodeError:
        raise Rejected('corrupt') from None
    if '\x00' in value:
        raise Rejected('corrupt')
    if '<!DOCTYPE' in value.upper() or '<!ENTITY' in value.upper():
        raise Rejected('unsupported_content')
    return ET.fromstring(value)


def docx(data):
    if not data.startswith(b'PK\x03\x04'):
        raise Rejected('corrupt')
    text = Text()
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if len(entries) > MAX_ENTRIES:
            raise Rejected('resource_limit')
        names = set()
        expanded = compressed = 0
        for entry in entries:
            name = entry.filename
            if (not name or '\\' in name or name.startswith('/') or ':' in name or
                    '..' in name.split('/') or name in names or '\x00' in entry.orig_filename):
                raise Rejected('corrupt')
            names.add(name)
            if entry.flag_bits & 1:
                raise Rejected('encrypted')
            if entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED):
                raise Rejected('unsupported_content')
            expanded += entry.file_size
            compressed += entry.compress_size
            if entry.file_size > MAX_EXPANDED or entry.file_size > max(1, entry.compress_size) * MAX_RATIO:
                raise Rejected('resource_limit')
            if expanded > MAX_EXPANDED or expanded > max(1, compressed) * MAX_RATIO:
                raise Rejected('resource_limit')
            if name.lower().endswith(('.bin', '.docm')) or 'vbaproject' in name.lower():
                raise Rejected('unsupported_content')
        if not {'[Content_Types].xml', '_rels/.rels', 'word/document.xml'} <= names:
            raise Rejected('corrupt')

        def read(name):
            with archive.open(name) as source:
                value = source.read(MAX_EXPANDED + 1)
                if len(value) > MAX_EXPANDED:
                    raise Rejected('resource_limit')
                return value

        types = xml(read('[Content_Types].xml'))
        if types.tag != CT + 'Types':
            raise Rejected('corrupt')
        main_types = [e.get('ContentType') for e in types if e.tag == CT + 'Override' and e.get('PartName') == '/word/document.xml']
        if main_types != [WORD_TYPE]:
            raise Rejected('unsupported_content')
        main_targets = []
        # Parse every relationship part. Never resolve a link or unpack to disk.
        for name in sorted(names):
            if name.endswith('.rels'):
                relationships = xml(read(name))
                if relationships.tag != REL + 'Relationships':
                    raise Rejected('corrupt')
                for relation in relationships:
                    target = relation.get('Target', '')
                    if (relation.get('TargetMode', 'Internal') != 'Internal' or
                            re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', target) or target.startswith(('//', '\\'))):
                        raise Rejected('unsupported_content')
                    normalized = posixpath.normpath(posixpath.join(posixpath.dirname(name).removesuffix('_rels'), target))
                    if normalized.startswith('../') or '\\' in target:
                        raise Rejected('corrupt')
                    if name == '_rels/.rels' and relation.get('Type', '').endswith('/officeDocument'):
                        main_targets.append(target)
        if main_targets != ['word/document.xml']:
            raise Rejected('unsupported_content')
        document = xml(read('word/document.xml'))
        body = document.find(W + 'body')
        if document.tag != W + 'document' or body is None:
            raise Rejected('corrupt')
        unsupported = {W + n for n in ('altChunk', 'object', 'pict', 'drawing', 'subDoc', 'txbxContent')}
        if any(e.tag in unsupported for e in body.iter()):
            raise Rejected('unsupported_content')
        unit = 0

        def visible(element):
            if element.tag in {W + 'del', W + 'instrText'}:
                return ''
            if element.tag == W + 't':
                return element.text or ''
            if element.tag == W + 'tab':
                return '\t'
            if element.tag in {W + 'br', W + 'cr'}:
                return '\n'
            return ''.join(visible(child) for child in element)

        def walk(element, in_cell=False):
            nonlocal unit
            if element.tag == W + 'del':
                return
            in_cell = in_cell or element.tag == W + 'tc'
            if element.tag == W + 'p':
                unit += 1
                if unit > MAX_BLOCKS:
                    raise Rejected('resource_limit')
                text.add('docx_table_cell' if in_cell else 'docx_paragraph', unit, visible(element))
                return
            for child in element:
                walk(child, in_cell)

        walk(body)
    return text.finish(None)


def extract(data, format):
    try:
        if not data:
            raise Rejected('corrupt')
        if len(data) > MAX_INPUT:
            raise Rejected('resource_limit')
        if format not in ('pdf', 'docx'):
            raise Rejected('unsupported_content')
        return (pdf if format == 'pdf' else docx)(data)
    except Rejected as error:
        return failed(error.reason)
    except MemoryError:
        return failed('resource_limit')
    except NotImplementedError:
        return failed('unsupported_content')
    except (PdfReadError, PdfStreamError, zipfile.BadZipFile, ET.ParseError, UnicodeError,
            ValueError, KeyError, IndexError, TypeError, RecursionError, OverflowError):
        return failed('corrupt')
