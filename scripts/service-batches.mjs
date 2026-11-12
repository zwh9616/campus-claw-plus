import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { parse } from 'yaml'

export const runtimeSteps = ['scripts/verify-image-audits.mjs', 'scripts/verify-skeleton.mjs', 'scripts/verify-identity.mjs']
export const evidencePaths = ['output/mysql-image-verify/results.json', 'output/application-image-verify/results.json',
  'output/identity-wiring/results.json', 'output/identity/results.json']
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const seconds = value => {
  assert.match(value ?? '', /^\d+(?:\.\d+)?(?:ms|s)$/, 'Probe timeout must be explicit')
  return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000)
}
export function loadBatchInputs() {
  const registry = JSON.parse(readFileSync('deploy/service-batches.json', 'utf8'))
  const compose = parse(readFileSync('compose.yaml', 'utf8'))
  const config = JSON.parse(readFileSync('docs/contracts/config-register.json', 'utf8'))
  const dockerfiles = Object.fromEntries(registry.services.map(s => [s.build.dockerfile, readFileSync(s.build.dockerfile, 'utf8')]))
  return { registry, compose, config, dockerfiles }
}

// DO-SC-11/13: this index documents existing approved services; it cannot activate planned ones.
export function validateBatch({ registry, compose, config, dockerfiles }) {
  assert.equal(registry.version, 1)
  assert.equal(registry.probe_timeout_ms, 3000)
  assert.equal(registry.deployment_wait_ms, 120000)
  assert.ok(['pending_ge_review', 'reviewed'].includes(registry.review_status))
  const names = registry.services.map(s => s.name)
  assert.equal(new Set(names).size, names.length, 'Duplicate registered service')
  assert.deepEqual([...names].sort(), ['admin', 'backend', 'frontend', 'mysql'], 'This batch does not authorize new services')
  assert.deepEqual([...names].sort(), Object.keys(compose.services).sort(), 'Compose service inventory differs from batch')
  const changes = new Set(registry.changes.map(c => c.id))
  assert.equal(changes.size, registry.changes.length)
  assert.deepEqual([...changes].sort(), ['01', '02', '04'], 'Batch approval scope differs')
  for (const change of registry.changes) {
    assert.ok(existsSync(change.spec), 'Approved spec link missing')
    assert.match(change.integrated_commit, /^[a-f0-9]{40}$/, 'Integration commit must be explicit')
    assert.ok(Number.isInteger(change.pull_request) && change.pull_request > 0)
  }
  const knownKeys = new Set(config.active.map(k => k.name))
  const declared = new Map(registry.services.map(s => [s.name, s]))
  const owner = { backend: 'backend', migration: 'admin', initializer: 'admin', nginx: 'frontend' }
  for (const key of config.active) for (const consumer of key.consumers ?? []) {
    if (owner[consumer]) assert.ok(declared.get(owner[consumer]).config_keys.includes(key.name), 'Per-process configuration not covered')
  }
  const usedKeys = new Set()
  const sources = []
  for (const service of registry.services) {
    const actual = compose.services[service.name]
    assert.ok(service.changes.length && service.changes.every(c => changes.has(c)), 'Service change is not registered')
    assert.equal(resolve(actual.build.context), resolve(service.build.context), 'Build context drift')
    assert.equal(resolve(actual.build.context, actual.build.dockerfile ?? 'Dockerfile'), resolve(service.build.dockerfile), 'Dockerfile drift')
    assert.equal(actual.build.target ?? null, service.build.target, 'Build target drift')
    assert.deepEqual(actual.profiles ?? [], service.profile ? [service.profile] : [], 'Service profile drift')
    assert.deepEqual((Array.isArray(actual.networks) ? actual.networks : Object.keys(actual.networks)).sort(), [...service.networks].sort(), 'Service network drift')
    for (const dep of [...service.required_dependencies, ...service.optional_dependencies]) {
      assert.ok(names.includes(dep) && dep !== service.name, 'Unregistered dependency')
    }
    assert.ok(service.unavailable?.trim(), 'Dependency failure behavior missing')
    for (const key of service.config_keys) { assert.ok(knownKeys.has(key), 'Unregistered configuration key'); usedKeys.add(key) }
    if (service.probe === null) assert.equal(actual.healthcheck, undefined, 'Offline tool cannot claim healthy')
    else {
      assert.deepEqual(actual.healthcheck?.test, service.probe, 'Health probe drift')
      assert.ok(seconds(actual.healthcheck.timeout) <= registry.probe_timeout_ms, 'Probe exceeds3s')
    }
    const text = dockerfiles[service.build.dockerfile]
    const stages = new Set()
    const from = [...text.matchAll(/^FROM\s+(\S+)(?:\s+AS\s+(\S+))?\s*$/gmi)]
    assert.ok(from.length, 'No image sources')
    for (const [, image, stage] of from) {
      assert.ok(image === 'scratch' || stages.has(image) || /^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$/.test(image), 'Image source must be pinned')
      if (stage) stages.add(stage)
    }
    for (const [, duration] of text.matchAll(/^HEALTHCHECK\b[^\r\n]*--timeout=(\S+)/gm)) {
      assert.ok(seconds(duration) <= registry.probe_timeout_ms, 'Image probe exceeds3s')
    }
    sources.push({ service: service.name, dockerfile: service.build.dockerfile,
      dockerfile_sha256: sha256(text), target: service.build.target, from: from.map(m => m[1]) })
  }
  assert.deepEqual([...usedKeys].sort(), [...knownKeys].sort(), 'Active configuration not covered by batch')
  assert.ok(registry.pending.length && registry.pending.every(p => p.reason?.trim() && p.capability?.trim()))
  return { batch: registry.batch, review_status: registry.review_status, sources,
    probe_timeout_ms: registry.probe_timeout_ms, deployment_wait_ms: registry.deployment_wait_ms }
}

