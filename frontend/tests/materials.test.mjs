import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthClient, AuthError } from '../src/auth/client.ts'
import { parseMaterial, parseDetail, parseSearch, checkCitation, validateUpload, trimSpace, materialRoute } from '../src/materials/contracts.ts'

const principal = (class_id = '2', role = 'teacher') => ({ user_id: '1', class_id, role, session_id: 'b'.repeat(32), session_version: 1, expires_at: '2030-01-01T00:00:00.000Z' })
const session = (classId, role) => ({ access_token: 'synthetic-material-access', token_type: 'Bearer', expires_in: 900, principal: principal(classId, role) })
const csrf = { csrf_token: 'c'.repeat(32) }
const material = (overrides = {}) => ({ id: '9223372036854775807', title: '课堂𠮷📚资料', version: 1, index_status: 'ready', size_bytes: 10, created_at: '2026-11-11T00:00:00.000Z', ...overrides })
const page = (items = [material()]) => ({ items, page: 1, page_size: 20, total: items.length })
const detail = () => ({ material: material(), body: '甲𠮷📚乙' })
const citation = (overrides = {}) => ({ material_id: material().id, chunk_id: '4', material_version: 1, title: material().title, ordinal: 0, char_start: 1, char_end: 3, quote: '𠮷📚', url: '/api/v1/materials/' + material().id, ...overrides })
const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers })
const denied = (status, headers = {}) => json({ error: { code: ({400:'VALIDATION_ERROR',401:'UNAUTHENTICATED',403:'FORBIDDEN',404:'NOT_FOUND',409:'CONFLICT',413:'PAYLOAD_TOO_LARGE',429:'RATE_LIMITED',503:'DEPENDENCY_UNAVAILABLE',504:'UPSTREAM_TIMEOUT'})[status], message: '不应显示的远端原值', fields: [], details: null }, request_id: 'a'.repeat(32) }, status, headers)
function fixture(responses, role = 'teacher') {
  const calls = [], queue = [json(session('2', role)), json(csrf), ...responses]
  const client = createAuthClient(async (path, init) => {
    calls.push({ path, ...init })
    const next = queue.shift()
    assert.ok(next, 'Unexpected request')
    return typeof next === 'function' ? next(path, init) : next
  })
  return { client, calls, queue, login: () => client.login('u', 'p') }
}
const payload = (body = '\uFEFF甲\r\n𠮷📚\r乙') => ({ title: ' 课堂𠮷📚资料 ', file: new File([body], 'notes.TXT', { type: 'text/plain' }) })
const key = 'synthetic_upload_key_0001'

