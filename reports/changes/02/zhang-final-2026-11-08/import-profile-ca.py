import ctypes as c
import os
import ssl
import sys
from pathlib import Path

runtime, profile, certificate = map(Path, sys.argv[1:])
boundary = (Path.cwd() / 'output/verification/reviewer').resolve()
assert profile.resolve().is_relative_to(boundary)
profile.mkdir(parents=True, exist_ok=True)
os.add_dll_directory(str(runtime))
nss = c.CDLL(str(runtime / 'nss3.dll'))
def function(name, result, arguments):
    f = getattr(nss, name)
    f.restype, f.argtypes = result, arguments
    return f
def success(result, label):
    if result != 0:
        raise RuntimeError(label + ' failed')
class Item(c.Structure):
    _fields_ = [('type', c.c_uint), ('data', c.POINTER(c.c_ubyte)), ('len', c.c_uint)]
class Trust(c.Structure):
    _fields_ = [('ssl', c.c_uint), ('email', c.c_uint), ('object', c.c_uint)]

success(function('NSS_InitReadWrite', c.c_int, [c.c_char_p])(('sql:' + str(profile)).encode()), 'Profile NSS init')
certs = c.POINTER(c.c_void_p)()
try:
    db = function('CERT_GetDefaultCertDB', c.c_void_p, [])()
    slot = function('PK11_GetInternalKeySlot', c.c_void_p, [])()
    try:
        if function('PK11_NeedUserInit', c.c_int, [c.c_void_p])(slot):
            success(function('PK11_InitPin', c.c_int, [c.c_void_p, c.c_char_p, c.c_char_p])(slot, None, b''), 'Disposable profile empty PIN init')
        success(function('PK11_Authenticate', c.c_int, [c.c_void_p, c.c_int, c.c_void_p])(slot, 1, None), 'Disposable profile authentication')
    finally:
        function('PK11_FreeSlot', None, [c.c_void_p])(slot)
    der = ssl.PEM_cert_to_DER_cert(certificate.read_text())
    buffer = (c.c_ubyte * len(der)).from_buffer_copy(der)
    item = Item(0, buffer, len(der))
    items = (c.POINTER(Item) * 1)(c.pointer(item))
    success(function('CERT_ImportCerts', c.c_int, [c.c_void_p, c.c_int, c.c_uint,
        c.POINTER(c.POINTER(Item)), c.POINTER(c.POINTER(c.c_void_p)), c.c_int, c.c_int, c.c_char_p])(
            db, 11, 1, items, c.byref(certs), 1, 1, b'Disposable Campus verification CA'), 'Profile CA import')
    trust = Trust()
    success(function('CERT_DecodeTrustString', c.c_int, [c.POINTER(Trust), c.c_char_p])(c.byref(trust), b'CT,,'), 'Server CA trust')
    success(function('CERT_ChangeCertTrust', c.c_int, [c.c_void_p, c.c_void_p, c.POINTER(Trust)])(
        db, certs[0], c.byref(trust)), 'Profile CA trust')
finally:
    if certs:
        function('CERT_DestroyCertArray', None, [c.POINTER(c.c_void_p), c.c_uint])(certs, 1)
    success(function('NSS_Shutdown', c.c_int, [])(), 'Profile NSS shutdown')
print('Disposable Firefox profile CA imported; Windows certificate stores untouched')
