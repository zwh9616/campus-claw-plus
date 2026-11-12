import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { validateOperationBoundary } from './validate.mjs'
import { assignmentOperations, submissionDigestExample, validateAssignmentRequestExample, validateAssignmentPageExample, validateTaskExample } from './assignments.mjs'

const api=parse(readFileSync('docs/contracts/openapi.yaml','utf8'))
const register=JSON.parse(readFileSync('docs/contracts/endpoint-register.json','utf8'))
const fixtures=JSON.parse(readFileSync('docs/contracts/fixtures/assignment-semantic-cases.json','utf8'))
const vectors=JSON.parse(readFileSync('docs/contracts/fixtures/assignment-digest-cases.json','utf8'))
const copy=value=>structuredClone(value)
const submit=a=>a.paths['/api/v1/assignments/{id}/submissions'].post
const retry=a=>a.paths['/api/v1/tasks/{id}/retry'].post
const cancel=a=>a.paths['/api/v1/tasks/{id}/cancel'].post
const task=a=>a.paths['/api/v1/tasks/{id}'].get
function rejects(mutate){const bad=copy(api);mutate(bad);assert.throws(()=>validateOperationBoundary(bad,register))}

test('AT-SC-01 nine business operations stay frozen while reviewed migration5 is available',()=>{
 validateOperationBoundary(api,register)
 assert.equal(register.operations.filter(o=>o.status==='current').length,13)
 const phase=JSON.parse(readFileSync('docs/contracts/identity-phase.json','utf8'))
 assert.deepEqual(phase.migrations.map(m=>m.number),['000001','000002','000003','000004','000005'])
 assert.equal(register.operations.filter(o=>o.owner==='05'&&o.status==='frozen').length,9)
 for(const [m,p] of assignmentOperations)rejects(a=>a.paths[p][m.toLowerCase()]['x-contract-status']='current')
 for(const mutate of [a=>delete a.paths['/api/v1/tasks/{id}'],a=>a.paths['/api/v1/assignments'].delete=copy(submit(a))])rejects(mutate)
 for(const mutate of [r=>r.operations.pop(),r=>r.operations.find(o=>o.owner==='05').owner='08',r=>r.operations.find(o=>o.owner==='05').introduced_by='openspec/changes/unknown']){const bad=copy(register);mutate(bad);assert.throws(()=>validateOperationBoundary(api,bad))}
})

test('AT-SC-02/03/08 actions, owner chain and original class precede all business conditions',()=>{
 for(const mutate of [
  a=>submit(a).security=[],a=>submit(a).security=[{RefreshCookie:[]}],
  a=>submit(a)['x-authorization'].roles=['teacher'],a=>retry(a)['x-authorization'].roles.push('teacher'),
  a=>task(a)['x-authorization'].student_visibility='all-in-current-class',
  a=>task(a)['x-authorization'].class_scope='client-query',
  a=>task(a)['x-authorization'].other_student='403',
  a=>task(a)['x-authorization'].cross_class='403',
  a=>task(a)['x-authorization'].order.reverse(),
  a=>task(a)['x-authorization'].rejected_business_side_effects=true,
  a=>task(a)['x-resource-chain']=['task'],
 ])rejects(mutate)
})

test('AT-SC-04 input framing, exact parameters, independent quota and error responses stay closed',()=>{
 for(const mutate of [
  a=>submit(a).parameters.find(p=>p.name==='Idempotency-Key').required=false,
  a=>submit(a).parameters.find(p=>p.name==='Origin').required=true,
  a=>submit(a).parameters.push({name:'class_id',in:'query',schema:{type:'string'}}),
  a=>submit(a)['x-body-limits'].bytes++,a=>submit(a)['x-body-limits'].declared_and_streamed=false,
  a=>submit(a)['x-body-limits'].duplicate_json_keys='last-wins',
  a=>submit(a)['x-request-rules'].duplicate_parameters='first-wins',
  a=>submit(a)['x-rate-limit'].bucket='04-write',a=>submit(a)['x-rate-limit'].scope='session_id',
  a=>submit(a)['x-rate-limit'].switch_class_resets=true,
  a=>submit(a).responses['429'].headers['Retry-After'].schema.minimum=0,
  a=>task(a).responses['404'].content['application/json'].examples.NOT_FOUND.value.error.message='another student exists',
  a=>task(a).responses['200'].headers['Cache-Control'].schema.const='public',
  a=>delete task(a).responses['503'],a=>task(a).responses['504']=copy(task(a).responses['200']),
  a=>task(a).responses['405'].headers.Allow.schema.const='GET, POST',
 ])rejects(mutate)
})

