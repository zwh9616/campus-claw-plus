import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { validateCitation, validateGrade, validateStream, validateConfigSample, validateOperationBoundary, validateOutboundCandidate } from './validate.mjs'

const fixture = JSON.parse(readFileSync('docs/contracts/fixtures/semantic-cases.json', 'utf8'))
const register = JSON.parse(readFileSync('docs/contracts/config-register.json', 'utf8'))
const copy = value => structuredClone(value)

test('BC-SC-06 accepts trusted rubric, rejects incorrect grading, stale and missing context', () => {
  validateGrade(fixture.grade, fixture.rubric)
  for (const mutate of [
    g => g.items.pop(), g => g.items.push(copy(g.items[0])), g => g.items[0].score = 1001,
    g => g.total_score++, g => g.max_total++, g => g.items[0].max_score++,
    g => g.submission_version++, g => g.rubric_version++, g => g.submission_id = '99',
    g => g.items[0].criterion_id = '99',
  ]) { const grade = copy(fixture.grade); mutate(grade); assert.throws(() => validateGrade(grade, fixture.rubric)) }
  assert.throws(() => validateGrade(fixture.grade))
  const boundary = copy(fixture.grade)
  boundary.items[0].score = boundary.total_score = 1000
  validateGrade(boundary, fixture.rubric)
  boundary.items[0].score = boundary.total_score = 0
  validateGrade(boundary, fixture.rubric)
})

test('BC-SC-05 nonempty Citation codepoint range', () => {
  validateCitation(fixture.citation)
  assert.throws(() => validateCitation({ ...fixture.citation, char_end: 0 }))
  assert.throws(() => validateCitation({ ...fixture.citation, char_start: 3 }))
})

test('BC-SC-08/14 terminal sequence, cancellation and disconnected persistence', () => {
  const event = (name, type) => ({ event: type ?? name, data: copy(fixture.sse[name]) })
  const meta = event('meta'), token = event('token'), done = event('done'), error = event('error')
  validateStream([meta, token, done], { state: 'completed' })
  validateStream([meta, token, error], { state: 'cancelled' })
  validateStream([meta, token], { connected: false, state: 'partial' })
  validateStream([meta], { connected: false, state: 'failed' })
  validateStream([meta, token], { connected: false, state: 'completed' })
  for (const sequence of [[token, done], [meta, meta, done], [meta, token], [meta, done, token], [meta, done, error], [meta, { ...token, data: { ...token.data, seq: 2 } }, done]]) {
    assert.throws(() => validateStream(sequence, { state: 'completed' }))
  }
  assert.throws(() => validateStream([meta, error], { state: 'completed' }))
  assert.throws(() => validateStream([meta], { connected: false, state: 'generating' }))
  assert.throws(() => validateStream([meta, { ...done, data: { ...done.data, turn_id: '99' } }], { state: 'completed' }))
  const failed = { event: 'error', data: { ...error.data, code: 'UPSTREAM_TIMEOUT', message: '生成超时', retryable: true } }
  validateStream([meta, failed], { state: 'failed' })
  validateStream([meta, token, failed], { state: 'partial' })
  assert.throws(() => validateStream([meta, failed], { state: 'completed' }))
})

test('BC-SC-10 MCP exception remains exact, disabled and subject to both future reviews', () => {
  validateOutboundCandidate(register)
  for (const mutate of [
    r => r.outbound_exceptions[0].enabled = true,
    r => r.outbound_exceptions[0].url = 'http://127.0.0.1:8090/mcp',
    r => r.outbound_exceptions[0].url += '?redirect=localhost',
    r => r.outbound_exceptions[0].required_approvals.pop(),
    r => r.outbound_exceptions[0].constraints.pop(),
    r => r.outbound_exceptions[0].cidr = '10.0.0.0/8',
    r => r.outbound_exceptions.push(copy(r.outbound_exceptions[0])),
  ]) { const bad = copy(register); mutate(bad); assert.throws(() => validateOutboundCandidate(bad)) }
})

test('BC-SC-09 registered empty keys only; no weakening historical HTTP_PORT requirement', () => {
  const sample = register.active.map(e => e.name+'=').join('\n')+'\n'
  validateConfigSample(sample, register)
  for (const value of ['', 'HTTP_PORT=18080', 'HTTP_PORT=\nUNKNOWN=', 'HTTP_PORT=\nHTTP_PORT=', 'HTTP_PORT= \nDB_PASSWORD=secret']) {
    assert.throws(() => validateConfigSample(value, register))
  }
  const missing = copy(register); missing.active = []
  assert.throws(() => validateConfigSample('', missing))
  const optionalPort = copy(register); optionalPort.active[0].required = false
  assert.throws(() => validateConfigSample('HTTP_PORT=', optionalPort))
  const future = copy(register)
  future.active.push({ ...future.active[0], name: 'DB_URL', owner: '01', introduced_by: 'openspec/changes/future-approved' })
  assert.throws(() => validateConfigSample(sample+'DB_URL=', future, () => false))
  // A real future entry also requires the declared change to exist; approval is PR-reviewed.
  validateConfigSample(sample+'DB_URL=', future, () => true)
})

test('BC-SC-18 planned operations and anonymous auth bypass cannot enter OpenAPI', () => {
  const api = parse(readFileSync('docs/contracts/openapi.yaml', 'utf8'))
  const endpoints = JSON.parse(readFileSync('docs/contracts/endpoint-register.json', 'utf8'))
  validateOperationBoundary(api, endpoints)
  const planned = copy(api)
  planned.paths['/api/v1/tasks/{id}'] = { get: copy(api.paths['/api/v1/me'].get) }
  assert.throws(() => validateOperationBoundary(planned, endpoints))
  const anonymous = copy(api); anonymous.paths['/api/v1/auth/refresh'].post.security = []
  assert.throws(() => validateOperationBoundary(anonymous, endpoints))
  const mislabeled = copy(api); mislabeled.paths['/api/v1/me'].get['x-contract-status'] = 'frozen'
  assert.throws(() => validateOperationBoundary(mislabeled, endpoints))
})
