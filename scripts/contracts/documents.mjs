import assert from 'node:assert/strict'

export const documentChange='openspec/changes/2026-11-13-materials-document-intelligence'
export const documentOperations=[
 ['POST','/api/v1/documents',[202],[400,401,403,409,413,429,503,504],'Document'],
 ['GET','/api/v1/documents',[200],[400,401,403,503,504],'DocumentPage'],
 ['GET','/api/v1/documents/{id}',[200],[400,401,403,404,503,504],'DocumentDetail'],
 ['GET','/api/v1/documents/{id}/download',[200],[400,401,403,404,503,504],null],
 ['POST','/api/v1/documents/{id}/retry',[202],[400,401,403,404,409,429,503,504],'Document'],
 ['GET','/api/v1/document-search',[200],[400,401,403,503,504],'DocumentSearchResponse'],
]
const ref=name=>({$ref:`./schemas/${name}.schema.json`})
const points=value=>[...value]
const trim=value=>value.replace(/^\p{White_Space}+|\p{White_Space}+$/gu,'')
export function validateDocumentOperationProfiles(api){
 for(const [method,path,success,errors,schema] of documentOperations){
  const op=api.paths[path]?.[method.toLowerCase()];assert.ok(op)
  assert.equal(op['x-contract-status'],'frozen','DI-SC-01: no runtime activation in the contract PR')
  assert.equal(op['x-owner-change'],'04E');assert.equal(op['x-spec-change'],documentChange)
  assert.deepEqual(op.security,[{BearerAuth:[]}]);assert.equal(op['x-budget-ms'],5000)
  assert.deepEqual(op['x-authorization'],{roles:method==='POST'?['teacher']:['teacher','student'],class_scope:'server_session',student_visibility:'ready',cross_class:404,order:['authentication','action','resource','business'],rejected_business_side_effects:false})
  assert.deepEqual(op['x-request-rules'],{unknown_query:'reject',duplicate_parameters:'reject',unknown_body:'reject',get_body:'reject'})
  assert.deepEqual(Object.keys(op.responses).sort(),[...success,...errors].map(String).sort())
  for(const status of success){
   const r=op.responses[status];assert.equal(r.headers['Cache-Control'].schema.const,'no-store')
   assert.ok(r.headers['X-Request-ID'])
   if(schema)assert.deepEqual(r.content['application/json'].schema,ref(schema))
  }
  for(const status of errors){
   assert.deepEqual(op.responses[status].content['application/json'].schema,ref('Error'))
   assert.equal(op.responses[status]['x-error-code'],{400:'VALIDATION_ERROR',401:'UNAUTHENTICATED',403:'FORBIDDEN',404:'NOT_FOUND',409:'CONFLICT',413:'PAYLOAD_TOO_LARGE',429:'RATE_LIMITED',503:'DEPENDENCY_UNAVAILABLE',504:'UPSTREAM_TIMEOUT'}[status])
  }
  const expected=path.includes('{id}')?[['id','path',true]]:[]
  if(path.includes('{id}'))assert.deepEqual(op.parameters.find(p=>p.name==='id')?.schema,ref('ID'))
  if(method==='POST')expected.push(['Origin','header',false])
  if(method==='POST'&&path==='/api/v1/documents')expected.push(['Idempotency-Key','header',true])
  if(method==='GET'&&path==='/api/v1/documents')expected.push(['page','query',false],['page_size','query',false])
  if(path==='/api/v1/document-search')expected.push(['q','query',true],['mode','query',false],['top_k','query',false])
  assert.deepEqual(op.parameters.map(p=>[p.name,p.in,p.required]).sort(),expected.sort(),'DI-SC-02/12 no unregistered class/user/filter parameter')
  if(method==='POST'){
   assert.deepEqual(op['x-rate-limit'],{scope:'user_id',limit:12,window_seconds:60,shared_with:['material_upload','material_retry','document_upload','document_retry'],replays_count:true,switch_class_resets:false})
   assert.equal(op.parameters.find(p=>p.name==='Origin')['x-if-present'],'trusted_same_origin')
   assert.equal(op.responses['429'].headers['Retry-After'].schema.minimum,1)
  }
  if(path.endsWith('/download')){
   assert.equal(op.responses['200'].headers['Content-Disposition'].schema.pattern,'^attachment;')
   assert.equal(op.responses['200'].headers['X-Content-Type-Options'].schema.const,'nosniff')
   assert.deepEqual(Object.keys(op.responses['200'].content).sort(),['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'].sort())
  }
  if(method==='POST'&&path==='/api/v1/documents'){
   assert.equal(op.requestBody.required,true);assert.deepEqual(op.requestBody.content['multipart/form-data'].schema,ref('DocumentUpload'))
   assert.deepEqual(op['x-upload-limits'],{file_bytes:10485760,multipart_bytes:10551296,formats:['pdf','docx'],extension_and_signature:true,declared_and_streamed:true,parts:['title','file'],unknown_parts:'reject'})
   assert.deepEqual(op['x-parser-limits'],{pdf_pages:200,expanded_bytes:33554432,docx_entries:2000,docx_compression_ratio:100,logical_blocks:20000,output_utf8_bytes:2097152,wall_clock_ms:30000,memory_bytes:536870912,concurrency:1,external_fetch:false})
   assert.deepEqual(op['x-idempotency'],{scope:['user_id','current_class_id','Idempotency-Key'],same_payload:202,different_payload:409,authorization_before_replay:true,replay:'original_202_snapshot',atomic:['document','original_bytes','parse_job','original_202']})
   assert.deepEqual(op.parameters.find(p=>p.name==='Idempotency-Key').schema,ref('MaterialIdempotencyKey'))
  }else assert.equal(op.requestBody,undefined)
  if(path.endsWith('/retry'))assert.deepEqual(op['x-retry'],{status:'failed',reasons:['parse_timeout','worker_interrupted','internal_failure'],attempts_less_than:3,concurrent:'compare_and_swap_once',needs_ocr:409})
  if(path==='/api/v1/document-search'){
   assert.deepEqual(op.parameters.find(p=>p.name==='mode').schema,{type:'string',enum:['keyword'],default:'keyword'})
   assert.deepEqual(op.parameters.find(p=>p.name==='q')['x-normalization'],{trim:'Unicode_White_Space',min_codepoints:1,max_codepoints:2000,control_characters:'reject'})
   assert.deepEqual(op.parameters.find(p=>p.name==='top_k').schema,{type:'integer',minimum:1,maximum:10,default:4})
   assert.deepEqual(op['x-citation'],{authorization:'filter_before_search_and_recheck_persisted_source',location:'unicode_codepoint_half_open',source_version:'exact',quote:'exact_persisted_substring',cross_location_chunks:false,dependency_failure:'503_or_504_never_empty'})
  }
  if(method==='GET'&&path==='/api/v1/documents'){
   assert.deepEqual(op.parameters.find(p=>p.name==='page_size').schema,{type:'integer',minimum:1,maximum:50,default:20})
   assert.deepEqual(op['x-pagination'],{snapshot:'single_request_count_and_items',order:'id_desc',cross_request_snapshot:false})
  }
 }
}