test('AT-SC-05..08 only committed authorized same-payload records replay the original 202 before new conditions',()=>{
 for(const mutate of [
  a=>submit(a)['x-idempotency'].scope=['Idempotency-Key'],
  a=>submit(a)['x-idempotency'].authorization_before_lookup=false,
  a=>submit(a)['x-idempotency'].committed_only=false,
  a=>submit(a)['x-idempotency'].same_payload=200,
  a=>submit(a)['x-idempotency'].replay='current-task-state',
  a=>submit(a)['x-idempotency'].before_new_conditions=['quota'],
  a=>submit(a)['x-idempotency'].atomic.pop(),
  a=>submit(a)['x-idempotency'].retention='ttl-60-seconds',
  a=>submit(a)['x-idempotency'].new_deadline='db_now <= deadline',
  a=>submit(a)['x-rate-limit'].committed_replays_count=true,
  a=>submit(a)['x-rate-limit'].idempotency_conflicts_count=true,
  a=>submit(a).responses['409']['x-error-codes']=['CONFLICT'],
 ])rejects(mutate)
})

test('AT-SC-06 canonical payload bytes and digest match five independently generated Go vectors',()=>{
 assert.equal(vectors.length,5)
 for(const v of vectors){
  const value=JSON.parse(v.raw),equivalent=JSON.parse(v.equivalent_raw)
  assert.deepEqual(equivalent,value)
  assert.deepEqual(submissionDigestExample(value),{canonical:v.canonical,sha256:v.sha256},v.name)
  assert.deepEqual(submissionDigestExample(equivalent),{canonical:v.canonical,sha256:v.sha256},v.name+' equivalent escaping/order')
 }
 assert.notEqual(submissionDigestExample({answer:'a\r\nb',assignment_version:1}).sha256,submissionDigestExample({answer:'a\nb',assignment_version:1}).sha256)
 assert.notEqual(submissionDigestExample({answer:' a ',assignment_version:1}).sha256,submissionDigestExample({answer:'a',assignment_version:1}).sha256)
 assert.notEqual(vectors[0].sha256,vectors[4].sha256)
 assert.throws(()=>submissionDigestExample({answer:'\ud800',assignment_version:1}))
})

test('AT-SC-04 request byte cap is distinct from codepoint cap; deadline equality fails',()=>{
 const value={answer:'𠮷'.repeat(16000),assignment_version:1},raw=JSON.stringify(value)
 const max=raw+' '.repeat(65536-Buffer.byteLength(raw,'utf8'))
 validateAssignmentRequestExample(value,max)
 assert.throws(()=>validateAssignmentRequestExample(value,max+' '))
 assert.throws(()=>validateAssignmentRequestExample({answer:'𠮷'.repeat(20000),assignment_version:1}))
 validateAssignmentRequestExample({answer:' ',assignment_version:1})
 validateAssignmentRequestExample(fixtures.AssignmentCreateRequest)
 assert.throws(()=>validateAssignmentRequestExample({...fixtures.AssignmentCreateRequest,deadline:'2026-11-12T08:00:00.000Z'}))
 assert.throws(()=>validateAssignmentRequestExample({...fixtures.AssignmentCreateRequest,title:'\u0085\u3000'}))
})

