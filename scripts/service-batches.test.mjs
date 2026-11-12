import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBatchInputs, validateBatch, validateRuntimeEvidence, evidencePaths, runtimeSteps } from './service-batches.mjs'

const inputs = () => loadBatchInputs()
const valid = () => {
  const inventory = validateBatch(inputs())
  const reports = Object.fromEntries(evidencePaths.map(path => [path, { time: new Date(2000).toISOString(), exit_code: 0, results: [{ label: 'run', exit_code: 0 }] }]))
  const id = 'sha256:' + 'a'.repeat(64)
  reports[evidencePaths[0]].source_dockerfile_sha256 = inventory.sources.find(s => s.service === 'mysql').dockerfile_sha256
  reports[evidencePaths[0]].summary = { image_id: id, HIGH: 0, CRITICAL: 0 }
  reports[evidencePaths[1]].summaries = inventory.sources.filter(s => s.service !== 'mysql').map(s => ({ service: s.service, image_id: id,
    dockerfile_sha256: s.dockerfile_sha256, HIGH: 0, CRITICAL: 0 }))
  reports[evidencePaths[2]].errors = []
  reports[evidencePaths[2]].results = ['IDF-SC-18 actual host loopback HTTPS, CA/SAN and anonymous denial',
    'real database-down health 503 and login 503 without credentials', 'account and class persist after database restart',
    'same account and original password after full container recreation',
    'DO-SC-12 DB-down host503 and independent static homepage200'].map(label => ({ label, exit_code: 0 }))
  reports[evidencePaths[2]].results.push({ label: 'DO-SC-13 actual runtime images and frontend exclude generated credentials', exit_code: 0,
    images: ['mysql', 'backend', 'frontend'].map(service => ({ service, image_id: id })) })
  reports[evidencePaths[3]].results = ['real MySQL identity scenarios', 'real consistent v3 mysqldump',
    'actual old artifact rejection and restored identities'].map(label => ({ label, exit_code: 0 }))
  return { inventory, reports }
}

test('DO-SC-11/13 current batch covers only real approved services/configuration and pinned sources', () => {
  const batch = validateBatch(inputs())
  assert.equal(batch.sources.length, 4)
  assert.ok(['pending_ge_review', 'reviewed'].includes(batch.review_status))
  assert.equal(batch.sources.find(s => s.service === 'backend').from.at(-1), 'scratch')
  assert.ok(inputs().registry.services.find(s => s.name === 'frontend').changes.includes('06'))
})

test('DO-SC-11 unregistered services, wrong build target/network and inactive keys block check', () => {
  const cases = [
    x => { x.compose.services.mcp = structuredClone(x.compose.services.backend) },
    x => { x.registry.services[1].build.target = 'preview' },
    x => { x.compose.services.backend.networks.push('ingress') },
    x => { x.registry.services[0].config_keys.push('MODEL_TOKEN') },
    x => { x.registry.services[0].required_dependencies.push('mcp') },
    x => { x.registry.services[0].changes = ['05'] },
    x => { x.registry.services.find(s => s.name === 'admin').config_keys = ['MYSQL_CA_FILE', 'IDENTITY_STATE_DIR'] },
  ]
  for (const mutate of cases) { const x = inputs(); mutate(x); assert.throws(() => validateBatch(x)) }
})

test('DO-SC-12 exactly3s probes pass while4s/image drift and unpinned base fail', () => {
  for (const timeout of ['3000ms', '3s']) { const x = inputs(); x.compose.services.backend.healthcheck.timeout = timeout; validateBatch(x) }
  for (const mutate of [
    x => { x.compose.services.backend.healthcheck.timeout = '3001ms' },
    x => { x.dockerfiles['backend/Dockerfile'] = x.dockerfiles['backend/Dockerfile'].replace('--timeout=3s', '--timeout=4s') },
    x => { x.dockerfiles['frontend/Dockerfile'] = x.dockerfiles['frontend/Dockerfile'].replace(/nginx@sha256:[a-f0-9]{64}/, 'nginx:latest') },
  ]) { const x = inputs(); mutate(x); assert.throws(() => validateBatch(x)) }
})

test('DO-SC-11/12 current real reports produce four immutable artifact IDs; fixtures are structural tests only', () => {
  const { reports, inventory } = valid()
  assert.equal(validateRuntimeEvidence(reports, 1000, 3000, inventory).length, 4)
})

test('DO-SC-11/13 stale/missing/failed evidence, source mismatch and high vulnerabilities block', () => {
  const cases = [
    r => { delete r[evidencePaths[3]] },
    r => { r[evidencePaths[0]].time = new Date(999).toISOString() },
    r => { r[evidencePaths[0]].time = new Date(3001).toISOString() },
    r => { r[evidencePaths[2]].exit_code = 1 },
    r => { r[evidencePaths[2]].errors = ['failure'] },
    r => { r[evidencePaths[0]].source_dockerfile_sha256 = 'wrong' },
    r => { r[evidencePaths[1]].summaries[0].HIGH = 1 },
    r => { r[evidencePaths[1]].summaries[0].image_id = 'mutable:tag' },
    r => { r[evidencePaths[2]].results.pop() },
    r => { r[evidencePaths[2]].results.at(-1).images[0].image_id = 'sha256:' + 'b'.repeat(64) },
    r => { r[evidencePaths[3]].results.pop() },
  ]
  for (const mutate of cases) { const { reports, inventory } = valid(); mutate(reports); assert.throws(() => validateRuntimeEvidence(reports, 1000, 3000, inventory)) }
})

test('DO-SC-03/11 npm verify retains the original three real programs and CI retains the new summary', () => {
  assert.deepEqual(runtimeSteps, ['scripts/verify-image-audits.mjs', 'scripts/verify-skeleton.mjs', 'scripts/verify-identity.mjs'])
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  assert.equal(pkg.scripts.verify, 'node scripts/verify-service-batches.mjs')
  assert.ok(pkg.scripts.check.includes('npm run check:service-batches'))
  assert.ok(readFileSync('.github/workflows/check.yml', 'utf8').includes('output/service-batches/results.json'))
})
