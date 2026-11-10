import assert from 'node:assert/strict'

// MR-SC-01..10: this independent allowlist permits contracts, never runtime routes.
export const materialOperations = [
  ['GET', '/api/v1/materials', [200], [400, 401, 503, 504]],
  ['GET', '/api/v1/materials/{id}', [200], [400, 401, 404, 503, 504]],
  ['GET', '/api/v1/materials/{id}/download', [200], [400, 401, 404, 503, 504]],
  ['POST', '/api/v1/materials', [200, 201], [400, 401, 403, 409, 413, 429, 503, 504]],
  ['POST', '/api/v1/materials/{id}/retry-index', [200], [400, 401, 403, 404, 429, 503, 504]],
  ['GET', '/api/v1/search', [200], [400, 401, 503, 504]],
]
const errorCodes = {400:'VALIDATION_ERROR',401:'UNAUTHENTICATED',403:'FORBIDDEN',404:'NOT_FOUND',409:'CONFLICT',413:'PAYLOAD_TOO_LARGE',429:'RATE_LIMITED',503:'DEPENDENCY_UNAVAILABLE',504:'UPSTREAM_TIMEOUT'}
const ref = (name, property) => ({$ref:`./schemas/${name}.schema.json${property ? `#/properties/${property}` : ''}`})
const trim = value => value.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, '')
const codepoints = value => [...value]
const validText = value => typeof value === 'string' && value.isWellFormed()

export function validateMaterialOperationProfiles(api) {
  const expectedParameters = [
    ['query:page', 'query:page_size'], ['path:id'], ['path:id'],
    ['header:Idempotency-Key', 'header:Origin'], ['path:id', 'header:Origin'],
    ['query:q', 'query:mode', 'query:top_k'],
  ]
  materialOperations.forEach(([method, path, success, errors], index) => {
    const op = api.paths[path]?.[method.toLowerCase()]
    assert.ok(op, `Missing 04 operation: ${method} ${path}`)
    assert.equal(op['x-contract-status'], 'frozen', '04 cannot become current before its implementation review')
    assert.equal(op['x-owner-change'], '04')
    assert.equal(op['x-spec-change'], 'openspec/changes/2026-11-10-materials-retrieval')
    assert.deepEqual(op.security, [{BearerAuth:[]}], 'Material operations must not accept anonymous/Cookie authorization')
    assert.deepEqual(op['x-authorization'], {
      source:'validated-server-session', roles:method === 'POST' ? ['teacher'] : ['teacher','student'],
      class_scope:'active-membership', student_visibility:'ready',
      order:['authentication','action-role','resource-visibility','business-input'],
      cross_class:'404-identical-to-missing', rejected_business_side_effects:false,
    })
    const upload = method === 'POST' && path === '/api/v1/materials'
    assert.deepEqual(op['x-request-rules'], {unknown_query:'reject-400',duplicate_parameters:'reject-400',request_body:upload ? 'multipart-only' : 'forbidden'})
    assert.deepEqual(op.parameters.map(p => `${p.in}:${p.name}`).sort(), [...expectedParameters[index]].sort())
    for (const p of op.parameters) {
      if (p.in === 'path') { assert.equal(p.required, true); assert.deepEqual(p.schema, ref('ID')) }
      if (p.name === 'Origin') assert.equal(p.required, false)
      if (p.in === 'query') {
        assert.equal(p.required, p.name === 'q')
        assert.deepEqual(p.schema, ref(path === '/api/v1/search' ? 'KeywordSearchParameters' : 'MaterialListParameters', p.name))
      }
      if (p.name === 'Idempotency-Key') { assert.equal(p.required, true); assert.deepEqual(p.schema, ref('MaterialIdempotencyKey')) }
    }
    assert.deepEqual(Object.keys(op.responses).sort(), [...success, ...errors].map(String).sort(), 'Wrong 04 success/error set')
    for (const [status, response] of Object.entries(op.responses)) {
      assert.deepEqual(response.headers['X-Request-ID'].schema, {type:'string',pattern:'^[0-9a-f]{32}$',minLength:32,maxLength:32})
      assert.deepEqual(response.headers['Cache-Control'].schema, {const:'no-store'})
      if (Number(status) < 400) continue
      assert.deepEqual(response.content['application/json'].schema, ref('Error'))
      assert.equal(response['x-error-code'], errorCodes[status])
      const body = response.content['application/json'].examples.contract.value
      assert.equal(body.error.code, errorCodes[status])
      assert.equal(body.error.details, null)
      assert.deepEqual(body.error.fields, [])
      if (status === '404') assert.equal(body.error.message, '资源不存在')
      if (status === '429') assert.deepEqual(response.headers['Retry-After'].schema, {type:'integer',minimum:1})
    }
    if (method === 'POST') assert.deepEqual(op['x-rate-limit'], {scope:'user_id',window_seconds:60,quota:12,replays_count:true,switch_class_resets:false})
    if (upload) {
      assert.deepEqual(op['x-upload-limits'], {file_bytes:262144,multipart_bytes:278528,filename_extension:'.txt',duplicate_parts:'reject-400',unknown_parts:'reject-400',declared_and_streamed:true})
      assert.deepEqual(op['x-idempotency'], {scope:['user_id','class_id','Idempotency-Key'],same_payload:200,different_payload:409,replay:'current-material-no-reindex'})
      assert.equal(op.requestBody.required, true)
      assert.deepEqual(Object.keys(op.requestBody.content), ['multipart/form-data'])
      assert.deepEqual(op.requestBody.content['multipart/form-data'].schema, ref('MaterialUpload'))
    } else assert.equal(op.requestBody, undefined)
    if (path.endsWith('/download')) {
      const response = op.responses['200']
      assert.deepEqual(Object.keys(response.content), ['text/plain; charset=utf-8'])
      assert.deepEqual(response.content['text/plain; charset=utf-8'].schema, ref('MaterialUpload','file'))
      assert.deepEqual(response.headers['X-Content-Type-Options'].schema, {const:'nosniff'})
      assert.deepEqual(response.headers['Content-Disposition'].schema, {type:'string',pattern:'^attachment; filename="material-[1-9][0-9]{0,18}\\.txt"$'})
    } else {
      const schema = upload || method === 'POST' ? 'Material' : path === '/api/v1/search' ? 'KeywordSearchResponse' : path.endsWith('/{id}') ? 'MaterialDetail' : 'MaterialPage'
      for (const status of success) assert.deepEqual(op.responses[status].content['application/json'].schema, ref(schema))
    }
  })
}

// These are contract-example checks, not an HTTP parser, authorization or storage service.
export function validateMaterialUploadExample(upload) {
  assert.ok(validText(upload.title) && validText(upload.file), 'Well-formed Unicode text required')
  const title = trim(upload.title)
  assert.ok(codepoints(title).length >= 1 && codepoints(title).length <= 200 && !/\p{Cc}/u.test(title))
  assert.ok(Buffer.byteLength(upload.file, 'utf8') >= 1 && Buffer.byteLength(upload.file, 'utf8') <= 262144, 'Raw UTF-8 byte limit')
  assert.ok(!/[\p{Cc}]/u.test(upload.file.replace(/[\t\r\n]/g, '')), 'Invalid text control character')
  const normalized = upload.file.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  assert.ok(trim(normalized).length > 0, 'Normalized body cannot be empty/whitespace')
}

export function validateMaterialDetailExample(detail) {
  const {material, body} = detail
  // Only one leading BOM is removed from the original. A second BOM may remain.
  assert.ok(validText(body) && trim(body).length > 0 && !body.includes('\r'))
  assert.ok(!/\p{Cc}/u.test(body.replace(/[\t\n]/g, '')))
  assert.ok(Buffer.byteLength(body, 'utf8') <= material.size_bytes, 'Normalized body cannot exceed raw bytes')
  assert.equal(trim(material.title), material.title)
}

export function validateMaterialPageExample(page) {
  assert.ok(page.items.length <= page.page_size && page.items.length <= page.total)
  const remaining = BigInt(page.total) - (BigInt(page.page) - 1n) * BigInt(page.page_size)
  const expected = remaining <= 0n ? 0 : Number(remaining < BigInt(page.page_size) ? remaining : BigInt(page.page_size))
  assert.equal(page.items.length, expected, 'Snapshot count and requested page must agree')
  for (let i = 1; i < page.items.length; i++) assert.ok(BigInt(page.items[i-1].id) > BigInt(page.items[i].id), 'Unique descending IDs')
}

export function validateKeywordResultExample(result, details, query) {
  assert.equal(trim(query.q), query.q)
  assert.ok(result.items.length <= query.top_k)
  const ids = new Set()
  let previous
  for (const c of result.items) {
    const detail = details.find(d => d.material.id === c.material_id)
    assert.ok(detail, 'Every citation must have a supplied authorized-source example')
    validateMaterialDetailExample(detail)
    assert.equal(detail.material.index_status, 'ready')
    assert.equal(c.material_version, detail.material.version)
    assert.equal(c.title, detail.material.title)
    assert.equal(c.url, `/api/v1/materials/${c.material_id}`)
    const text = codepoints(detail.body)
    assert.equal(c.char_start, c.ordinal * 1800)
    assert.ok(c.char_start < text.length && (c.ordinal === 0 || c.char_start + 200 < text.length), 'No redundant trailing chunk')
    assert.equal(c.char_end, Math.min(c.char_start + 2000, text.length))
    assert.equal(c.quote, text.slice(c.char_start, c.char_end).join(''))
    assert.ok(c.quote.includes(query.q), 'Literal match required within a chunk')
    assert.ok(!ids.has(c.chunk_id), 'Duplicate chunk')
    ids.add(c.chunk_id)
    if (previous) assert.ok(BigInt(previous.material_id) > BigInt(c.material_id) || (previous.material_id === c.material_id && (previous.ordinal < c.ordinal || (previous.ordinal === c.ordinal && BigInt(previous.chunk_id) < BigInt(c.chunk_id)))), 'Stable citation order')
    previous = c
  }
}

export function materialBoundaryFixtures() {
  const fixture = (name,schema,data,valid) => ({name:`04 boundary ${name}`,schema,data,valid})
  const material={id:'1',title:'边界',version:1,index_status:'ready',size_bytes:262144,created_at:'2026-11-10T08:00:00.000Z'}
  return [
    fixture('raw file max', 'MaterialUpload', {title:'边界',file:'x'.repeat(262144)}, true),
    fixture('raw file over max', 'MaterialUpload', {title:'边界',file:'x'.repeat(262145)}, false),
    fixture('nonBMP query max', 'KeywordSearchParameters', {q:'😀'.repeat(2000),mode:'keyword',top_k:10}, true),
    fixture('nonBMP query overflow', 'KeywordSearchParameters', {q:'😀'.repeat(2001),mode:'keyword',top_k:10}, false),
    fixture('page max', 'MaterialListParameters', {page:2147483647,page_size:50}, true),
    fixture('page overflow', 'MaterialListParameters', {page:2147483648,page_size:50}, false),
    fixture('key max', 'MaterialIdempotencyKey', 'A'.repeat(64), true),
    fixture('detail max', 'MaterialDetail', {material,body:'x'.repeat(262144)}, true),
    fixture('detail overflow', 'MaterialDetail', {material,body:'x'.repeat(262145)}, false),
    fixture('detail empty', 'MaterialDetail', {material,body:''}, false),
    fixture('canonical query trim', 'KeywordSearchParameters', {q:' q ',mode:'keyword',top_k:4}, false),
    fixture('canonical title trim', 'Material', {...material,title:' 标题 '}, false),
  ]
}
