import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import SwaggerParser from '@apidevtools/swagger-parser'
import { validateDocumentDetailExample, documentChange } from './documents.mjs'

const directory = 'docs/contracts/document-parser'
const json = path => JSON.parse(readFileSync(path, 'utf8'))
const sha = value => createHash('sha256').update(value).digest('hex')
const reasons = ['corrupt', 'encrypted', 'unsupported_content', 'resource_limit', 'parse_timeout', 'worker_interrupted', 'internal_failure']
const keys = ['DOCUMENT_PARSER_URL', 'DOCUMENT_PARSER_TOKEN']

export function validatePrivateConfigExample(values) {
  assert.deepEqual(Object.keys(values).sort(), [...keys].sort())
  assert.ok(values.DOCUMENT_PARSER_URL === 'http://document-parser:8091', 'DI-SC-14 unexpected internal origin')
  const token = values.DOCUMENT_PARSER_TOKEN
  assert.equal(typeof token, 'string')
  assert.ok(/^[A-Za-z0-9_-]{43}$/.test(token), 'DI-SC-14 invalid token encoding/length')
  const decoded = Buffer.from(token, 'base64url')
  assert.equal(decoded.length, 32)
  assert.ok(decoded.toString('base64url') === token, 'DI-SC-14 token must have canonical trailing bits')
}