test('AT-SC-02/03 consistent pages sort created time before exact string ID tie-breaks',()=>{
 const base=fixtures.Assignment
 const newer={...base,id:'9007199254740992',created_at:'2026-11-12T08:00:01.000Z'}
 const older={...base,id:'9007199254740993'}
 const page={items:[newer,older],page:1,page_size:2,total:2}
 validateAssignmentPageExample(page)
 validateAssignmentPageExample({items:[older,{...older,id:'9007199254740992'}],page:1,page_size:2,total:2})
 validateAssignmentPageExample({items:[],page:2147483647,page_size:50,total:2})
 for(const bad of [{...page,items:[older,newer]},{...page,items:[newer,newer]},{...page,total:1},{...page,items:[newer]}])assert.throws(()=>validateAssignmentPageExample(bad))
})

test('AT-SC-09..19 task mechanism declarations forbid fake production execution, stale CAS and cancellation revival',()=>{
 for(const mutate of [
  a=>a['x-assignment-task-contract'].production_executor='mock-success',
  a=>a['x-assignment-task-contract'].production_mock_switch=true,
  a=>a['x-assignment-task-contract'].max_claims=4,
  a=>a['x-assignment-task-contract'].lease_seconds=61,
  a=>a['x-assignment-task-contract'].worker_cas.pop(),
  a=>a['x-assignment-task-contract'].worker_cas.splice(2,1),
  a=>a['x-assignment-task-contract'].success_requires_cancel_requested=true,
  a=>a['x-assignment-task-contract'].manual_retry_resets_attempt=true,
  a=>a['x-assignment-task-contract'].terminal_transaction.pop(),
  a=>a['x-assignment-task-contract'].network_inside_transaction=true,
  a=>a['x-assignment-task-contract'].expired_cancel_requested='pending',
  a=>a['x-assignment-task-contract'].failure_after_cancel='pending',
  a=>retry(a)['x-task-action'].attempt_increment=true,
  a=>retry(a)['x-task-action'].version_before_state=false,
  a=>cancel(a)['x-task-action'].terminal_before_version=false,
  a=>cancel(a)['x-task-action'].running='cancelled-immediately',
  a=>cancel(a)['x-task-action'].success_after_cancel='allowed',
  a=>cancel(a).responses['200'].content['application/json'].examples.pending_cancelled.value.status='pending',
  a=>retry(a).responses['200'].content['application/json'].examples.contract.value.attempt=0,
 ])rejects(mutate)
})

test('AT-SC-09/13..18 Task snapshots preserve safe errors, counts, version and cancellation flags',()=>{
 const base=fixtures.Task
 validateTaskExample(base)
 const failed={...base,status:'failed',attempt:3,execution_epoch:3,version:5,error:{code:'RETRY_EXHAUSTED',message:'重试次数已用尽'}}
 validateTaskExample(failed)
 validateTaskExample({...base,status:'running',attempt:1,execution_epoch:1,version:3,cancel_requested:true})
 validateTaskExample({...base,status:'cancelled',version:2,cancel_requested:true})
 for(const bad of [
  {...base,status:'succeeded'}, {...base,error:failed.error}, {...failed,attempt:4},
  {...failed,execution_epoch:2}, {...failed,version:3}, {...failed,attempt:2},
  {...failed,error:{code:'SQL_ERROR',message:'private value'}},
  {...base,status:'cancelled',cancel_requested:false},
  {...base,updated_at:'2026-11-11T00:00:00.000Z'},
 ])assert.throws(()=>validateTaskExample(bad))
})

test('AT-SC-13/14/15 pending cannot requeue an exhausted third claim',()=>{
 const base=fixtures.Task
 for(const attempt of [0,1,2])validateTaskExample({...base,attempt,execution_epoch:attempt,version:8})
 assert.throws(()=>validateTaskExample({...base,attempt:3,execution_epoch:3,version:8}),
  'Only the first two claims can return to pending; retry must not revive attempt 3')
 validateTaskExample({...base,status:'running',attempt:3,execution_epoch:3,version:8})
 validateTaskExample({...base,status:'succeeded',attempt:3,execution_epoch:3,version:8})
 validateTaskExample({...base,status:'failed',attempt:3,execution_epoch:3,version:8,error:{code:'RETRY_EXHAUSTED',message:'重试次数已用尽'}})
 validateTaskExample({...base,status:'cancelled',attempt:3,execution_epoch:3,version:8,cancel_requested:true})
})
