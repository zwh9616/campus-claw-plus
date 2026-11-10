import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parse} from 'yaml'
import {validateOperationBoundary} from './validate.mjs'
import {validateMaterialUploadExample,validateMaterialDetailExample,validateMaterialPageExample,validateKeywordResultExample} from './materials.mjs'

const api = parse(readFileSync('docs/contracts/openapi.yaml','utf8'))
const endpoints = JSON.parse(readFileSync('docs/contracts/endpoint-register.json','utf8'))
const fixtures = JSON.parse(readFileSync('docs/contracts/fixtures/materials-semantic-cases.json','utf8'))
const copy = value => structuredClone(value)
const upload = a => a.paths['/api/v1/materials'].post
const search = a => a.paths['/api/v1/search'].get
const download = a => a.paths['/api/v1/materials/{id}/download'].get

test('MR-SC-01/02 six frozen contracts cannot activate routes or weaken identity/class/role declarations', () => {
  validateOperationBoundary(api,endpoints)
  for (const mutate of [
    a => upload(a)['x-contract-status']='current',
    a => upload(a).security=[],
    a => search(a).security=[{RefreshCookie:[]}],
    a => upload(a)['x-authorization'].roles.push('student'),
    a => search(a)['x-authorization'].class_scope='client-header',
    a => search(a)['x-authorization'].student_visibility='all',
    a => upload(a)['x-authorization'].order.reverse(),
    a => download(a)['x-authorization'].cross_class='403',
    a => upload(a)['x-authorization'].rejected_business_side_effects=true,
    a => download(a).responses['404'].content['application/json'].examples.contract.value.error.message='另一班级存在此资料',
    a => search(a).responses['200'].headers['Cache-Control'].schema.const='public',
  ]) { const bad=copy(api);mutate(bad);assert.throws(()=>validateOperationBoundary(bad,endpoints)) }
  const bad=copy(endpoints);bad.operations.find(e=>e.owner==='04').status='current'
  assert.throws(()=>validateOperationBoundary(api,bad))
})

test('MR-SC-03/04/05/06 wire declarations reject unknown inputs, missing quotas, wrong replay and download headers', () => {
  for (const mutate of [
    a=>upload(a).parameters.find(p=>p.name==='Idempotency-Key').required=false,
    a=>upload(a).parameters.find(p=>p.name==='Origin').required=true,
    a=>upload(a)['x-upload-limits'].file_bytes++,
    a=>upload(a)['x-upload-limits'].multipart_bytes++,
    a=>upload(a)['x-upload-limits'].declared_and_streamed=false,
    a=>upload(a)['x-upload-limits'].unknown_parts='ignore',
    a=>upload(a)['x-idempotency'].scope=['Idempotency-Key'],
    a=>upload(a)['x-idempotency'].different_payload=200,
    a=>upload(a)['x-rate-limit'].scope='session_id',
    a=>upload(a)['x-rate-limit'].replays_count=false,
    a=>upload(a)['x-rate-limit'].switch_class_resets=true,
    a=>upload(a).responses['429'].headers['Retry-After'].schema.minimum=0,
    a=>search(a)['x-request-rules'].unknown_query='ignore',
    a=>search(a)['x-request-rules'].duplicate_parameters='first-wins',
    a=>search(a).parameters.push({in:'query',name:'class_id',schema:{type:'string'}}),
    a=>download(a).responses['200'].headers['X-Content-Type-Options'].schema.const='none',
    a=>delete download(a).responses['200'].headers['Content-Disposition'],
    a=>search(a).requestBody={required:false,content:{}},
  ]){const bad=copy(api);mutate(bad);assert.throws(()=>validateOperationBoundary(bad,endpoints))}
})

test('MR-SC-07/08/10 dependency failures must remain 503/504, not a successful empty search',()=>{
  for(const mutate of [
    a=>delete search(a).responses['503'],
    a=>search(a).responses['504']['x-error-code']='VALIDATION_ERROR',
    a=>search(a).responses['503']=copy(search(a).responses['200']),
    a=>a.paths['/api/v1/materials/{id}/retry-index'].post.responses['200'].content['application/json'].schema={$ref:'./schemas/KeywordSearchResponse.schema.json'},
  ]){const bad=copy(api);mutate(bad);assert.throws(()=>validateOperationBoundary(bad,endpoints))}
})

