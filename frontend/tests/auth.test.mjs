import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthClient, validId } from '../src/auth/client.ts'

const principal = (class_id = '2', role = 'teacher') => ({
  user_id: '9223372036854775807', role, class_id, session_id: 'b'.repeat(32),
  session_version: 1, expires_at: '2030-01-01T00:00:00.000Z',
})
const session = (id, role) => ({ access_token: 'mock-access', token_type: 'Bearer', expires_in: 900, principal: principal(id, role) })
const csrf = { csrf_token: 'c'.repeat(32) }
const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers })
const err = (status, code, headers) => json({
  error: { code, message: '合成测试消息', fields: [], details: null }, request_id: 'a'.repeat(32),
}, status, headers)
const loginResponses = (role) => [json(session('2', role)), json(csrf)]
function fixture(...responses) {
  const calls = []
  const client = createAuthClient(async (path, init) => {
    calls.push({ path, ...init })
    assert.equal(init.credentials, 'same-origin')
    assert.equal(init.cache, 'no-store')
    const next = responses.shift()
    assert.ok(next, 'Unexpected request: ' + path)
    return typeof next === 'function' ? next() : next
  })
  return { client, calls, paths: () => calls.map(x => x.method + ' ' + x.path.split('/').at(-1)) }
}

test('FEF-SC-03 login bounds, unchanged input, duplicate clicks and private credentials', async () => {
  const { client, calls, paths } = fixture(...loginResponses())
  await client.login('🙂'.repeat(65), 'x')
  await client.login('x', '🙂'.repeat(129))
  await client.login('', '')
  assert.equal(calls.length, 0)
  const username = '🙂'.repeat(64)
  const password = ' ' + '密'.repeat(127)
  await Promise.all([client.login(username, password), client.login(username, password)])
  assert.deepEqual(paths(), ['POST login', 'GET csrf'])
  assert.deepEqual(JSON.parse(calls[0].body), { username, password })
  assert.equal(client.snapshot().phase, 'authenticated')
  assert.doesNotMatch(JSON.stringify(client.snapshot()), /mock-access|cccccc/)
})

test('FEF-SC-03/09 uniform 401, Retry-After and malformed CSRF are fail closed', async () => {
  const wrong = fixture(err(401, 'UNAUTHENTICATED'))
  await wrong.client.login('u', 'p')
  assert.equal(wrong.client.snapshot().phase, 'anonymous')
  assert.match(wrong.client.snapshot().error.message, /账号或密码不正确/)
  const limited = fixture(err(429, 'RATE_LIMITED', { 'Retry-After': '30' }))
  await limited.client.login('u', 'p')
  await limited.client.login('u', 'p')
  assert.equal(limited.calls.length, 1)
  assert.ok(limited.client.snapshot().error.retryAt > Date.now())
  const invalid = fixture(json(session()), json({ csrf_token: 'short' }))
  await invalid.client.login('u', 'p')
  assert.equal(invalid.client.snapshot().phase, 'recovery-error')
  assert.equal(invalid.client.snapshot().principal, undefined)
})

test('FEF-SC-04/05 recover order, one refresh and one replay, no logout after contention', async () => {
  const { client, calls, paths } = fixture(...loginResponses(), err(401, 'UNAUTHENTICATED'),
    json(csrf), json(session()), json(csrf), err(401, 'UNAUTHENTICATED'))
  await client.login('u', 'p')
  await Promise.all([client.verify(), client.verify()])
  assert.deepEqual(paths(), ['POST login', 'GET csrf', 'GET me', 'GET csrf', 'POST refresh', 'GET csrf', 'GET me'])
  assert.equal(calls[4].headers['X-CSRF-Token'], csrf.csrf_token)
  assert.equal(calls[4].body, undefined)
  assert.equal(calls[6].headers.Authorization, 'Bearer mock-access')
  assert.equal(client.snapshot().phase, 'anonymous')
  assert.equal(client.snapshot().principal, undefined)
  assert.match(client.snapshot().notice, /重新登录/)
})

test('FEF-SC-06 switch role and int64 boundaries, retain original class only after verification', async () => {
  const student = fixture(...loginResponses('student'))
  await student.client.login('u', 'p')
  await student.client.switchClass('3')
  assert.equal(student.calls.length, 2)
  const { client, calls, paths } = fixture(...loginResponses(), err(403, 'FORBIDDEN'), json(principal()),
    json(session('9223372036854775807')), json(csrf))
  assert.equal(validId('9223372036854775808'), false)
  await client.login('u', 'p')
  await client.switchClass('2')
  assert.match(client.snapshot().notice, /已在此班级/)
  await client.switchClass('9223372036854775808')
  assert.equal(calls.length, 2)
  await client.switchClass('3')
  assert.equal(client.snapshot().principal.class_id, '2')
  assert.match(client.snapshot().error.message, /无法切换/)
  await client.switchClass('9223372036854775807')
  assert.equal(client.snapshot().principal.class_id, '9223372036854775807')
  assert.equal(JSON.parse(calls[4].body).class_id, '9223372036854775807')
  assert.deepEqual(paths(), ['POST login', 'GET csrf', 'POST switch-class', 'GET me', 'POST switch-class', 'GET csrf'])
})

test('FEF-SC-07 late old class response is discarded and writes are serialized', async () => {
  let late
  const old = new Promise(resolve => { late = resolve })
  const { client, calls, paths } = fixture(...loginResponses(), () => old, json(session('3')), json(csrf))
  await client.login('u', 'p')
  const read = client.verify()
  await Promise.all([client.switchClass('3'), client.logout()])
  assert.equal(calls[2].signal.aborted, true)
  late(json(principal('2')))
  await read
  assert.equal(client.snapshot().principal.class_id, '3')
  assert.deepEqual(paths(), ['POST login', 'GET csrf', 'GET me', 'POST switch-class', 'GET csrf'])
})

test('FEF-SC-07/08 uncertain writes never replay; 204 and 401 clear identity', async () => {
  for (const [response, phase, message] of [
    [new Response(null, { status: 204 }), 'anonymous', /已退出/],
    [err(401, 'UNAUTHENTICATED'), 'anonymous', /重新登录/],
    [err(503, 'DEPENDENCY_UNAVAILABLE'), 'recovery-error', /暂未确认/],
    [err(504, 'UPSTREAM_TIMEOUT'), 'recovery-error', /暂未确认/],
    [() => { throw new TypeError('offline') }, 'recovery-error', /暂未确认/],
  ]) {
    const { client, paths } = fixture(...loginResponses(), response)
    await client.login('u', 'p')
    await client.logout()
    assert.equal(client.snapshot().phase, phase)
    assert.equal(client.snapshot().principal, undefined)
    assert.match(client.snapshot().notice, message)
    assert.deepEqual(paths(), ['POST login', 'GET csrf', 'POST logout'])
  }
})

test('FEF-SC-09 malformed response cannot install identity or leak the response body', async () => {
  const { client } = fixture(json({ ...session(), principal: { ...principal(), role: 'unknown' } }))
  await client.login('u', 'p')
  assert.equal(client.snapshot().principal, undefined)
  assert.match(client.snapshot().error.message, /服务响应异常/)
})