export function validateIntegrationProfile(contract, register, read = p => readFileSync(p), names = readdirSync('backend/internal/migrations/sql')) {
  assert.equal(contract.version, 1)
  assert.equal(contract.status, 'frozen')
  assert.equal(contract.owner, '04E')
  assert.equal(contract.introduced_by, documentChange)
  assert.equal(contract.runtime_activation, false)
  assert.deepEqual(contract.config_keys, keys)
  assert.deepEqual(contract.network, { origin: 'http://document-parser:8091', internal: true, host_ports: false,
    members: ['backend', 'document-parser'], egress: false, database_credentials: false, enabled: false, redirects: false, environment_proxy: false })
  assert.deepEqual(contract.rpc, {
    schema: 'document-parser/ParseResult.schema.json', openapi: 'document-parser/openapi.json',
    request_bytes: 10485760, response_bytes: 8388608, header_bytes: 8192, content_length_required: true, transfer_encoding: false,
    health_preflight_ms: 500, connect_ms: 1000, response_header_ms: 32000, total_ms: 35000, parse_ms: 30000,
    read_header_ms: 5000, read_body_ms: 5000, concurrency: 1, memory_bytes: 536870912, child_address_bytes: 402653184,
    cpus: 1, pids: 32, tmpfs_bytes: 67108864,
    json_rules: { encoding: 'strict_utf8', duplicate_keys: 'reject', surrogates: 'paired', max_depth: 16, unknown_fields: 'reject' },
    upload_order: ['authenticate', 'authorize', 'validate_and_hash', 'lookup_committed_snapshot', 'preflight_new_only', 'transaction_create'],
    error_mapping: { deterministic: 422, parse_timeout: 504, worker_interrupted: 503, internal_failure: 503,
      busy: 503, transport_interrupted: 'worker_interrupted', invalid_result: 'internal_failure', deadline: 'parse_timeout' },
  })
  assert.deepEqual(contract.worker, { poll_ms: 1000, heartbeat_ms: 20000, lease_ms: 60000, max_attempts: 3,
    concurrency: 1, clock: 'database_utc', publish_cas: ['owner', 'epoch', 'processing', 'lease_not_expired'], retry_reasons: reasons.slice(4) })
  assert.equal(sha(JSON.stringify(register.active)), contract.baseline.active_config_digest, 'Existing active configuration changed')
  assert.deepEqual(register.frozen.map(c => c.name), keys)
  for (const config of register.frozen) {
    assert.equal(config.owner, '04E'); assert.equal(config.status, 'frozen'); assert.equal(config.required, true)
    assert.equal(config.introduced_by, documentChange)
    assert.equal(config.secret, config.name === keys[1])
    assert.deepEqual(config.consumers, config.secret ? ['backend', 'document-parser', 'compose'] : ['backend', 'compose'])
    for (const field of ['validation', 'missing_behavior', 'timeout', 'activation_requires']) assert.ok(config[field]?.length > 0)
    assert.ok(!register.active.some(c => c.name === config.name))
  }
  assert.deepEqual(Object.keys(contract.baseline.protected_files).sort(), ['.env.example', 'compose.yaml',
    'docs/contracts/identity-phase.json', 'docs/contracts/endpoint-register.json', 'deploy/service-batches.json',
    'backend/internal/migrations/target.go', 'backend/internal/migrations/manifest.json'].sort(), 'Protected file paths must be an exact local allowlist')
  const runtimeFiles = ['backend/internal/migrations/target.go', 'backend/internal/migrations/manifest.json', 'docs/contracts/identity-phase.json']
  for (const [path, digest] of Object.entries(contract.baseline.protected_files)) {
    if (!runtimeFiles.includes(path)) assert.equal(sha(read(path)), digest, 'Activation/protected baseline changed: ' + path)
  }
  const migration = contract.migration
  assert.equal(migration.number, 6); assert.equal(migration.current_target, 6)
  assert.equal(migration.status, 'available_embedded'); assert.equal(migration.ddl_steps, 5)
  assert.deepEqual(Object.keys(migration.runtime_files).sort(), runtimeFiles.sort(), 'Exact migration-only runtime allowlist')
  for (const [path, digest] of Object.entries(migration.runtime_files)) assert.equal(sha(read(path)), digest, 'Migration runtime drift: ' + path)
  assert.match(read('backend/internal/migrations/target.go').toString('utf8'), /\bconst Target = 6\b/)
  assert.equal(migration.restore_target, 5); assert.equal(migration.down, 'empty_disposable_test_database_only')
  assert.deepEqual(migration.tables, ['documents', 'document_locations', 'document_chunks', 'document_parse_jobs', 'document_idempotency'])
  assert.deepEqual(Object.keys(migration.files).sort(), ['000006_documents.down.sql', '000006_documents.up.sql'])
  for (const [name, digest] of Object.entries(migration.files)) {
    assert.equal(sha(read(`${directory}/migration/${name}`)), digest, 'Reviewed SQL drift')
    assert.equal(sha(read(`backend/internal/migrations/sql/${name}`)), digest, 'Embedded SQL must be byte-identical to reviewed SQL')
  }
  assert.equal(migration.published_files.length, 10)
  for (const entry of migration.published_files) assert.deepEqual(Object.keys(entry).sort(), ['name', 'sha256'])
  const expectedManifest = { ...Object.fromEntries(migration.published_files.map(e => [e.name, e.sha256])), ...migration.files }
  assert.deepEqual(JSON.parse(read('backend/internal/migrations/manifest.json')), expectedManifest)
  assert.deepEqual([...names].sort(), Object.keys(expectedManifest).sort(), 'Exact twelve embedded SQL files')
  const phase = JSON.parse(read('docs/contracts/identity-phase.json'))
  assert.equal(phase.migrations.length, 6)
  assert.deepEqual(phase.migrations[5], { number: '000006', name: 'documents', owner: '04E', status: 'available',
    depends_on: ['000001','000002','000003','000004','000005'], checksum: migration.files['000006_documents.up.sql'], down_checksum: migration.files['000006_documents.down.sql'] })
  for (const { name, sha256: digest } of migration.published_files) assert.equal(sha(read(`backend/internal/migrations/sql/${name}`)), digest, 'Published SQL changed')
  const up = read(`${directory}/migration/000006_documents.up.sql`).toString('utf8')
  const down = read(`${directory}/migration/000006_documents.down.sql`).toString('utf8')
  assert.deepEqual([...up.matchAll(/CREATE TABLE IF NOT EXISTS ([a-z_]+) \(/g)].map(m => m[1]), migration.tables)
  assert.equal(up.split(';').filter(s => s.trim()).length, 5)
  assert.equal([...up.matchAll(/\) ENGINE=InnoDB;/g)].length, 5)
  assert.doesNotMatch(up, /\b(?:ALTER|DROP|INSERT|UPDATE|DELETE|TRIGGER|PROCEDURE)\b/i)
  assert.deepEqual([...down.matchAll(/DROP TABLE IF EXISTS ([a-z_]+);/g)].map(m => m[1]), [...migration.tables].reverse())
  assert.equal(down.split(';').filter(s => s.trim()).length, 5)
  for (const mandatory of [
    'idempotency_key VARBINARY(64) NOT NULL', 'original_digest BINARY(32) NOT NULL',
    'OCTET_LENGTH(original_bytes)=size_bytes', 'OCTET_LENGTH(body) BETWEEN 1 AND 2097152',
    "format='pdf' AND page_count IS NOT NULL AND page_count BETWEEN 1 AND 200", 'CHECK(attempts<=3)',
    'char_end-char_start<=2000 AND CHAR_LENGTH(quote)=char_end-char_start', 'execution_epoch>=1',
    'FOREIGN KEY(document_id,class_id,document_version) REFERENCES documents(id,class_id,version)',
    'FOREIGN KEY(document_id,class_id,document_version,unit) REFERENCES document_locations(document_id,class_id,document_version,unit)',
    'FOREIGN KEY(document_id,class_id,document_version,user_id) REFERENCES documents(id,class_id,version,created_by)',
    'JSON_VALID(CONVERT(response_body USING utf8mb4))',
  ]) assert.ok(up.includes(mandatory), 'Mandatory candidate constraint lost: ' + mandatory)
  assert.equal([...up.matchAll(/REFERENCES /g)].length, 6)
  assert.equal([...up.matchAll(/REFERENCES (?:classes|users|documents|document_locations)\(/g)].length, 6, 'No cross-schema FK')
}

// Semantic contract examples only, not a network client or a durable worker.
export function validatePrivateResultExample(result, format, status) {
  assert.ok(['pdf', 'docx'].includes(format))
  if (result.status === 'ready') {
    assert.equal(status, 200)
    assert.ok(result.body.isWellFormed(), 'DI-SC-05 body must be well-formed Unicode')
    assert.ok(format === 'pdf' ? Number.isInteger(result.source_page_count) : result.source_page_count === null)
    validateDocumentDetailExample({ document: { status: 'ready', format, page_count: result.source_page_count }, body: result.body, locations: result.locations })
  } else if (result.status === 'needs_ocr') {
    assert.equal(format, 'pdf'); assert.equal(status, 200)
  } else {
    assert.equal(result.status, 'failed')
    assert.ok(reasons.includes(result.failure_reason))
    assert.equal(status, reasons.indexOf(result.failure_reason) < 4 ? 422 : result.failure_reason === 'parse_timeout' ? 504 : 503)
  }
}

export function integrationFixtures() {
  const pdf = { status: 'ready', body: '课程😀\n\n第二页', locations: [
    { kind: 'pdf_page', unit: 1, char_start: 0, char_end: 3 }, { kind: 'pdf_page', unit: 2, char_start: 5, char_end: 8 },
  ], source_page_count: 2 }
  const word = { status: 'ready', body: '表格e\u0301', locations: [{ kind: 'docx_table_cell', unit: 3, char_start: 0, char_end: 4 }], source_page_count: null }
  const fixtures = [
    { name: 'DI-SC-03 Unicode PDF', data: pdf, format: 'pdf', status: 200, valid: true, semantic: true },
    { name: 'DI-SC-04 Word logical gap', data: word, format: 'docx', status: 200, valid: true, semantic: true },
    { name: 'DI-SC-06 scan', data: { status: 'needs_ocr', source_page_count: 2 }, format: 'pdf', status: 200, valid: true, semantic: true },
  ]
  for (const reason of reasons) fixtures.push({ name: 'DI-SC-06/14 ' + reason, data: { status: 'failed', failure_reason: reason }, format: 'pdf', status: reason === 'parse_timeout' ? 504 : reasons.indexOf(reason) < 4 ? 422 : 503, valid: true, semantic: true })
  for (const [name, mutate, structural] of [
    ['no body', x => delete x.body, false], ['extra owner', x => x.class_id = '2', false],
    ['empty locations', x => x.locations = [], false], ['zero page', x => x.source_page_count = 0, false],
    ['empty body', x => x.body = '', false], ['fake status', x => x.status = 'succeeded', false],
    ['UTF16 offset', x => x.locations[0].char_end = 4, true], ['overlap', x => x.locations[1].char_start = 2, true],
    ['wrong page', x => x.locations[1].unit = 3, true], ['wrong separator', x => x.body = '课程😀xx第二页', true],
    ['carriage return', x => x.body = '课程😀\r\n第二页', false],
    ['unpaired surrogate', x => x.body = '\ud800', false],
    ['NUL control', x => x.body = '\u0000', false],
  ]) { const data = structuredClone(pdf); mutate(data); fixtures.push({ name: 'DI-SC-05 ' + name, data, format: 'pdf', status: 200, valid: structural, semantic: false }) }
  fixtures.push({ name: 'DI-SC-04 no invented Word pages', data: { ...word, source_page_count: 1 }, format: 'docx', status: 200, valid: true, semantic: false })
  fixtures.push({ name: 'DI-SC-06 no partial scan body', data: { status: 'needs_ocr', source_page_count: 1, body: 'partial' }, format: 'pdf', status: 200, valid: false, semantic: false })
  fixtures.push({ name: 'DI-SC-14 failed is not HTTP200', data: { status: 'failed', failure_reason: 'corrupt' }, format: 'pdf', status: 200, valid: true, semantic: false })
  fixtures.push({ name: 'DI-SC-06 closed failed', data: { status: 'failed', failure_reason: 'encrypted', locations: [] }, format: 'pdf', status: 422, valid: false, semantic: false })
  fixtures.push({ name: 'DI-SC-06 unknown reason', data: { status: 'failed', failure_reason: 'RETRY_EXHAUSTED' }, format: 'pdf', status: 422, valid: false, semantic: false })
  fixtures.push({ name: 'DI-SC-06 Schema body codepoint upper bound', data: { ...pdf, body: 'x'.repeat(2097153) }, format: 'pdf', status: 200, valid: false, semantic: false })
  for (const [name, body, accepted] of [['UTF8 exactly 2MiB', '中'.repeat(699050) + 'ab', true], ['UTF8 one byte over', '中'.repeat(699051), false]]) {
    fixtures.push({ name: 'DI-SC-06 ' + name, data: { status: 'ready', body, locations: [{ kind: 'pdf_page', unit: 1, char_start: 0, char_end: body.length }], source_page_count: 1 }, format: 'pdf', status: 200, valid: true, semantic: accepted })
  }
  return fixtures
}

const stripIds = value => Array.isArray(value) ? value.map(stripIds) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== '$id').map(([k, v]) => [k, stripIds(v)])) : value

