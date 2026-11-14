import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { validateIntegrationProfile, validatePrivateConfigExample, validateDocumentIntegration, validatePrivateOpenApi } from './document-integration.mjs'

const json = p => JSON.parse(readFileSync(p, 'utf8'))
const contract = () => json('docs/contracts/document-integration.json')
const register = () => json('docs/contracts/config-register.json')

test('DI-SC-14 canonical exact internal URL and random token examples; no runtime config reads', () => {
  const good = { DOCUMENT_PARSER_URL: 'http://document-parser:8091', DOCUMENT_PARSER_TOKEN: randomBytes(32).toString('base64url') }
  validatePrivateConfigExample(good)
  for (const url of ['', ' http://document-parser:8091', 'http://document-parser:8091/', 'https://document-parser:8091',
    'http://document-parser.evil:8091', 'http://user@document-parser:8091', 'http://127.0.0.1:8091', 'http://document-parser:8091?x=1']) {
    assert.throws(() => validatePrivateConfigExample({ ...good, DOCUMENT_PARSER_URL: url }))
  }
  for (const token of ['', ' ', good.DOCUMENT_PARSER_TOKEN + '=', ' ' + good.DOCUMENT_PARSER_TOKEN,
    'a'.repeat(42), 'a'.repeat(44), 'a'.repeat(42) + 'B', 'é'.repeat(43)]) {
    assert.throws(() => validatePrivateConfigExample({ ...good, DOCUMENT_PARSER_TOKEN: token }))
  }
  const missing = { ...good }; delete missing.DOCUMENT_PARSER_TOKEN
  assert.throws(() => validatePrivateConfigExample(missing))
})

test('DI-SC-01/14 replay before dependency preflight, bounded RPC and no activation cannot drift', () => {
  validateIntegrationProfile(contract(), register())
  for (const mutate of [c => c.runtime_activation = true, c => c.network.host_ports = true, c => c.network.egress = true,
    c => c.network.environment_proxy = true, c => c.rpc.total_ms = 36000, c => c.rpc.response_bytes++,
    c => c.rpc.concurrency = 2, c => c.rpc.upload_order.reverse(), c => c.worker.publish_cas.pop(),
    c => c.worker.max_attempts = 4, c => c.migration.current_target = 5, c => c.migration.restore_target = 4,
    c => c.migration.status = 'frozen_not_embedded', c => delete c.migration.runtime_files]) {
    const candidate = contract(); mutate(candidate); assert.throws(() => validateIntegrationProfile(candidate, register()))
  }
  const activated = register(); activated.active.push(activated.frozen[0])
  assert.throws(() => validateIntegrationProfile(contract(), activated))
  assert.throws(() => validateIntegrationProfile(contract(), register(), undefined, ['000006_documents.up.sql']))
})

test('DI-SC-15 candidate exact DDL/hash and composite owner/location FKs remain guarded', () => {
  const path = 'docs/contracts/document-parser/migration/000006_documents.up.sql'
  const original = readFileSync(path)
  for (const [before, after] of [['VARBINARY(64)', 'VARCHAR(64)'], ['CHECK(attempts<=3)', 'CHECK(attempts<=4)'],
    ['REFERENCES documents(id,class_id,version,created_by)', 'REFERENCES documents(id,class_id,version,id)'],
    ['REFERENCES document_locations(', 'REFERENCES foreign_db.document_locations('], ['page_count IS NOT NULL', '1=1']]) {
    const changed = Buffer.from(original.toString('utf8').replaceAll(before, after)); assert.notDeepEqual(changed, original)
    const read = p => p === path ? changed : readFileSync(p)
    assert.throws(() => validateIntegrationProfile(contract(), register(), read), 'Hash drift must block')
    const refreshed = contract(); refreshed.migration.files['000006_documents.up.sql'] = createHash('sha256').update(changed).digest('hex')
    assert.throws(() => validateIntegrationProfile(refreshed, register(), read), 'Critical DDL cannot be weakened by rehashing')
  }
})

test('DI-SC-02..06/14 private Schema/OpenAPI dual paths and semantic failures', async () => {
  await validateDocumentIntegration()
})

test('DI-SC-15 exact6 runtime metadata cannot weaken old SQL, entry-point target or restore boundary by rehashing', () => {
  for (const [path, mutate] of [
    ['backend/internal/migrations/target.go', s => s.replace('const Target = 6', 'const Target = 5')],
    ['backend/internal/migrations/manifest.json', s => { const m = JSON.parse(s); m['000001_identity_users_classes.up.sql'] = '0'.repeat(64); return JSON.stringify(m) }],
    ['docs/contracts/identity-phase.json', s => { const p = JSON.parse(s); p.migrations[5].owner = '05'; return JSON.stringify(p) }],
  ]) {
    const changed = Buffer.from(mutate(readFileSync(path, 'utf8')))
    const c = contract(); c.migration.runtime_files[path] = createHash('sha256').update(changed).digest('hex')
    assert.throws(() => validateIntegrationProfile(c, register(), name => name === path ? changed : readFileSync(name)))
  }
  const c = contract(); c.migration.runtime_files['.env'] = '0'.repeat(64)
  const reads = []
  assert.throws(() => validateIntegrationProfile(c, register(), name => { reads.push(name); return readFileSync(name) }))
  assert.ok(!reads.includes('.env'), 'Unknown migration runtime path rejected before read')
})

test('DI-SC-15 migration runtime SHA binds portable LF bytes even when CRLF is rehashed locally', () => {
  for (const path of Object.keys(contract().migration.runtime_files)) {
    const original = readFileSync(path)
    assert.ok(!original.includes(13))
    const crlf = Buffer.from(original.toString('utf8').replaceAll('\n', '\r\n'))
    const c = contract(); c.migration.runtime_files[path] = createHash('sha256').update(crlf).digest('hex')
    assert.throws(() => validateIntegrationProfile(c, register(), name => name === path ? crlf : readFileSync(name)))
  }
})

test('DI-SC-14 contract references cannot fetch URLs or escape local Schema files', async () => {
  for (const path of ['.env', '../.env']) {
    const candidate = contract(); delete candidate.baseline.protected_files['.env.example']; candidate.baseline.protected_files[path] = '0'.repeat(64)
    const reads = []
    assert.throws(() => validateIntegrationProfile(candidate, register(), name => { reads.push(name); return readFileSync(name) }))
    assert.ok(!reads.includes(path), 'Unknown protected path must be rejected before reading it')
  }
  for (const ref of ['https://example.invalid/source.json', '../../.env', '../config-register.json', 'file:///etc/passwd']) {
    const api = json('docs/contracts/document-parser/openapi.json')
    api.components.schemas.ParseResult = { $ref: ref }
    await assert.rejects(validatePrivateOpenApi(api))
  }
})
