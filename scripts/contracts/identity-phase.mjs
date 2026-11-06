import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'

// ICF-01..03: freezing a future contract must not activate the runtime early.
// The identity implementation must deliberately replace this phase guard with
// runtime/probe/config integration checks in the same reviewed change.
export function validateIdentityPhase(api, config, phase, exists = existsSync) {
  assert.equal(phase.version, 1)
  assert.equal(phase.current_phase, 'skeleton', 'Identity runtime activation requires a reviewed atomic migration')
  assert.equal(phase.frozen_phase, 'identity')
  assert.ok(exists(phase.introduced_by) && exists(phase.activation_change))
  assert.deepEqual(config.active.map(x => x.name), ['HTTP_PORT'], 'Frozen keys are not active configuration')
  assert.equal(config.planned.some(x => x.owner === '01'), false)
  const expected = ['MYSQL_DSN', 'MYSQL_MIGRATION_DSN', 'MYSQL_CA_FILE', 'AUTH_TRUSTED_ORIGIN', 'AUTH_TRUSTED_PROXY_CIDRS', 'HTTPS_CERT_FILE', 'HTTPS_KEY_FILE']
  assert.deepEqual(phase.config_keys, expected)
  assert.deepEqual(config.frozen.map(x => x.name), expected, 'Seven frozen identity keys must remain unique and complete')
  for (const entry of config.frozen) {
    assert.equal(entry.owner, '01')
    assert.equal(entry.required, true)
    assert.equal(entry.introduced_by, phase.introduced_by)
    assert.equal(entry.activation_change, phase.activation_change)
    assert.equal(entry.secret, ['MYSQL_DSN', 'MYSQL_MIGRATION_DSN', 'HTTPS_KEY_FILE'].includes(entry.name))
    assert.ok(entry.consumers.length && new Set(entry.consumers).size === entry.consumers.length)
    for (const field of ['validation', 'missing_behavior', 'timeout']) assert.ok(entry[field]?.trim(), `Missing ${entry.name}.${field}`)
  }
  assert.deepEqual(config.frozen.find(x => x.name === 'MYSQL_MIGRATION_DSN').consumers, ['migration', 'initializer'])
  const health = api.paths['/health'].get
  assert.deepEqual(health.security, [])
  assert.deepEqual(Object.keys(health.responses), ['200'], 'Skeleton health must not advertise a live database')
  assert.deepEqual(health.responses['200'].content['application/json'].schema, { $ref: './schemas/Health.schema.json' })
  assert.deepEqual(phase.health, {
    path: '/health', method: 'get', anonymous: true, probe_timeout_ms: 3000,
    success_schema: 'IdentityHealthUp', failure_schema: 'IdentityHealthDown',
    success_status: 200, failure_status: 503,
    probe: '每次请求真实MySQL Ping；超时或失败统一down，不缓存成功、不回退空依赖',
  })
  const future = health['x-frozen-identity-profile']
  assert.equal(future.activation_change, phase.activation_change)
  assert.deepEqual(future.security, [])
  assert.deepEqual(Object.keys(future.responses), ['200', '503'])
  for (const [code, schema] of [[200, phase.health.success_schema], [503, phase.health.failure_schema]]) {
    assert.deepEqual(future.responses[code].content['application/json'].schema, { $ref: `#/components/schemas/${schema}` })
  }
  const names = ['identity_users_classes', 'identity_sessions', 'identity_auth_audit']
  assert.equal(phase.migrations.length, names.length)
  phase.migrations.forEach((migration, i) => {
    assert.deepEqual(migration, {
      number: String(i + 1).padStart(6, '0'), name: names[i], owner: '01', status: 'reserved',
      depends_on: names.slice(0, i).map((_, n) => String(n + 1).padStart(6, '0')), checksum: null,
    }, 'Reserved migration numbers are not applied SQL or invented checksums')
  })
}