export async function validatePrivateOpenApi(api = json(`${directory}/openapi.json`)) {
  const normalize = name => {
    const path = (name.startsWith('file:') ? fileURLToPath(name) : name).replaceAll('\\', '/')
    return process.platform === 'win32' && /^[a-z]:\//i.test(path) ? path.toLowerCase() : path
  }
  const allowed = new Map([[normalize(resolve(directory, 'openapi.json')), api]])
  for (const file of ['docs/contracts/schemas/DocumentLocation.schema.json', ...['ParseResult', 'Error', 'Health'].map(n => `${directory}/${n}.schema.json`)]) {
    const schema = json(file)
    allowed.set(normalize(resolve(file)), schema)
    allowed.set(schema.$id, schema)
  }
  return SwaggerParser.validate(resolve(directory, 'openapi.json'), { resolve: {
    file: false, http: false,
    localOnly: { order: 1, canRead: () => true, read: file => {
      const schema = allowed.get(file.url) ?? allowed.get(normalize(file.url))
      assert.ok(schema, 'DI-SC-14 reference outside explicit local Schema allowlist')
      return JSON.stringify(schema)
    } },
  }, dereference: { circular: false } })
}

export async function validateDocumentIntegration() {
  const contract = json('docs/contracts/document-integration.json')
  validateIntegrationProfile(contract, json('docs/contracts/config-register.json'))
  const location = json('docs/contracts/schemas/DocumentLocation.schema.json')
  const schemas = [location, ...['ParseResult', 'Error', 'Health'].map(n => json(`${directory}/${n}.schema.json`))]
  const api = json(`${directory}/openapi.json`)
  assert.equal(api.openapi, '3.1.0'); assert.equal(api.jsonSchemaDialect, 'https://json-schema.org/draft/2020-12/schema')
  assert.deepEqual(api.servers, [{ url: contract.network.origin }]); assert.deepEqual(api.security, [{ ParserBearer: [] }])
  assert.deepEqual(api.components.securitySchemes, { ParserBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'canonical base64url encoding of 32 random bytes' } })
  assert.deepEqual(Object.keys(api.paths), ['/health', '/v1/parse'])
  for (const [path, method, statuses] of [['/health', 'get', [200, 400, 401, 404, 405]], ['/v1/parse', 'post', [200, 400, 401, 404, 405, 422, 503, 504]]]) {
    assert.deepEqual(Object.keys(api.paths[path]), [method])
    const op = api.paths[path][method]
    assert.equal(op['x-contract-status'], 'frozen')
    assert.equal(op.security, undefined, 'Private operations must inherit required bearer auth')
    assert.equal(op.servers, undefined, 'Private operations cannot override the fixed internal origin')
    assert.equal(op.parameters, undefined, 'No URL/path/class/identity or other extra parameters')
    assert.equal(op.callbacks, undefined)
    assert.deepEqual(Object.keys(op.responses).sort(), statuses.map(String).sort())
    for (const response of Object.values(op.responses)) assert.equal(response.headers['Cache-Control'].schema.const, 'no-store')
  }
  assert.deepEqual(Object.keys(api.paths['/v1/parse'].post.requestBody.content), ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
  assert.equal(api.paths['/v1/parse'].post.requestBody.required, true)
  assert.equal(api.paths['/health'].get.requestBody, undefined)
  for (const media of Object.values(api.paths['/v1/parse'].post.requestBody.content)) assert.deepEqual(media.schema, { type: 'string', format: 'binary' })
  const source = new Ajv2020({ strict: true, strictRequired: false, allErrors: true })
  schemas.forEach(s => source.addSchema(s))
  const parsed = await validatePrivateOpenApi(api)
  const dereferenced = new Ajv2020({ strict: true, strictRequired: false, allErrors: true })
  const checkSource = source.getSchema(schemas[1].$id)
  const checkDeref = dereferenced.compile(stripIds(parsed.components.schemas.ParseResult))
  const fixtures = integrationFixtures()
  for (const f of fixtures) {
    assert.equal(checkSource(f.data), f.valid, 'Private Schema: ' + f.name + JSON.stringify(checkSource.errors))
    assert.equal(checkDeref(f.data), f.valid, 'Private OpenAPI: ' + f.name + JSON.stringify(checkDeref.errors))
    if (f.valid) {
      if (f.semantic) validatePrivateResultExample(f.data, f.format, f.status)
      else assert.throws(() => validatePrivateResultExample(f.data, f.format, f.status), undefined, f.name)
    }
  }
  // Every documented HTTP response must actually enforce its outcome/status.
  for (const status of [200, 422, 503, 504]) {
    const responseCheck = new Ajv2020({ strict: true, strictRequired: false }).compile(stripIds(parsed.paths['/v1/parse'].post.responses[status].content['application/json'].schema))
    for (const f of fixtures.filter(f => f.valid && f.semantic)) assert.equal(responseCheck(f.data), status === f.status, 'Private response outcome/status mismatch: ' + f.name)
  }
  for (const [name, cases] of [
    ['Error', [[{ error: 'busy' }, true], [{ error: 'invalid_request' }, true], [{ error: 'raw exception' }, false], [{ error: 'busy', body: 'leak' }, false], [{}, false]]],
    ['Health', [[{ status: 'ok' }, true], [{ status: 'ok', dependencies: {} }, false], [{ status: 'busy' }, false], [{}, false]]],
  ]) {
    const a = source.getSchema(schemas.find(s => s.title === (name === 'Error' ? 'PrivateParserError' : 'PrivateParserHealth')).$id)
    const b = new Ajv2020({ strict: true }).compile(stripIds(parsed.components.schemas[name]))
    for (const [value, valid] of cases) { assert.equal(a(value), valid); assert.equal(b(value), valid) }
  }
  for (const [status, error] of [[400, 'invalid_request'], [401, 'unauthenticated'], [404, 'not_found'], [405, 'method_not_allowed']]) {
    const check = new Ajv2020({ strict: true, strictRequired: false }).compile(stripIds(parsed.paths['/health'].get.responses[status].content['application/json'].schema))
    for (const value of ['invalid_request', 'unauthenticated', 'not_found', 'method_not_allowed', 'busy']) assert.equal(check({ error: value }), value === error)
  }
  console.log(`DI-SC-02..06/14/15: ${fixtures.length} private dual-path cases; frozen RPC/config, exact embedded migration6; no parser runtime activation.`)
}
