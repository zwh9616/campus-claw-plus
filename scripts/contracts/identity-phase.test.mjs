import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateIdentityPhase } from './identity-phase.mjs'
const read=n=>JSON.parse(readFileSync(`docs/contracts/${n}`,'utf8'))
const fixture=()=>[read('openapi.yaml'),read('config-register.json'),read('identity-phase.json')]
const reject=changes=>{for(const change of changes){const v=fixture();change(...v);assert.throws(()=>validateIdentityPhase(...v),change.toString())}}
test('ICF-SC-01/02 active identity health is unique and anonymous; no skeleton fallback',()=>{
 validateIdentityPhase(...fixture())
 reject([
  (a,c,p)=>p.current_phase='skeleton',
  a=>a.paths['/health'].get.responses['200'].content['application/json'].schema={$ref:'./schemas/Health.schema.json'},
  a=>delete a.paths['/health'].get.responses['503'],
  a=>a.paths['/health'].get.security=[{BearerAuth:[]}],
  a=>a.paths['/health'].get.responses['503'].content['application/json'].schema.$ref='#/components/schemas/Error',
  (a,c,p)=>p.health.probe_timeout_ms=5000,
  (a,c,p)=>p.health.failure_status=200,
 ])
})
test('ICF-SC-03/04 activation preserves required, process-separated secret metadata',()=>{
 const key=(c,n)=>c.active.find(e=>e.name===n)
 reject([
  (a,c)=>c.frozen.push(c.active.pop()),
  (a,c)=>c.active.pop(),
  (a,c)=>c.active[1]=structuredClone(c.active[0]),
  (a,c)=>key(c,'MYSQL_DSN').secret=false,
  (a,c)=>key(c,'MYSQL_MIGRATION_DSN').consumers.push('backend'),
  (a,c)=>key(c,'AUTH_TRUSTED_ORIGIN').required=false,
  (a,c)=>key(c,'AUTH_TRUSTED_PROXY_CIDRS').validation='',
  (a,c)=>key(c,'HTTPS_CERT_FILE').missing_behavior='',
  (a,c)=>key(c,'HTTPS_KEY_FILE').timeout='',
  (a,c,p)=>p.activation_change='openspec/changes/unapproved',
 ])
 assert.throws(()=>validateIdentityPhase(...fixture(),()=>false))
})
test('ICF-SC-05/06 available SQL rejects duplicates, forward dependencies and false deployment claims',()=>{
 reject([
  (a,c,p)=>p.migrations[1].number='000001',
  (a,c,p)=>p.migrations[0].depends_on=['000003'],
  (a,c,p)=>p.migrations[2].depends_on.pop(),
  (a,c,p)=>p.migrations[0].status='applied',
  (a,c,p)=>p.migrations[0].checksum='0'.repeat(64),
  (a,c,p)=>p.migrations[0].down_checksum='0'.repeat(64),
 ])
})
