import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { materialOperations, validateMaterialOperationProfiles } from './materials.mjs'

// BC-SC-09: configuration values are never accepted by this registry check.
export function validateConfigSample(text, register, exists = existsSync) {
  assert.equal(register.version, 1)
  assert.ok(Array.isArray(register.active) && register.active.length > 0)
  const keys = register.active.map(entry => {
    assert.match(entry.name, /^[A-Z][A-Z0-9_]*$/)
    for (const field of ['owner', 'introduced_by', 'missing_behavior', 'timeout']) {
      assert.ok(typeof entry[field] === 'string' && entry[field].length > 0, `Missing ${field}`)
    }
    assert.equal(typeof entry.required, 'boolean')
    assert.equal(typeof entry.secret, 'boolean')
    assert.match(entry.introduced_by, /^openspec\/(changes|specs)\//)
    assert.ok(!entry.introduced_by.includes('..') && exists(entry.introduced_by), 'Invalid config change reference')
    return entry.name
  })
  assert.equal(new Set(keys).size, keys.length, 'Duplicate registered key')
  assert.ok(keys.includes('HTTP_PORT'), 'Historical HTTP_PORT contract must remain')
  assert.equal(register.active.find(entry => entry.name === 'HTTP_PORT').required, true)
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'))
  assert.ok(lines.every(line => /^[A-Z][A-Z0-9_]*=$/.test(line)), 'Configuration samples must contain empty values only')
  assert.equal(new Set(lines).size, lines.length, 'Duplicate sample key')
  assert.deepEqual(lines.map(line => line.slice(0, -1)).sort(), [...keys].sort(), 'Unregistered or missing sample key')
}

export const expectedOperations = [
  'GET /health', 'POST /api/v1/auth/login', 'GET /api/v1/auth/csrf',
  'POST /api/v1/auth/refresh', 'GET /api/v1/me', 'POST /api/v1/auth/logout',
  'POST /api/v1/auth/switch-class',
]

// BC-SC-10: registration is not permission to enable an outbound exception.
export function validateOutboundCandidate(register) {
  assert.equal(register.outbound_exceptions.length, 1)
  const entry = register.outbound_exceptions[0]
  assert.deepEqual(Object.keys(entry).sort(), ['url', 'enabled', 'required_approvals', 'constraints', 'removal'].sort())
  assert.equal(entry.url, 'http://mcp:8090/mcp')
  assert.equal(entry.enabled, false, '00 cannot enable the future MCP exception')
  assert.deepEqual(entry.required_approvals, ['03', '07C'])
  assert.deepEqual(entry.constraints, [
    '精确scheme/服务/端口/path', '无userinfo/query/fragment/redirect', '解析目标为本项目网络服务',
  ])
  assert.ok(typeof entry.removal === 'string' && entry.removal.length > 0)
}

// BC-SC-18: the list is intentionally independent of the endpoint register.
export function validateOperationBoundary(api, register) {
  assert.equal(api.openapi, '3.1.0')
  assert.equal(api.jsonSchemaDialect, 'https://json-schema.org/draft/2020-12/schema')
  const seen = []
  for (const [path, item] of Object.entries(api.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'].includes(method)) continue
      const key = `${method.toUpperCase()} ${path}`
      seen.push(key)
      const material = materialOperations.some(([m,p]) => `${m} ${p}` === key)
      assert.equal(operation['x-contract-status'], material ? 'frozen' : 'current', `Wrong operation stage: ${key}`)
      assert.equal(operation['x-owner-change'], material ? '04' : key === 'GET /health' ? 'bootstrap' : '01')
      const entry = register.operations.find(x => `${x.method} ${x.path}` === key)
      assert.ok(entry, `Unregistered operation: ${key}`)
      assert.equal(entry.status, operation['x-contract-status'])
      assert.equal(entry.owner, operation['x-owner-change'])
    }
  }
  const allowed = [...expectedOperations, ...materialOperations.map(([m,p]) => `${m} ${p}`)].sort()
  assert.deepEqual(seen.sort(), allowed, 'Planned/missing operation in OpenAPI')
  assert.deepEqual(register.operations.map(x => `${x.method} ${x.path}`).sort(), allowed)
  assert.equal(register.planned.some(x => x.owner === '04'), false)
  validateMaterialOperationProfiles(api)
  const security = (path, method = 'post') => api.paths[path][method].security
  assert.deepEqual(security('/health', 'get'), [])
  assert.deepEqual(security('/api/v1/auth/login'), [])
  assert.deepEqual(security('/api/v1/auth/csrf', 'get'), [{ RefreshCookie: [] }])
  assert.deepEqual(security('/api/v1/auth/refresh'), [{ RefreshCookie: [], CsrfToken: [] }])
  assert.deepEqual(security('/api/v1/me', 'get'), [{ BearerAuth: [] }])
  for (const action of ['logout', 'switch-class']) {
    assert.deepEqual(security(`/api/v1/auth/${action}`), [{ BearerAuth: [], RefreshCookie: [], CsrfToken: [] }])
  }
  for (const action of ['refresh', 'logout', 'switch-class']) {
    assert.ok(api.paths[`/api/v1/auth/${action}`].post.parameters.some(p => p.name === 'Origin' && p.in === 'header' && p.required))
  }
  assert.equal(api.paths['/api/v1/auth/logout'].post.responses['204'].content, undefined)
}

// BC-SC-05/06: these validate contract examples, never real storage authorization.
export function validateCitation(citation) {
  assert.ok(citation.char_end > citation.char_start, 'Citation range must be nonempty')
}

export function validateGrade(result, rubric) {
  assert.ok(rubric, 'Trusted rubric context is required')
  for (const key of ['submission_id', 'submission_version', 'rubric_version']) {
    assert.equal(result[key], rubric[key], `Stale or unrelated ${key}`)
  }
  assert.equal(new Set(rubric.items.map(x => x.criterion_id)).size, rubric.items.length, 'Duplicate rubric criterion')
  assert.equal(new Set(result.items.map(x => x.criterion_id)).size, result.items.length, 'Duplicate result criterion')
  assert.deepEqual(result.items.map(x => x.criterion_id).sort(), rubric.items.map(x => x.criterion_id).sort(), 'Rubric items mismatch')
  let total = 0, max = 0
  for (const item of result.items) {
    const criterion = rubric.items.find(x => x.criterion_id === item.criterion_id)
    assert.equal(item.max_score, criterion.max_score, 'Model cannot choose rubric maximum')
    assert.ok(Number.isSafeInteger(item.score) && item.score >= 0 && item.score <= criterion.max_score, 'Invalid criterion score')
    for (const citation of item.citations) validateCitation(citation)
    total += item.score
    max += criterion.max_score
  }
  assert.equal(result.total_score, total, 'Total is not sum of items')
  assert.equal(result.max_total, max, 'Maximum is not sum of rubric')
  assert.ok(total <= max)
}

// BC-SC-08/14: wire data is individually Schema-validated by the caller.
export function validateStream(events, { connected = true, state } = {}) {
  assert.ok(events.length && events[0].event === 'meta', 'meta must be first')
  const turn = events[0].data.turn_id
  let seq = 0, terminal
  for (const [index, event] of events.entries()) {
    assert.equal(event.data.turn_id, turn, 'Mixed turns')
    assert.ok(!terminal, 'Event after terminal')
    if (event.event === 'meta') assert.equal(index, 0, 'Repeated meta')
    else if (event.event === 'token') assert.equal(event.data.seq, ++seq, 'Noncontiguous token sequence')
    else { assert.ok(['done', 'error'].includes(event.event)); terminal = event }
  }
  if (connected) assert.ok(terminal, 'Writable connection lacks terminal')
  if (terminal?.event === 'done') assert.equal(state, 'completed')
  if (terminal?.data.code === 'CANCELLED') assert.equal(state, 'cancelled')
  if (terminal?.event === 'error' && terminal.data.code !== 'CANCELLED') {
    assert.ok(['partial', 'failed'].includes(state), 'Generation error needs partial/failed state')
  }
  if (!terminal) assert.ok(['partial', 'failed', 'completed', 'cancelled'].includes(state), 'Disconnect needs persisted terminal state')
}
