import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

// AT-SC-01..21: contract examples/declarations only. No authorization service,
// database, scheduler or production executor is implemented here.
export const assignmentOperations = [
  ['POST','/api/v1/assignments',201,'Assignment','AssignmentCreateRequest',[400,401,403,413,429,503,504]],
  ['GET','/api/v1/assignments',200,'AssignmentPage',null,[400,401,503,504]],
  ['GET','/api/v1/assignments/{id}',200,'Assignment',null,[400,401,404,503,504]],
  ['POST','/api/v1/assignments/{id}/submissions',202,'SubmissionAccepted','SubmissionCreateRequest',[400,401,403,404,409,413,429,503,504]],
  ['GET','/api/v1/assignments/{id}/submissions',200,'SubmissionPage',null,[400,401,404,503,504]],
  ['GET','/api/v1/submissions/{id}',200,'Submission',null,[400,401,404,503,504]],
  ['GET','/api/v1/tasks/{id}',200,'Task',null,[400,401,404,503,504]],
  ['POST','/api/v1/tasks/{id}/retry',200,'Task','TaskVersionRequest',[400,401,403,404,409,413,429,503,504]],
  ['POST','/api/v1/tasks/{id}/cancel',200,'Task','TaskVersionRequest',[400,401,403,404,409,413,429,503,504]],
]
const reference=(name,field)=>({$ref:`./schemas/${name}.schema.json${field?`#/properties/${field}`:''}`})
const errorCodes={400:['VALIDATION_ERROR'],401:['UNAUTHENTICATED'],403:['FORBIDDEN'],404:['NOT_FOUND'],413:['PAYLOAD_TOO_LARGE'],429:['RATE_LIMITED'],503:['DEPENDENCY_UNAVAILABLE'],504:['UPSTREAM_TIMEOUT']}
export function validateAssignmentOperationProfiles(api) {
  assert.deepEqual(api['x-assignment-task-contract'], {
  "production_executor": "unbound-pending-no-claim",
  "production_mock_switch": false,
  "max_claims": 3,
  "initial_attempt": 0,
  "initial_epoch": 0,
  "lease_seconds": 60,
  "heartbeat_seconds": 20,
  "automatic_backoff_seconds": [
    1,
    2
  ],
  "claim_increments": [
    "attempt",
    "execution_epoch"
  ],
  "manual_retry_resets_attempt": false,
  "worker_cas": [
    "task_id",
    "execution_epoch",
    "worker_owner",
    "running",
    "lease_until > db_now"
  ],
  "success_requires_cancel_requested": false,
  "terminal_transaction": [
    "task",
    "result-adapter",
    "outbox"
  ],
  "network_inside_transaction": false,
  "expired_cleanup_rechecks": [
    "execution_epoch",
    "version",
    "lease-expired"
  ],
  "expired_cancel_requested": "cancelled-close-outbox",
  "expired_third_claim": "failed-RETRY_EXHAUSTED-close-outbox",
  "outbox_poll_ms": 1000,
  "outbox_batch_max": 20,
  "executors_max": 2,
  "shutdown_drain_ms": 10000,
  "public_worker_fields": false,
  "failure_after_cancel": "confirm-cancelled-no-requeue-or-failed"
})
  for(const [method,path,status,responseSchema,bodySchema,errors] of assignmentOperations){
    const op=api.paths[path]?.[method.toLowerCase()]
    assert.ok(op,`Missing 05 contract: ${method} ${path}`)
    assert.equal(op['x-contract-status'],'frozen','05 must not activate before its reviewed implementation')
    assert.equal(op['x-owner-change'],'05')
    assert.equal(op['x-spec-change'],'openspec/changes/2026-11-12-assignment-tasks')
    assert.deepEqual(op.security,[{BearerAuth:[]}])
    const write=method==='POST',submit=status===202
    assert.deepEqual(op['x-resource-chain'],path.includes('/tasks/')?['task','submission','assignment']:path.startsWith('/api/v1/submissions/')?['submission','assignment']:['assignment'])
    if(write&&!submit)assert.equal(op['x-replay'],'no-automatic-replay')
    assert.deepEqual(op['x-authorization'],{
      source:'validated-server-session',roles:write?(path==='/api/v1/assignments'?['teacher']:['student']):['teacher','student'],
      class_scope:'active-membership-and-resource-original-class',
      student_visibility:write&&path==='/api/v1/assignments'?'not-applicable':path==='/api/v1/assignments'||path==='/api/v1/assignments/{id}'?'all-in-current-class':'own-only',
      teacher_visibility:'all-in-current-class-read-only-tasks',
      order:['authentication','action-role','resource-visibility','business-input'],
      cross_class:'404-identical-to-missing',other_student:'404-identical-to-missing',rejected_business_side_effects:false,
    })
    assert.deepEqual(op['x-request-rules'],{unknown_query:'reject-400',duplicate_parameters:'reject-400',request_body:bodySchema?'json-only':'forbidden'})
    assert.equal(op['x-database-budget-ms'],5000)
    const allow=assignmentOperations.filter(([,p])=>p===path).map(([m])=>m).sort().join(', ')
    assert.deepEqual(op['x-method-boundary'],{status:405,allow,body:'empty'})
    const names=[...(path.includes('{id}')?['path:id']:[]),...(responseSchema.endsWith('Page')?['query:page','query:page_size']:[]),...(write?['header:Origin']:[]),...(submit?['header:Idempotency-Key']:[])]
    assert.deepEqual(op.parameters.map(p=>`${p.in}:${p.name}`).sort(),names.sort())
    for(const p of op.parameters){
      if(p.in==='path'){assert.equal(p.required,true);assert.deepEqual(p.schema,reference('ID'))}
      if(p.in==='query'){assert.equal(p.required,false);assert.deepEqual(p.schema,reference('MaterialListParameters',p.name))}
      if(p.name==='Origin'){assert.equal(p.required,false);assert.deepEqual(p.schema,{type:'string'})}
      if(p.name==='Idempotency-Key'){assert.equal(p.required,true);assert.deepEqual(p.schema,reference('SubmissionIdempotencyKey'))}
    }
    assert.deepEqual(Object.keys(op.responses).sort(),[status,405,...errors].map(String).sort())
    assert.deepEqual(op.responses[status].content['application/json'].schema,reference(responseSchema))
    assert.equal(op.responses['405'].content,undefined)
    assert.deepEqual(op.responses['405'].headers.Allow.schema,{const:allow})
    for(const [code,r] of Object.entries(op.responses)){
      assert.deepEqual(r.headers['X-Request-ID'].schema,{type:'string',pattern:'^[0-9a-f]{32}$',minLength:32,maxLength:32})
      assert.deepEqual(r.headers['Cache-Control'].schema,{const:'no-store'})
      if(Number(code)<400||code==='405')continue
      const expected=code==='409'?(submit?['CONFLICT','IDEMPOTENCY_CONFLICT']:path.endsWith('/retry')?['CONFLICT','RETRY_EXHAUSTED']:['CONFLICT','TASK_TERMINAL']):errorCodes[code]
      assert.deepEqual(r['x-error-codes'],expected)
      assert.deepEqual(r.content['application/json'].schema,reference('Error'))
      assert.deepEqual(Object.keys(r.content['application/json'].examples).sort(),[...expected].sort())
      for(const [name,example] of Object.entries(r.content['application/json'].examples)){
        assert.equal(example.value.error.code,name);assert.equal(example.value.error.details,null)
        assert.deepEqual(example.value.error.fields,[])
        if(code==='404')assert.equal(example.value.error.message,'资源不存在')
      }
      if(code==='429')assert.deepEqual(r.headers['Retry-After'].schema,{type:'integer',minimum:1})
    }
    if(bodySchema){
      assert.equal(op.requestBody.required,true)
      assert.deepEqual(Object.keys(op.requestBody.content),['application/json'])
      assert.deepEqual(op.requestBody.content['application/json'].schema,reference(bodySchema))
      assert.deepEqual(op['x-body-limits'],{bytes:65536,declared_and_streamed:true,unknown_json_keys:'reject-400',duplicate_json_keys:'reject-400',unicode:'reject-ill-formed',text_normalization:'none'})
      assert.deepEqual(op['x-rate-limit'],{bucket:'05-write',scope:'user_id',window_seconds:60,quota:12,switch_class_resets:false,committed_replays_count:false,idempotency_conflicts_count:false})
    }else{assert.equal(op.requestBody,undefined);assert.equal(op['x-rate-limit'],undefined)}
    if(submit)assert.deepEqual(op['x-idempotency'],{
      scope:['user_id','class_id','route','assignment_id','Idempotency-Key'],same_payload:202,different_payload:409,
      replay:'original-accepted-pending-snapshot',authorization_before_lookup:true,committed_only:true,
      before_new_conditions:['quota','assignment_version','deadline'],retention:'no-automatic-deletion',
      digest:'sha256-go-json-answer-then-assignment_version',atomic:['submission','task','outbox','accepted-snapshot'],new_deadline:'db_now < deadline',
    })
    if(path.endsWith('/retry')){
      const value=op.responses['200'].content['application/json'].examples.contract.value
      validateTaskExample(value);assert.equal(value.status,'pending');assert.ok(value.attempt>=1&&value.attempt<3)
      assert.equal(value.version,op.requestBody.content['application/json'].examples.contract.value.version+1)
    }
    if(path.endsWith('/cancel')){
      const values=op.responses['200'].content['application/json'].examples
      assert.deepEqual(Object.keys(values).sort(),['pending_cancelled','running_cancel_requested'])
      for(const example of Object.values(values)){validateTaskExample(example.value);assert.equal(example.value.cancel_requested,true)}
      assert.equal(values.pending_cancelled.value.status,'cancelled');assert.equal(values.running_cancel_requested.value.status,'running')
      assert.equal(values.pending_cancelled.value.version,op.requestBody.content['application/json'].examples.contract.value.version+1)
      assert.equal(values.running_cancel_requested.value.version,op.requestBody.content['application/json'].examples.running.value.version+1)
    }
    if(path.endsWith('/retry'))assert.deepEqual(op['x-task-action'],{action:'retry',role:'submission-owner-student',requires:'failed-and-version-match-and-attempt<3',changes:'pending; clear-error/cancel/owner/lease; reopen-same-outbox',attempt_increment:false,epoch_increment:false,deadline_rechecked:false,version_before_state:true})
    if(path.endsWith('/cancel'))assert.deepEqual(op['x-task-action'],{action:'cancel',role:'submission-owner-student',terminal_before_version:true,pending:'cancelled-and-close-outbox',running:'mark-cancel-requested-only',already_marked_latest_version:'same-task-no-version-increment',success_after_cancel:'CAS-rejected',deadline_rechecked:false})
  }
}

export function validateAssignmentRequestExample(value,wire=JSON.stringify(value),now='2026-11-12T08:00:00.000Z'){
  assert.ok(Buffer.byteLength(wire,'utf8')<=65536,'Entire JSON request byte limit')
  assert.deepEqual(JSON.parse(wire),value,'Wire and decoded example differ')
  for(const s of Object.values(value).filter(v=>typeof v==='string'))assert.ok(s.isWellFormed(),'Ill-formed Unicode')
  if('deadline' in value){
    assert.ok(/[^\p{White_Space}]/u.test(value.title)&&/[^\p{White_Space}]/u.test(value.description))
    assert.ok(Date.parse(value.deadline)>Date.parse(now),'New deadline must be after database now')
  }
}
// Used only for the small, exactly representable fixture versions. Real Go
// parsing, duplicate keys and UTF-8 wire rejection remain apply-stage checks.
export function submissionDigestExample(value){
  assert.ok(value.answer.isWellFormed()&&[...value.answer].length>=1&&[...value.answer].length<=20000)
  assert.ok(Number.isSafeInteger(value.assignment_version)&&value.assignment_version>=1)
  const canonical=JSON.stringify({answer:value.answer,assignment_version:value.assignment_version}).replace(/[<>&\u2028\u2029]/gu,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'))
  return {canonical,sha256:createHash('sha256').update(canonical,'utf8').digest('hex')}
}
export function validateAssignmentPageExample(page){
  const remaining=BigInt(page.total)-(BigInt(page.page)-1n)*BigInt(page.page_size)
  assert.equal(page.items.length,remaining<=0n?0:Number(remaining<BigInt(page.page_size)?remaining:BigInt(page.page_size)))
  const ids=new Set()
  for(const [i,item] of page.items.entries()){
    assert.ok(!ids.has(item.id));ids.add(item.id)
    if(i){const previous=page.items[i-1];assert.ok(previous.created_at>item.created_at||(previous.created_at===item.created_at&&BigInt(previous.id)>BigInt(item.id)),'created_at DESC then id DESC')}
  }
}
export function validateTaskExample(task){
  assert.ok(Number.isInteger(task.attempt)&&task.attempt>=0&&task.attempt<=3)
  if(task.status==='pending')assert.ok(task.attempt<3,'Exhausted third claim cannot return to pending')
  assert.ok(Number.isInteger(task.execution_epoch)&&task.execution_epoch>=task.attempt)
  assert.ok(task.version>=task.attempt+(['failed','succeeded','cancelled'].includes(task.status)?2:1))
  assert.ok(task.updated_at>=task.created_at)
  if(['running','succeeded','failed'].includes(task.status))assert.ok(task.attempt>=1)
  if(task.status==='failed'){
    assert.deepEqual(task.error,{code:task.error?.code,message:task.error?.code==='RETRY_EXHAUSTED'?'重试次数已用尽':'任务执行失败'})
    assert.ok(['EXECUTION_FAILED','RETRY_EXHAUSTED'].includes(task.error.code))
    if(task.error.code==='RETRY_EXHAUSTED')assert.equal(task.attempt,3)
  }else assert.equal(task.error,null)
  if(task.status==='cancelled')assert.equal(task.cancel_requested,true)
  else if(task.status!=='running')assert.equal(task.cancel_requested,false)
}
export function assignmentBoundaryFixtures(){
  const make=(name,schema,data,valid)=>({name:`05 boundary ${name}`,schema,data,valid})
  const request={title:'题',description:'正文',deadline:'2026-11-13T08:00:00.000Z'}
  return [
    make('title 200 nonBMP','AssignmentCreateRequest',{...request,title:'𠮷'.repeat(200)},true),
    make('title 201 nonBMP','AssignmentCreateRequest',{...request,title:'𠮷'.repeat(201)},false),
    make('blank title','AssignmentCreateRequest',{...request,title:'\u0085\u3000\t '},false),
    make('description 20000','AssignmentCreateRequest',{...request,description:'文'.repeat(20000)},true),
    make('description 20001','AssignmentCreateRequest',{...request,description:'文'.repeat(20001)},false),
    make('blank description','AssignmentCreateRequest',{...request,description:'\r\n '},false),
    make('surrogate title','AssignmentCreateRequest',{...request,title:'\ud800'},false),
    make('surrogate answer','SubmissionCreateRequest',{answer:'\ud800',assignment_version:1},false),
    make('20000 whitespace answer','SubmissionCreateRequest',{answer:' '.repeat(20000),assignment_version:1},true),
    make('20001 answer','SubmissionCreateRequest',{answer:'𠮷'.repeat(20001),assignment_version:1},false),
    make('max ASCII key','SubmissionIdempotencyKey','a'.repeat(64),true),
    make('overflow ASCII key','SubmissionIdempotencyKey','a'.repeat(65),false),
    make('newline key','SubmissionIdempotencyKey','a'.repeat(16)+'\n',false),
    make('query defaults boundary','AssignmentListParameters',{page:2147483647,page_size:50},true),
    make('query overflow','AssignmentListParameters',{page:2147483648,page_size:50},false),
    make('version 0','SubmissionCreateRequest',{answer:'a',assignment_version:0},false),
    make('deadline nonUTC','AssignmentCreateRequest',{...request,deadline:'2026-11-13T08:00:00.000+00:00'},false),
    make('deadline invalid date','AssignmentCreateRequest',{...request,deadline:'2026-02-30T08:00:00.000Z'},false),
  ]
}