// Called only after the original three real verification programs returned zero.
export function validateRuntimeEvidence(reports, started, finished, inventory) {
  for (const path of evidencePaths) {
    const report = reports[path]
    assert.ok(report, 'Missing real runtime report')
    const at = Date.parse(report.time)
    assert.ok(Number.isFinite(at) && at >= started && at <= finished, 'Stale runtime report cannot pass current batch')
    assert.ok(report.results?.length, 'Runtime steps missing')
    if (path !== 'output/identity/results.json') assert.equal(report.exit_code, 0, 'Runtime report failed')
  }
  const mysql = reports[evidencePaths[0]]
  const applications = reports[evidencePaths[1]]
  assert.equal(mysql.source_dockerfile_sha256, inventory.sources.find(s => s.service === 'mysql').dockerfile_sha256, 'MySQL source mismatch')
  const images = [{ service: 'mysql', ...mysql.summary }]
  for (const source of inventory.sources.filter(s => s.service !== 'mysql')) {
    const image = applications.summaries.find(s => s.service === source.service)
    assert.ok(image, 'Actual image scan missing')
    assert.equal(image.dockerfile_sha256, source.dockerfile_sha256, 'Scanned application source mismatch')
    images.push(image)
  }
  for (const image of images) {
    assert.match(image.image_id ?? '', /^sha256:[a-f0-9]{64}$/, 'Immutable image ID missing')
    assert.equal(image.HIGH, 0, 'High vulnerabilities block batch')
    assert.equal(image.CRITICAL, 0, 'Critical vulnerabilities block batch')
  }
  const wire = reports[evidencePaths[2]]
  assert.deepEqual(wire.errors, [], 'Wiring errors block batch')
  const runtime = wire.results.find(s => s.label === 'DO-SC-13 actual runtime images and frontend exclude generated credentials' && s.exit_code === 0)
  assert.ok(runtime, 'Runtime image/privacy evidence missing')
  for (const service of ['mysql', 'backend', 'frontend']) {
    assert.equal(runtime.images?.find(s => s.service === service)?.image_id, images.find(s => s.service === service).image_id,
      'Running image differs from the scanned image')
  }
  for (const label of ['IDF-SC-18 actual host loopback HTTPS, CA/SAN and anonymous denial',
    'real database-down health 503 and login 503 without credentials',
    'account and class persist after database restart', 'same account and original password after full container recreation',
    'DO-SC-12 DB-down host503 and independent static homepage200']) {
    assert.ok(wire.results.some(s => s.label === label && s.exit_code === 0), 'Required real wiring scenario missing')
  }
  for (const label of ['real MySQL identity scenarios', 'real consistent v3 mysqldump', 'actual old artifact rejection and restored identities']) {
    assert.ok(reports[evidencePaths[3]].results.some(s => s.label === label && s.exit_code === 0), 'Required real database scenario missing')
  }
  return images.map(({ service, image_id, HIGH, CRITICAL }) => ({ service, image_id, HIGH, CRITICAL }))
}
