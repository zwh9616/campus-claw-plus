import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateIdentityPhase } from './identity-phase.mjs'
const read = name => JSON.parse(readFileSync(`docs/contracts/${name}`, 'utf8'))
const fixture = () => [read('openapi.yaml'), read('config-register.json'), read('identity-phase.json')]
const reject = mutations => {
  for (const mutate of mutations) {
    const values = fixture(); mutate(...values)
    assert.throws(() => validateIdentityPhase(...values), mutate.toString())
  }
}
test('ICF-SC-01/02 only skeleton is active; future health is complete and anonymous', () => {
  validateIdentityPhase(...fixture())
  reject([
    (a, c, p) => p.current_phase = 'identity',
    a => a.paths['/health'].get.responses['200'].content['application/json'].schema = { $ref: '#/components/schemas/IdentityHealthUp' },
    a => a.paths['/health'].get.responses['503'] = {},
    a => a.paths['/health'].get['x-frozen-identity-profile'].security = [{ bearerAuth: [] }],
    a => delete a.paths['/health'].get['x-frozen-identity-profile'].responses['503'],
    a => a.paths['/health'].get['x-frozen-identity-profile'].responses['503'].content['application/json'].schema.$ref = '#/components/schemas/Error',
    (a, c, p) => p.health.probe_timeout_ms = 5000,
    (a, c, p) => p.health.failure_status = 200,
  ])
})
test('ICF-SC-03/04 frozen configuration cannot leak into active samples or lose safety metadata', () => {
  reject([
    (a, c) => c.active.push(c.frozen[0]),
    (a, c) => c.frozen.pop(),
    (a, c) => c.frozen[1] = structuredClone(c.frozen[0]),
    (a, c) => c.frozen[0].secret = false,
    (a, c) => c.frozen[1].consumers.push('backend'),
    (a, c) => c.frozen[3].required = false,
    (a, c) => c.frozen[4].validation = '',
    (a, c) => c.frozen[5].missing_behavior = '',
    (a, c) => c.frozen[6].timeout = '',
    (a, c, p) => p.activation_change = 'openspec/changes/unapproved',
  ])
  assert.throws(() => validateIdentityPhase(...fixture(), () => false))
})
test('ICF-SC-05/06 migration reservations reject duplicate numbers, forward dependencies and false evidence', () => {
  reject([
    (a, c, p) => p.migrations[1].number = '000001',
    (a, c, p) => p.migrations[0].depends_on = ['000003'],
    (a, c, p) => p.migrations[2].depends_on.pop(),
    (a, c, p) => p.migrations[0].status = 'applied',
    (a, c, p) => p.migrations[0].checksum = '0'.repeat(64),
  ])
})