// Contract examples only; these do not parse a real PDF or DOCX.
export function validateDocumentUploadExample({title,filename,file,multipart_bytes}){
 assert.equal(typeof title,'string');assert.ok(title.isWellFormed()&&points(trim(title)).length>=1&&points(trim(title)).length<=200&&!/\p{Cc}/u.test(trim(title)))
 assert.ok(Buffer.isBuffer(file)&&file.length>=1&&file.length<=10485760)
 assert.ok(Number.isSafeInteger(multipart_bytes)&&multipart_bytes>=file.length&&multipart_bytes<=10551296)
 assert.equal(typeof filename,'string');const extension=filename.toLowerCase().split('.').pop()
 assert.ok(extension==='pdf'||extension==='docx')
 assert.ok(extension==='pdf'?file.subarray(0,5).equals(Buffer.from('%PDF-')):file.subarray(0,4).equals(Buffer.from([80,75,3,4])))
}
export function validateDocumentDetailExample(detail){
 const {document:doc,body,locations}=detail
 if(doc.status!=='ready'){assert.equal(body,null);assert.deepEqual(locations,[]);return}
 assert.equal(typeof body,'string');assert.ok(trim(body).length>0&&Buffer.byteLength(body,'utf8')<=2097152)
 assert.ok(!body.includes('\r')&&!/\p{Cc}/u.test(body.replace(/[\t\n]/g,'')))
 const cp=points(body);assert.ok(locations.length>0&&locations.length<=20000)
 let end=0,unit=0
 for(const l of locations){
  assert.ok(l.char_start>=end&&l.char_end>l.char_start&&l.char_end<=cp.length&&l.unit>unit)
  assert.equal(cp.slice(end,l.char_start).join(''),unit===0?'':'\n\n')
  assert.ok(trim(cp.slice(l.char_start,l.char_end).join('')).length>0)
  assert.ok(doc.format==='pdf'?l.kind==='pdf_page'&&l.unit<=doc.page_count:['docx_paragraph','docx_table_cell'].includes(l.kind))
  end=l.char_end;unit=l.unit
 }
 assert.equal(end,cp.length)
}
export function validateDocumentCitationExample(c,detail){
 validateDocumentDetailExample(detail);assert.equal(detail.document.status,'ready')
 assert.equal(c.document_id,detail.document.id);assert.equal(c.document_version,detail.document.version);assert.equal(c.title,detail.document.title)
 assert.equal(c.url,`/api/v1/documents/${c.document_id}`)
 const l=c.location,source=detail.locations.find(x=>x.kind===l.kind&&x.unit===l.unit)
 assert.ok(source&&l.char_start>=source.char_start&&l.char_end<=source.char_end&&l.char_end>l.char_start)
 assert.equal(c.quote,points(detail.body).slice(l.char_start,l.char_end).join(''))
 assert.ok(points(c.quote).length>=1&&points(c.quote).length<=2000)
}
export function documentBoundaryFixtures(){
 const d={id:'1',title:'课程资料',format:'pdf',version:1,status:'queued',size_bytes:10485760,attempts:0,page_count:null,failure_reason:null,created_at:'2026-11-13T00:00:00.000Z',updated_at:'2026-11-13T00:00:00.000Z'}
 const fixtures=[{name:'DI-SC-01 frozen queued document',schema:'Document',data:d,valid:true}]
 for(const [key,value] of [['size_bytes',10485761],['size_bytes',0],['format','doc'],['attempts',4],['id','9223372036854775808'],['status','succeeded'],['failure_reason','corrupt']])fixtures.push({name:`DI-SC-02/06 document rejects ${key}=${value}`,schema:'Document',data:{...d,[key]:value},valid:false})
 fixtures.push({name:'DI-SC-06 scanned PDF needs OCR',schema:'Document',data:{...d,status:'needs_ocr',attempts:1,page_count:2},valid:true})
 fixtures.push({name:'DI-SC-06 DOCX cannot fake PDF needs OCR',schema:'Document',data:{...d,format:'docx',status:'needs_ocr',attempts:1},valid:false})
 fixtures.push({name:'DI-SC-06 failed requires a reason',schema:'Document',data:{...d,status:'failed',attempts:1},valid:false})
 fixtures.push({name:'DI-SC-06 failed resource limit',schema:'Document',data:{...d,status:'failed',attempts:1,failure_reason:'resource_limit'},valid:true})
 fixtures.push({name:'DI-SC-03 ready PDF needs page count',schema:'Document',data:{...d,status:'ready',attempts:1},valid:false})
 return fixtures
}