test('MF-SC-01/02/07 invalid routes/IDs/queries fail before network, ID stays a string', async () => {
  const f = fixture([]); await f.login()
  for (const path of ['/app/materials/0','/app/materials/01','/app/materials/9223372036854775808','/app/materials/../','/missing']) assert.equal(materialRoute(path), undefined)
  assert.deepEqual(materialRoute('/app/materials/'+material().id), { kind: 'detail', id: material().id })
  assert.throws(() => f.client.materials.detail('https://untrusted.invalid'))
  for (const q of ['', '字'.repeat(2001), 'a\u0000b', '\ud800']) await assert.rejects(f.client.materials.search(q), AuthError)
  await assert.rejects(f.client.materials.list(0), AuthError)
  assert.equal(f.calls.length, 2)
})
test('MF-SC-02 fixed pagination/keyword request and no exposed credentials', async () => {
  const f=fixture([json(page()),json({items:[citation()],mode:'keyword'})]);await f.login()
  assert.equal((await f.client.materials.list()).items[0].id, material().id)
  await f.client.materials.search(' \u0085𠮷%_ ')
  assert.equal(f.calls[2].path,'/api/v1/materials?page=1&page_size=20')
  const url=new URL(f.calls[3].path,'https://campus.invalid')
  assert.equal(url.searchParams.get('q'),'𠮷%_');assert.equal(url.searchParams.get('top_k'),'4');assert.equal(url.searchParams.get('mode'),'keyword')
  for(const call of f.calls.slice(2)){assert.equal(call.headers.Authorization,'Bearer synthetic-material-access');assert.equal(call.credentials,'same-origin');assert.equal(call.cache,'no-store');assert.equal(call.redirect,'error')}
  assert.doesNotMatch(JSON.stringify(f.client.snapshot()), /synthetic-material-access|csrf_token/)
})
test('MF-SC-06/09 malformed material/page/citation/body are rejected', async () => {
  for(const m of [material({id:9}),material({title:'x'.repeat(201)}),material({title:' a'}),material({version:2}),material({index_status:'deleted'}),material({size_bytes:0}),material({extra:1})])assert.throws(()=>parseMaterial(m))
  for(const c of [citation({url:'https://evil.invalid'}),citation({url:'/api/v1/materials/5'}),citation({char_end:4}),citation({material_id:4})])assert.throws(()=>parseSearch({items:[c],mode:'keyword'}))
  assert.throws(()=>parseDetail({material:material(),body:''},material().id))
  assert.throws(()=>parseDetail({...detail(),body:'a\r\nb'},material().id))
  checkCitation(detail(),citation())
  assert.throws(()=>checkCitation({...detail(),body:'甲xx乙'},citation()))
  assert.throws(()=>checkCitation(detail(),citation({material_version:2})))
  const f=fixture([json({...page(),items:[material(),material()],total:2})]);await f.login()
  await assert.rejects(f.client.materials.list(), /服务响应异常/)
})
test('MF-SC-03 upload validates Go whitespace/UTF-8/control/byte/codepoint boundaries and preserves file', async () => {
  assert.equal(trimSpace('\u0085 a\u0085'),'a');assert.equal(trimSpace('\uFEFFa\uFEFF'),'\uFEFFa\uFEFF')
  const valid=payload();const checked=await validateUpload(valid);assert.equal(checked.file,valid.file);assert.equal(checked.title,'课堂𠮷📚资料')
  await validateUpload({title:'𠮷'.repeat(200),file:new File(['x'.repeat(262144)],'max.txt')})
  for(const p of [{...payload(),title:'𠮷'.repeat(201)},{...payload(),title:'a\tb'},payload(''),payload('\uFEFF \r\n'),payload('\u0000'),{title:'x',file:new File([new Uint8Array([0xff])],'bad.txt')},{title:'x',file:new File(['x'.repeat(262145)],'big.txt')},{title:'x',file:new File(['x'],'bad.md')}])await assert.rejects(validateUpload(p))
})
test('MF-SC-03/04 multipart boundary/browser bytes and duplicate write/manual same-key confirmation', async () => {
  const f=fixture([denied(503),json(material(),200)]);await f.login();const p=payload()
  const one=f.client.materials.upload(p,key),two=f.client.materials.upload(p,key)
  assert.equal(one,two);await assert.rejects(one,e=>e.status===503)
  assert.equal(f.calls.length,3)
  const first=f.calls[2];assert.equal(first.headers['Content-Type'],undefined);assert.equal(first.headers['Idempotency-Key'],key)
  assert.equal(first.body.get('title'),'课堂𠮷📚资料');assert.deepEqual(new Uint8Array(await first.body.get('file').arrayBuffer()),new Uint8Array(await p.file.arrayBuffer()))
  await f.client.materials.upload(p,key);assert.equal(f.calls.length,4);assert.equal(f.calls[3].headers['Idempotency-Key'],key)
})
test('MF-SC-07/09 GET 401 recovers one time then replays, second 401 clears identity', async () => {
  const f=fixture([denied(401),json(csrf),json(session()),json(csrf),json(principal()),json(page())]);await f.login()
  await f.client.materials.list();assert.equal(f.calls.length,8)
  assert.deepEqual(f.calls.slice(2).map(x=>x.path.split('?')[0]),['/api/v1/materials','/api/v1/auth/csrf','/api/v1/auth/refresh','/api/v1/auth/csrf','/api/v1/me','/api/v1/materials'])
  const g=fixture([denied(401),json(csrf),json(session()),json(csrf),json(principal()),denied(401)]);await g.login()
  await assert.rejects(g.client.materials.list());assert.equal(g.client.snapshot().phase,'anonymous');assert.equal(g.calls.length,8)
})
test('MF-SC-07/09 recovery into a different class never replays material request', async () => {
  const f=fixture([denied(401),json(csrf),json(session('3')),json(csrf),json(principal('3'))]);await f.login()
  await assert.rejects(f.client.materials.list());assert.equal(f.calls.filter(x=>x.path.startsWith('/api/v1/materials')).length,1);assert.equal(f.client.snapshot().principal,undefined)
})
test('MF-SC-09 upload/download 401 recover credentials but never automatically replay', async () => {
  for(const operation of ['upload','download']){
    const f=fixture([denied(401),json(csrf),json(session()),json(csrf),json(principal())]);await f.login()
    await assert.rejects(operation==='upload'?f.client.materials.upload(payload(),key):f.client.materials.download(material().id),e=>e.status===401)
    assert.equal(f.calls.filter(x=>x.path.startsWith('/api/v1/materials')).length,1)
  }
})
test('MF-SC-08 context reset discards a response even when fetch ignores cancellation', async () => {
  let release;const slow=new Promise(resolve=>{release=resolve})
  const f=fixture([()=>slow]);await f.login();const request=f.client.materials.detail(material().id);const rejected=assert.rejects(request)
  f.client.clear();release(json(detail()));await rejected;assert.equal(f.client.snapshot().principal,undefined)
})
test('MF-SC-08 external notification aborts immediately during material 401 recovery', async () => {
  let release;const slow=new Promise(resolve=>{release=resolve})
  const f=fixture([denied(401),()=>slow,json(csrf),denied(401)]);await f.login()
  const pending=f.client.materials.list();const rejected=assert.rejects(pending)
  while(f.calls.length<4)await new Promise(r=>setTimeout(r,0))
  const changed=f.client.externalChange();assert.equal(f.client.snapshot().principal,undefined)
  release(json(csrf));await rejected;await changed;assert.equal(f.client.snapshot().phase,'anonymous')
})
test('MF-SC-07 student writes fail locally; 403 rechecks identity', async () => {
  const student=fixture([],'student');await student.login();await assert.rejects(student.client.materials.retry(material().id),e=>e.status===403);assert.equal(student.calls.length,2)
  const teacher=fixture([denied(403),json(principal())]);await teacher.login();await assert.rejects(teacher.client.materials.retry(material().id),e=>e.status===403);assert.equal(teacher.calls.at(-1).path,'/api/v1/me')
})
test('MF-SC-09 404/409/413/429/503/504 give safe errors, Retry-After survives', async () => {
  for(const status of [404,409,413,429,503,504]){
    const f=fixture([denied(status,{'Retry-After':'30'})]);await f.login()
    const run=status===404?f.client.materials.detail(material().id):f.client.materials.upload(payload(),key)
    await assert.rejects(run,e=>{assert.equal(e.status,status);assert.doesNotMatch(e.message,/远端原值/);if(status===429)assert.ok(e.retryAt>Date.now());return true})
    assert.equal(f.calls.length,3)
  }
})
test('MF-SC-09 deadline is 10000ms and bounds a fetch which ignores AbortSignal', async t => {
  const native=AbortSignal.timeout.bind(AbortSignal)
  t.mock.method(AbortSignal,'timeout',milliseconds=>{assert.equal(milliseconds,10000);return native(15)})
  const f=fixture([()=>new Promise(resolve=>setTimeout(()=>resolve(json(page())),100))]);await f.login()
  await assert.rejects(f.client.materials.list(),/超时/)
})
test('MF-SC-06 download returns original bytes with no URL token', async () => {
  const raw=new Uint8Array([0xef,0xbb,0xbf,65,13,10])
  const f=fixture([new Response(raw,{headers:{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'}})]);await f.login()
  const blob=await f.client.materials.download(material().id);assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),raw)
  assert.equal(f.calls[2].path,'/api/v1/materials/'+material().id+'/download')
})
test('MF-SC-04/08 same-identity background refresh keeps the material form context authenticated', async () => {
  const f=fixture([json(csrf),json(session()),json(csrf),json(principal())]);await f.login()
  const phases=[];const stop=f.client.subscribe(()=>phases.push(f.client.snapshot().phase))
  await f.client.refreshMaterialIdentity();stop()
  assert.deepEqual(phases,['authenticated']);assert.equal(f.client.snapshot().principal.class_id,'2')
})

async function delayedOldToken401(operation) {
  const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
  const firstRetry = deferred(), delayed401 = deferred(), finishFirst = deferred()
  let refreshes = 0, downloads = 0
  const token = () => 'synthetic-material-generation-' + refreshes
  const identity = () => ({ ...session(), access_token: token() })
  // Match 01: refresh rotates the cookie, but previously issued, unexpired
  // access credentials remain valid for the same session version.
  const validAccess = authorization => {
    const generation = Number(authorization.split('-').at(-1))
    return generation >= 1 && generation <= refreshes
  }
  const client = createAuthClient(async (path, init) => {
    if (path.endsWith('/auth/login')) return json(identity())
    if (path.endsWith('/auth/csrf')) return json(csrf)
    if (path.endsWith('/auth/refresh')) {
      ++refreshes
      if (refreshes > 1) finishFirst.resolve()
      return json(identity())
    }
    if (path === '/api/v1/me') return json(principal())
    const authorization = init.headers.Authorization
    if (path.includes('?page=')) {
      if (authorization.endsWith('-0')) return denied(401)
      firstRetry.resolve()
      await finishFirst.promise
      return validAccess(authorization) ? json(page()) : denied(401)
    }
    if (path === '/api/v1/materials/' + material().id || path === '/api/v1/materials/' + material().id + '/download') {
      if (operation === 'download') ++downloads
      if (authorization.endsWith('-0')) { await delayed401.promise; return denied(401) }
      assert.equal(operation, 'detail', 'a download must never replay automatically')
      finishFirst.resolve()
      return validAccess(authorization) ? json(detail()) : denied(401)
    }
    assert.fail('Unexpected test request: ' + path)
  })
  await client.login('u', 'p')
  const first = client.materials.list()
  const second = operation === 'detail' ? client.materials.detail(material().id) : client.materials.download(material().id)
  const pending = Promise.allSettled([first, second.finally(() => finishFirst.resolve())])
  await firstRetry.promise
  delayed401.resolve()
  const results = await pending
  assert.deepEqual(results.map(result => result.status), ['fulfilled', operation === 'detail' ? 'fulfilled' : 'rejected'])
  if (operation === 'download') { assert.equal(downloads, 1); assert.equal(results[1].reason.status, 401) }
  assert.equal(refreshes, 1, 'an old response must not rotate the recovered token again')
  assert.equal(client.snapshot().phase, 'authenticated')
}
test('MF-SC-08/09 delayed old-token 401 reuses recovered credentials while another read is in flight', { timeout: 3000 }, () => delayedOldToken401('detail'))
test('MF-SC-08/09 delayed download 401 does not refresh again or replay the download', { timeout: 3000 }, () => delayedOldToken401('download'))