test('MR-SC-04 Unicode examples enforce original UTF-8 bytes, normalized whitespace and title codepoints',()=>{
  validateMaterialUploadExample(fixtures.upload)
  validateMaterialUploadExample({title:'题'.repeat(200),file:'x'.repeat(262144)})
  validateMaterialUploadExample({title:'😀'.repeat(200),file:'😀'.repeat(65536)})
  validateMaterialUploadExample({title:'标题',file:'\uFEFF\uFEFF正文'})
  for(const file of ['', '\uFEFF', '\uFEFF\t\r\n ', '\0', '\u0085', '\ud800', '😀'.repeat(65536)+'a'])assert.throws(()=>validateMaterialUploadExample({title:'标题',file}))
  for(const title of [' \t ', '题'.repeat(201), '😀'.repeat(201), '标题\0', '\ud800'])assert.throws(()=>validateMaterialUploadExample({title,file:'正文'}))
})

test('MR-SC-01/03 material examples preserve original byte size, canonical detail and unique pagination',()=>{
  validateMaterialDetailExample(fixtures.detail)
  validateMaterialDetailExample({...fixtures.detail,body:'\uFEFF正文'})
  for(const body of ['正文\r\n', '正文\0', '\ud800', '文'.repeat(100)])assert.throws(()=>validateMaterialDetailExample({...fixtures.detail,body}))
  const first={...fixtures.material,id:'9007199254740993'}, second={...fixtures.material,id:'9007199254740992'}
  const page={items:[first,second],page:1,page_size:2,total:2}
  validateMaterialPageExample(page)
  validateMaterialPageExample({items:[],page:2147483647,page_size:50,total:2})
  validateMaterialPageExample({items:[first],page:2,page_size:1,total:2})
  for(const bad of [{...page,page_size:1},{...page,total:1},{...page,items:[second,first]},{...page,items:[first,first]}])assert.throws(()=>validateMaterialPageExample(bad))
  assert.throws(()=>validateMaterialPageExample({...page,items:[first]}))
})

test('MR-SC-03/09 optional query defaults remain 1/20 and keyword/4 in sole-source schemas',()=>{
  const read=name=>JSON.parse(readFileSync(`docs/contracts/schemas/${name}.schema.json`,'utf8'))
  const list=read('MaterialListParameters').properties, query=read('KeywordSearchParameters').properties
  assert.equal(list.page.default,1);assert.equal(list.page_size.default,20)
  assert.equal(query.mode.default,'keyword');assert.equal(query.top_k.default,4)
})

test('MR-SC-09/10 citation examples bind codepoint range, exact quote, source/version, URL and literal query',()=>{
  const validate=(result,details=[fixtures.detail],q=fixtures.query)=>validateKeywordResultExample(result,details,q)
  validate(fixtures.search)
  validate({items:[],mode:'keyword'})
  for(const mutate of [
    r=>r.items[0].char_start++,r=>r.items[0].char_end--,r=>r.items[0].quote='错误出处',
    r=>r.items[0].title='错误标题',r=>r.items[0].material_version++,r=>r.items[0].material_id='99',
    r=>r.items[0].url='https://public.invalid/file',r=>r.items.push(copy(r.items[0])),
  ]){const bad=copy(fixtures.search);mutate(bad);assert.throws(()=>validate(bad))}
  assert.throws(()=>validate(fixtures.search,[{...fixtures.detail,material:{...fixtures.material,index_status:'failed'}}]))
  assert.throws(()=>validate(fixtures.search,[fixtures.detail],{...fixtures.query,q:'NOT-IN-TEXT'}))
  assert.throws(()=>validate(fixtures.search,[fixtures.detail],{...fixtures.query,top_k:0}))
  const body='文'.repeat(1800)+'😀%_'.repeat(100)
  const detail={material:{...fixtures.material,size_bytes:Buffer.byteLength(body)},body}
  const c={...fixtures.search.items[0],ordinal:1,char_start:1800,char_end:[...body].length,quote:[...body].slice(1800).join('')}
  validate({items:[c],mode:'keyword'},[detail],{q:'😀%_',mode:'keyword',top_k:1})
  assert.throws(()=>validate({items:[c],mode:'keyword'},[detail],{q:'😀.*',mode:'keyword',top_k:1}))
})
