import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadBatchInputs, validateBatch, validateRuntimeEvidence, evidencePaths, runtimeSteps, auditedImageServices, retainedImageTags,
  assignmentTests, assignmentRecoverySteps, assignmentHTTPSPhases } from './service-batches.mjs'

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
  // These reports only exercise the validator. Real05 output is still produced by the original Docker programs.
  const passed = names => names.map(name => `--- PASS: ${name} (0.01s)`).join('\n')
  reports[evidencePaths[3]].results[0].output = passed(assignmentTests)
  reports[evidencePaths[3]].results.push(...assignmentRecoverySteps.map(label => ({ label, exit_code: 0,
    output: label === assignmentRecoverySteps.at(-1) ? passed(['TestATBackupRestoreAndActualTargetMatrix']) : '' })))
  for (const label of assignmentHTTPSPhases) {
    const step = reports[evidencePaths[2]].results.find(s => s.label === label)
    const result = { label, exit_code: 0, output: passed(['TestIDFWiring']) +
      '\nAT-SC-01..08/21 default HTTPS authorization, durable 202 and genuine pending persistence passed' }
    if (step) Object.assign(step, result)
    else reports[evidencePaths[2]].results.push(result)
  }
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
    x => { x.registry.services.find(s => s.name === 'admin').changes = ['01', '04'] },
    x => { x.registry.services.find(s => s.name === 'frontend').changes = ['01', '02'] },
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
    r => { r[evidencePaths[2]].results = r[evidencePaths[2]].results.filter(s => !s.images) },
    r => { r[evidencePaths[2]].results.find(s => s.images).images[0].image_id = 'sha256:' + 'b'.repeat(64) },
    r => { r[evidencePaths[3]].results.pop() },
  ]
  for (const mutate of cases) { const { reports, inventory } = valid(); mutate(reports); assert.throws(() => validateRuntimeEvidence(reports, 1000, 3000, inventory)) }
})

test('DO-SC-11/12 every real05 SQL/worker suite and recovery step is mandatory; zero exit without tests is insufficient', () => {
  for (const name of assignmentTests) {
    for (const replacement of ['', `--- SKIP: ${name} (0.01s)`, `--- FAIL: ${name} (0.01s)`, `--- PASS: ${name}Extra (0.01s)`]) {
      const { reports, inventory } = valid()
      const step = reports[evidencePaths[3]].results[0]
      step.output = step.output.replace(`--- PASS: ${name} (0.01s)`, replacement)
      assert.throws(() => validateRuntimeEvidence(reports, 1000, 3000, inventory), name)
    }
  }
  for (const label of assignmentRecoverySteps) {
    for (const state of ['missing', 'failed', 'duplicate']) {
      const { reports, inventory } = valid()
      const results = reports[evidencePaths[3]].results
      const step = results.find(s => s.label === label)
      if (state === 'missing') results.splice(results.indexOf(step), 1)
      else if (state === 'failed') step.exit_code = 1
      else results.push(structuredClone(step))
      assert.throws(() => validateRuntimeEvidence(reports, 1000, 3000, inventory), label)
    }
  }
})

test('DO-SC-12 each real HTTPS phase must prove05 pending persistence, without failed/skipped/nested substitute tests', () => {
  for (const label of assignmentHTTPSPhases) {
    for (const mutate of [
      s => { s.exit_code = 1 },
      s => { s.output = '' },
      s => { s.output = s.output.replace('durable 202', 'fake success') },
      s => { s.output = s.output.replace('--- PASS:', '    --- PASS:') },
      s => { s.output += '\n    --- SKIP: TestIDFWiring/persistence (0.01s)' },
    ]) {
      const { reports, inventory } = valid()
      mutate(reports[evidencePaths[2]].results.find(s => s.label === label))
      assert.throws(() => validateRuntimeEvidence(reports, 1000, 3000, inventory), label)
    }
  }
})

test('DO-SC-12 backup success text and duplicate HTTPS phases cannot substitute for real complete evidence', () => {
  for (const mutate of [
    r => { r[evidencePaths[3]].results.find(s => s.label === assignmentRecoverySteps.at(-1)).output = 'command exited zero' },
    r => { r[evidencePaths[2]].results.push(structuredClone(r[evidencePaths[2]].results.find(s => s.label === assignmentHTTPSPhases[0]))) },
  ]) {
    const { reports, inventory } = valid()
    mutate(reports)
    assert.throws(() => validateRuntimeEvidence(reports, 1000, 3000, inventory))
  }
})

test('DO-SC-03/11 npm verify retains the original three real programs and CI retains the new summary', () => {
  assert.deepEqual(runtimeSteps, ['scripts/verify-image-audits.mjs', 'scripts/verify-skeleton.mjs', 'scripts/verify-identity.mjs'])
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  assert.equal(pkg.scripts.verify, 'node scripts/verify-service-batches.mjs')
  assert.ok(pkg.scripts.check.includes('npm run check:service-batches'))
  assert.ok(readFileSync('.github/workflows/check.yml', 'utf8').includes('output/service-batches/results.json'))
})

test('DO-SC-11 exact audited IDs are selected with no pulls; incomplete/unsafe scans cannot start runtime', () => {
  const { reports, inventory } = valid()
  const select = () => auditedImageServices(reports[evidencePaths[0]], reports[evidencePaths[1]], inventory)
  const services = select()
  assert.equal(Object.keys(services).length, 4)
  assert.equal(services.mysql.image, reports[evidencePaths[0]].summary.image_id)
  assert.ok(Object.values(services).every(s => s.pull_policy === 'never'))
  for (const mutate of [
    r => { r[evidencePaths[1]].summaries.pop() },
    r => { r[evidencePaths[0]].summary.image_id = 'mysql:latest' },
    r => { r[evidencePaths[1]].summaries[0].HIGH = 1 },
    r => { r[evidencePaths[0]].exit_code = 1 },
    r => { r[evidencePaths[1]].summaries[0].dockerfile_sha256 = 'wrong' },
  ]) { const x = valid(); mutate(x.reports); assert.throws(() => auditedImageServices(x.reports[evidencePaths[0]], x.reports[evidencePaths[1]], x.inventory)) }
})

test('DO-SC-11 verification cleanup excludes old reports and unrelated image references', () => {
  const { reports } = valid()
  reports[evidencePaths[0]].retained_tags = ['campus-mysql-audit-0123456789ab:verification']
  assert.equal(retainedImageTags(reports, 1000).length, 1)
  assert.deepEqual(retainedImageTags(reports, 3000), [])
  reports[evidencePaths[0]].retained_tags = ['other-project:latest']
  assert.throws(() => retainedImageTags(reports, 1000))
})
