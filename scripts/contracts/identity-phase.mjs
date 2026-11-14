import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

// IDF-SC-14/17/18: one active runtime/config/health contract, no fallback.
export function validateIdentityPhase(api, config, phase, exists = existsSync) {
 assert.equal(phase.version,1)
 assert.equal(phase.current_phase,'identity')
 assert.equal(phase.previous_phase,'skeleton')
 assert.equal(phase.frozen_phase,undefined)
 assert.ok(exists(phase.introduced_by)&&exists(phase.activation_change))
 const identity=['MYSQL_DSN','MYSQL_MIGRATION_DSN','MYSQL_CA_FILE','AUTH_TRUSTED_ORIGIN','AUTH_TRUSTED_PROXY_CIDRS','HTTPS_CERT_FILE','HTTPS_KEY_FILE']
 const wiring=['IDENTITY_STATE_DIR','IDENTITY_PROXY_NETWORK','IDENTITY_PROXY_IP','IDENTITY_HTTPS_HOST','IDENTITY_HTTPS_PORT']
 assert.deepEqual(phase.config_keys,[...identity,...wiring])
 assert.deepEqual(config.active.map(x=>x.name),['HTTP_PORT',...identity,...wiring])
 // DI-SC-01/14: only the two reviewed 04E candidates may freeze; active keys,
 // identity health and migration target remain exact and unchanged below.
 assert.deepEqual(config.frozen.map(e=>e.name),['DOCUMENT_PARSER_URL','DOCUMENT_PARSER_TOKEN'])
 for(const e of config.frozen){
  assert.equal(e.owner,'04E');assert.equal(e.status,'frozen');assert.equal(e.required,true)
  assert.equal(e.introduced_by,'openspec/changes/2026-11-13-materials-document-intelligence')
  assert.equal(e.secret,e.name==='DOCUMENT_PARSER_TOKEN')
 }
 assert.equal(config.planned.some(x=>x.owner==='01'),false)
 for(const e of config.active.slice(1)){
  assert.equal(e.owner,'01');assert.equal(e.required,true)
  assert.equal(e.activation_change,phase.activation_change)
  assert.equal(e.introduced_by,identity.includes(e.name)?phase.introduced_by:phase.activation_change)
  assert.equal(e.secret,['MYSQL_DSN','MYSQL_MIGRATION_DSN','HTTPS_KEY_FILE'].includes(e.name))
  assert.ok(e.consumers.length&&new Set(e.consumers).size===e.consumers.length)
  for(const f of ['validation','missing_behavior','timeout'])assert.ok(e[f]?.trim())
 }
 assert.deepEqual(config.active.find(x=>x.name==='MYSQL_MIGRATION_DSN').consumers,['migration','initializer'])
 const h=api.paths['/health'].get
 assert.deepEqual(h.security,[]);assert.equal(h['x-frozen-identity-profile'],undefined)
 assert.deepEqual(Object.keys(h.responses),['200','503'])
 assert.deepEqual(phase.health,{path:'/health',method:'get',anonymous:true,probe_timeout_ms:3000,success_schema:'IdentityHealthUp',failure_schema:'IdentityHealthDown',success_status:200,failure_status:503,probe:'每次请求真实MySQL Ping；超时或失败统一down，不缓存成功、不回退空依赖'})
 for(const [code,schema] of [[200,'IdentityHealthUp'],[503,'IdentityHealthDown']])assert.deepEqual(h.responses[code].content['application/json'].schema,{$ref:`#/components/schemas/${schema}`})
 const names=['identity_users_classes','identity_sessions','identity_auth_audit','materials_retrieval','assignment_tasks','documents']
 assert.equal(phase.migrations.length,names.length)
 const manifest=JSON.parse(readFileSync('backend/internal/migrations/manifest.json','utf8'))
 phase.migrations.forEach((m,i)=>{
  assert.equal(m.number,String(i+1).padStart(6,'0'));assert.equal(m.name,names[i]);assert.equal(m.owner,i===5?'04E':i===4?'05':i===3?'04':'01')
  assert.equal(m.status,'available') // Embedded SQL, never a global deployment claim.
  assert.deepEqual(m.depends_on,names.slice(0,i).map((_,n)=>String(n+1).padStart(6,'0')))
  for(const direction of ['up','down']){
   const name=`${m.number}_${m.name}.${direction}.sql`,path=`backend/internal/migrations/sql/${name}`
   assert.ok(exists(path));const hash=createHash('sha256').update(readFileSync(path)).digest('hex')
   assert.equal(manifest[name],hash);assert.equal(m[direction==='up'?'checksum':'down_checksum'],hash)
  }
 })
}
