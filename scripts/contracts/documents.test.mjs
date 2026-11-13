import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { validateOperationBoundary } from './validate.mjs'
import { validateDocumentUploadExample,validateDocumentDetailExample,validateDocumentCitationExample } from './documents.mjs'
const api=parse(readFileSync('docs/contracts/openapi.yaml','utf8'))
const register=JSON.parse(readFileSync('docs/contracts/endpoint-register.json','utf8'))
const fixture=JSON.parse(readFileSync('docs/contracts/fixtures/documents-semantic-cases.json','utf8'))
const copy=x=>structuredClone(x)
const upload=a=>a.paths['/api/v1/documents'].post
const search=a=>a.paths['/api/v1/document-search'].get
function rejects(mutate){const a=copy(api);mutate(a);assert.throws(()=>validateOperationBoundary(a,register))}

test('DI-SC-01/25 six frozen candidates never activate PDF/OCR/vector runtime or change 22 current',()=>{
 validateOperationBoundary(api,register)
 assert.equal(register.operations.filter(x=>x.status==='current').length,22)
 assert.equal(register.operations.filter(x=>x.owner==='04E'&&x.status==='frozen').length,6)
 for(const mutate of [a=>upload(a)['x-contract-status']='current',a=>upload(a)['x-owner-change']='04',a=>delete a.paths['/api/v1/document-search'],a=>a.paths['/api/v1/documents'].delete=copy(upload(a)),a=>a.paths['/api/v1/ocr']={post:copy(upload(a))}])rejects(mutate)
 for(const mutate of [r=>r.operations.find(x=>x.owner==='04E').status='current',r=>r.operations.find(x=>x.owner==='04E').introduced_by='openspec/changes/unknown']){const r=copy(register);mutate(r);assert.throws(()=>validateOperationBoundary(api,r))}
})
test('DI-SC-02/11 authorization, private downloads and strict input declarations cannot weaken',()=>{
 for(const mutate of [a=>upload(a).security=[],a=>upload(a)['x-authorization'].roles.push('student'),a=>search(a)['x-authorization'].class_scope='client_header',a=>search(a)['x-authorization'].student_visibility='all',a=>search(a)['x-authorization'].cross_class=403,a=>search(a)['x-authorization'].order.reverse(),a=>search(a).parameters.push({name:'class_id',in:'query',required:false,schema:{type:'string'}}),a=>a.paths['/api/v1/documents/{id}'].get.parameters[0].schema={type:'number'},a=>search(a)['x-request-rules'].unknown_query='ignore',a=>a.paths['/api/v1/documents/{id}/download'].get.responses['200'].headers['Content-Disposition'].schema.pattern='^inline;',a=>a.paths['/api/v1/documents/{id}/download'].get.responses['200'].headers['Cache-Control'].schema.const='public',a=>a.paths['/api/v1/documents/{id}/download'].get.responses['200'].headers['X-Content-Type-Options'].schema.const='none'])rejects(mutate)
})
test('DI-SC-02/06/14 upload and expanded parser resource declarations stay bounded',()=>{
 for(const mutate of [a=>upload(a)['x-upload-limits'].file_bytes++,a=>upload(a)['x-upload-limits'].multipart_bytes++,a=>upload(a)['x-upload-limits'].extension_and_signature=false,a=>upload(a)['x-upload-limits'].formats.push('doc'),a=>upload(a)['x-upload-limits'].declared_and_streamed=false,a=>upload(a)['x-parser-limits'].pdf_pages++,a=>upload(a)['x-parser-limits'].expanded_bytes++,a=>upload(a)['x-parser-limits'].external_fetch=true,a=>upload(a)['x-parser-limits'].wall_clock_ms*=10,a=>upload(a)['x-parser-limits'].concurrency=10])rejects(mutate)
})
test('DI-SC-07/10 original 202, atomic job, shared quota and CAS retry declarations are exact',()=>{
 for(const mutate of [a=>upload(a)['x-idempotency'].same_payload=200,a=>upload(a)['x-idempotency'].authorization_before_replay=false,a=>upload(a)['x-idempotency'].atomic.pop(),a=>upload(a)['x-idempotency'].scope=['Idempotency-Key'],a=>upload(a)['x-rate-limit'].limit=13,a=>upload(a)['x-rate-limit'].switch_class_resets=true,a=>upload(a).parameters.find(p=>p.name==='Idempotency-Key').required=false,a=>upload(a).parameters.find(p=>p.name==='Origin').required=true,a=>a.paths['/api/v1/documents/{id}/retry'].post['x-retry'].needs_ocr=202,a=>a.paths['/api/v1/documents/{id}/retry'].post['x-retry'].attempts_less_than=4,a=>a.paths['/api/v1/documents/{id}/retry'].post.requestBody={required:false,content:{}}])rejects(mutate)
})
test('DI-SC-12 keyword only, snapshot and dependency errors cannot silently change',()=>{
 for(const mutate of [a=>search(a).parameters.find(p=>p.name==='mode').schema.enum.push('hybrid'),a=>search(a).parameters.find(p=>p.name==='top_k').schema.maximum=100,a=>search(a)['x-citation'].authorization='vector_payload',a=>search(a)['x-citation'].cross_location_chunks=true,a=>delete search(a).responses['503'],a=>search(a).responses['504']['x-error-code']='VALIDATION_ERROR',a=>a.paths['/api/v1/documents'].get['x-pagination'].snapshot='separate_queries',a=>a.paths['/api/v1/documents'].get.parameters.find(p=>p.name==='page_size').schema.maximum=100])rejects(mutate)
})
test('DI-SC-12 actual normalized q and page schemas reject type, bounds and default drift',()=>{
 for(const mutate of [
  a=>search(a).parameters.find(p=>p.name==='q').schema.maxLength=2001,
  a=>search(a).parameters.find(p=>p.name==='q').schema={type:'string',minLength:1,maxLength:2001},
  a=>search(a).parameters.find(p=>p.name==='q').schema={type:'number'},
  a=>search(a).parameters.find(p=>p.name==='q')['x-normalization'].before_schema=false,
  a=>a.paths['/api/v1/documents'].get.parameters.find(p=>p.name==='page').schema.minimum=0,
  a=>a.paths['/api/v1/documents'].get.parameters.find(p=>p.name==='page').schema.default=0,
  a=>a.paths['/api/v1/documents'].get.parameters.find(p=>p.name==='page').schema.type='string',
 ])rejects(mutate)
})
test('DI-SC-02 binary envelope examples test byte/title limits; no real parsing claim',()=>{
 const pdf=Buffer.from('%PDF-1.7 synthetic envelope, not a real parser fixture')
 const value={title:'课程资料',filename:'lecture.pdf',file:pdf,multipart_bytes:pdf.length+100}
 validateDocumentUploadExample(value)
 validateDocumentUploadExample({...value,title:'\u0085课程资料\u0085'})
 validateDocumentUploadExample({title:'题'.repeat(200),filename:'LECTURE.PDF',file:Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(10485755)]),multipart_bytes:10551296})
 validateDocumentUploadExample({title:'word',filename:'x.docx',file:Buffer.from([80,75,3,4,0]),multipart_bytes:105})
 for(const mutate of [x=>x.title='',x=>x.title='题'.repeat(201),x=>x.title='\uFEFF'+'题'.repeat(200),x=>x.title='x\u0000',x=>x.title='\ud800',x=>x.file=Buffer.alloc(0),x=>x.file=Buffer.alloc(10485761),x=>x.multipart_bytes=10551297,x=>x.multipart_bytes=x.file.length-1,x=>x.filename='x.doc',x=>x.filename='x.docx',x=>x.file=Buffer.from('fake pdf')]){const x={...value};mutate(x);assert.throws(()=>validateDocumentUploadExample(x))}
})
test('DI-SC-03/04/05 page/block boundaries and exact Unicode quote require persisted source',()=>{
 validateDocumentDetailExample(fixture.detail);validateDocumentDetailExample(fixture.pending);validateDocumentCitationExample(fixture.citation,fixture.detail)
 for(const mutate of [d=>d.locations[0].char_end++,d=>d.locations[1].unit=1,d=>d.locations[1].char_start--,d=>d.locations[1].char_end++,d=>d.document.page_count=1,d=>d.document.format='docx',d=>d.document.status='queued',d=>d.body=d.body.replace('\n\n','\r\n')]){const d=copy(fixture.detail);mutate(d);assert.throws(()=>validateDocumentDetailExample(d))}
 for(const mutate of [c=>c.quote+='x',c=>c.location.unit=1,c=>c.location.char_start--,c=>c.document_version++,c=>c.document_id='2',c=>c.url='https://example.invalid/file']){const c=copy(fixture.citation);mutate(c);assert.throws(()=>validateDocumentCitationExample(c,fixture.detail))}
 const d=copy(fixture.detail);d.document.format='docx';d.document.page_count=null;d.body='😀第一段\n\n单元格';d.locations=[{kind:'docx_paragraph',unit:1,char_start:0,char_end:4},{kind:'docx_table_cell',unit:2,char_start:6,char_end:9}];validateDocumentDetailExample(d)
 const c={...copy(fixture.citation),location:copy(d.locations[0]),quote:'😀第一段'};validateDocumentCitationExample(c,d)
})
