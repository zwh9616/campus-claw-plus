import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname, relative, isAbsolute } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import SwaggerParser from '@apidevtools/swagger-parser'
import { parseDocument } from 'yaml'
import { validateOperationBoundary, validateConfigSample, validateOutboundCandidate } from './contracts/validate.mjs'

const root = resolve('docs/contracts')
const json = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
const document = parseDocument(readFileSync(resolve(root, 'openapi.yaml'), 'utf8'), { uniqueKeys: true })
assert.equal(document.errors.length, 0, 'Invalid YAML or duplicate key')
const api = document.toJS()
validateOperationBoundary(api, json('endpoint-register.json'))
validateConfigSample(readFileSync('.env.example', 'utf8'), json('config-register.json'))
validateOutboundCandidate(json('config-register.json'))

// Reject remote and escaping references before the parser can read anything.
function inspect(value, file, inSchema = false) {
  if (!value || typeof value !== 'object') return
  if (value.$ref) {
    const [path] = value.$ref.split('#')
    assert.ok(!/^[a-z]+:/i.test(path) && !isAbsolute(path), 'Only local contract refs allowed')
    if (path) {
      const target = resolve(dirname(file), path)
      const rel = relative(root, target)
      assert.ok(!rel.startsWith('..') && !isAbsolute(rel), 'Reference escapes contracts')
    }
  }
  if (inSchema && value.type === 'object') {
    assert.equal(value.additionalProperties, false, 'Contract objects must be closed')
    assert.ok(value.properties, 'No arbitrary object placeholders')
    assert.deepEqual([...(value.required ?? [])].sort(), Object.keys(value.properties).sort(), 'Every declared field is required; optionality uses null')
  }
  assert.equal(value.nullable, undefined, 'OpenAPI 3.0 nullable is forbidden')
  for (const child of Object.values(value)) inspect(child, file, inSchema)
}
inspect(api, resolve(root, 'openapi.yaml'))
const sources = readdirSync(resolve(root, 'schemas')).filter(x => x.endsWith('.schema.json')).map(file => {
  const source = json(`schemas/${file}`)
  assert.equal(source.$schema, api.jsonSchemaDialect)
  inspect(source, resolve(root, 'schemas', file), true)
  const name = file.slice(0, -12)
  assert.deepEqual(api.components.schemas[name], { $ref: `./schemas/${file}` }, 'OpenAPI must reference the sole Schema source')
  return source
})
assert.equal(Object.keys(api.components.schemas).length, sources.length)
function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true })
  addFormats(ajv)
  return ajv
}
const standalone = validator()
sources.forEach(source => standalone.addSchema(source))
sources.forEach(source => assert.ok(standalone.getSchema(source.$id)))

// Structural OpenAPI 3.1 validation plus local-only dereferencing.
const parsed = await SwaggerParser.validate(resolve(root, 'openapi.yaml'), {
  resolve: {
    http: false,
    // $id establishes canonical URLs. Resolve only the already-loaded local
    // sources; never perform network requests for those identifiers.
    contracts: {
      order: 1,
      canRead: file => sources.some(source => source.$id === file.url),
      read: file => JSON.stringify(sources.find(source => source.$id === file.url)),
    },
  }, dereference: { circular: false },
})
// After dereferencing, IDs are redundant and can collide when nested repeatedly.
// Remove identifiers only; no validation keyword or constraint is removed.
function withoutIds(value) {
  if (Array.isArray(value)) return value.map(withoutIds)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([k]) => k !== '$id').map(([k, v]) => [k, withoutIds(v)]))
}
const dereferenced = validator()
const validators = new Map(Object.entries(parsed.components.schemas).map(([name, schema]) => [name, dereferenced.compile(withoutIds(schema))]))
const fixtures = json('fixtures/schema-cases.json')
const semantic = json('fixtures/semantic-cases.json')
// Semantic tests must start from structurally valid shared contract values.
const semanticFixtures = [
  { name: 'semantic citation', schema: 'Citation', data: semantic.citation, valid: true },
  { name: 'semantic grade', schema: 'GradeResult', data: semantic.grade, valid: true },
  ...Object.entries(semantic.sse).map(([event, data]) => ({
    name: `semantic SSE ${event}`, schema: 'SSE', data: { event, data }, valid: true,
  })),
]
for (const fixture of [...fixtures, ...semanticFixtures]) {
  const a = standalone.getSchema(`https://campusclaw.invalid/contracts/v1/${fixture.schema}.schema.json`)
  const b = validators.get(fixture.schema)
  assert.ok(a && b, `Unknown schema ${fixture.schema}`)
  const sourceResult = a(structuredClone(fixture.data))
  const derefResult = b(structuredClone(fixture.data))
  assert.equal(sourceResult, fixture.valid, `Standalone: ${fixture.name}: ${JSON.stringify(a.errors)}`)
  assert.equal(derefResult, fixture.valid, `OpenAPI: ${fixture.name}: ${JSON.stringify(b.errors)}`)
  assert.equal(sourceResult, derefResult, `Dialect disagreement: ${fixture.name}`)
}
let exampleCount = 0
function checkExamples(value) {
  if (!value || typeof value !== 'object') return
  if (value.schema && value.examples) {
    const check = validator().compile(withoutIds(value.schema))
    for (const example of Object.values(value.examples)) {
      assert.ok(check(example.value), `Invalid operation example: ${JSON.stringify(check.errors)}`)
      exampleCount++
    }
  }
  for (const child of Object.values(value)) checkExamples(child)
}
checkExamples(parsed.paths)
console.log(`Contracts: ${sources.length} schemas; ${fixtures.length} positive/negative fixtures and ${semanticFixtures.length} semantic inputs agree in both paths; ${exampleCount} operation examples; 7 current/frozen operations. Planned operations absent.`)
