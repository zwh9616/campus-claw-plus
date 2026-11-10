import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runSequence, acquireLock } from './gate-runner.mjs'
import { isolateCompose } from './verification-resources.mjs'

const names = ['check', 'audit', 'secret-scan', 'verify']
const step = (name, source = '', timeoutMs = 5000) => ({ name, command: process.execPath, args: ['-e', source], timeoutMs })
const quiet = { stdio: 'ignore' }

test('DO-SC-03 serial success executes all stages in order', async () => {
  const started = []
  const result = await runSequence(names.map(name => step(name)), { ...quiet, onStart: name => started.push(name) })
  assert.equal(result.exitCode, 0)
  assert.deepEqual(started, names)
  assert.deepEqual(result.notRun, [])
  assert.ok(result.results.every(stage => stage.reason === 'passed'))
})

for (const name of names) {
  test(`DO-SC-04 ${name} failure preserves exit code and prevents subsequent execution`, async () => {
    const started = []
    const result = await runSequence(names.map(n => step(n, n === name ? 'process.exit(17)' : '')), {
      ...quiet, onStart: n => started.push(n),
    })
    assert.equal(result.exitCode, 17)
    assert.deepEqual(started, names.slice(0, names.indexOf(name) + 1))
    assert.deepEqual(result.notRun, names.slice(names.indexOf(name) + 1))
  })
}

test('DO-SC-05 missing executable is failure, not a skipped pass', async () => {
  const result = await runSequence([{ name: 'missing-tool', command: 'campus-missing-tool-404', args: [], timeoutMs: 5000 }, step('later')], quiet)
  assert.notEqual(result.exitCode, 0)
  assert.equal(result.results[0].reason, 'ENOENT')
  assert.deepEqual(result.notRun, ['later'])
})

test('DO-SC-05 signalled child cannot pass', async () => {
  const result = await runSequence([step('signal', "process.kill(process.pid, 'SIGTERM')"), step('later')], quiet)
  assert.notEqual(result.exitCode, 0)
  assert.deepEqual(result.notRun, ['later'])
})

test('DO-SC-05 timeout terminates stage and fails closed', async () => {
  const result = await runSequence([step('timeout', 'setInterval(() => {}, 1000)', 100), step('later')], quiet)
  assert.equal(result.exitCode, 124)
  assert.equal(result.results[0].reason, 'timeout')
  assert.deepEqual(result.notRun, ['later'])
})

test('DO-SC-05 cancellation before and during a stage prevents later commands', async () => {
  for (const before of [true, false]) {
    const controller = new AbortController()
    if (before) controller.abort()
    const result = await runSequence([step('cancel', 'setInterval(() => {}, 1000)'), step('later')], {
      ...quiet, signal: controller.signal, onStart: () => controller.abort(),
    })
    assert.equal(result.exitCode, 130)
    assert.deepEqual(result.notRun, ['later'])
  }
})

test('DO-SC-05 concurrent calls in one checkout fail without stealing its lock', () => {
  const directory = mkdtempSync(join(tmpdir(), 'campus-gate-test-'))
  const path = join(directory, 'gate.lock')
  try {
    const release = acquireLock(path)
    try { assert.throws(() => acquireLock(path), error => error.message.includes('Gate lock exists') && error.message.includes(path)) }
    finally { release() }
    acquireLock(path)()
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('DO-SC-05 different runs isolate images and atomically assigned ports; keep contract/probes', () => {
  const source = { name: 'original', services: {
    backend: { image: 'original-backend', environment: { HTTP_PORT: '18080' },
      healthcheck: { test: ['CMD', '/server', '--healthcheck'] }, ports: [{ host_ip: '127.0.0.1', target: 18080, published: '18080' }] },
    frontend: { image: 'original-frontend', ports: [{ host_ip: '127.0.0.1', target: 80, published: '5173' }] },
  } }
  const first = isolateCompose(source, 'campus-verify-first')
  const second = isolateCompose(source, 'campus-verify-second')
  assert.notEqual(first.services.backend.image, second.services.backend.image)
  for (const config of [first, second]) {
    assert.deepEqual(config.services.backend.environment, source.services.backend.environment)
    assert.deepEqual(config.services.backend.healthcheck, source.services.backend.healthcheck)
    assert.ok(Object.values(config.services).every(service => service.ports.every(port => port.published === '0')))
  }
  assert.equal(source.services.frontend.ports[0].published, '5173')
  assert.equal(source.services.backend.image, 'original-backend')
  assert.throws(() => isolateCompose(source, 'unrelated-project'))
  assert.throws(() => isolateCompose({ services: { backend: {} } }, 'campus-verify-test'))
})

test('DO-SC-03/06 Make remains a thin npm wrapper, stable CI delegates complete gate', () => {
  const make = readFileSync('Makefile', 'utf8')
  assert.match(make, /^\.NOTPARALLEL:/m)
  assert.match(make, /setup:\n\tnpm ci\n\tnpm run setup/)
  assert.match(make, /check audit secret-scan verify gate:\n\tnpm run \$@/)
  const ci = readFileSync('.github/workflows/check.yml', 'utf8')
  assert.match(ci, /\n  check:\n/)
  assert.match(ci, /run: npm ci/)
  assert.match(ci, /run: npm run setup/)
  assert.match(ci, /make gate/)
  assert.doesNotMatch(ci, /continue-on-error|paths-ignore|\n\s+paths:/)
})

test('DO-SC-05 Make installation failure stops setup; -j does not run targets concurrently', t => {
  const make = spawnSync('make', ['--version'], { encoding: 'utf8' })
  if (make.error?.code === 'ENOENT') {
    assert.equal(make.status, null)
    t.diagnostic('GNU Make unavailable: real Make execution unverified here; use npm gate. CI and Docker test environment must execute this case.')
    return
  }
  assert.equal(make.status, 0)
  const directory = mkdtempSync(join(tmpdir(), 'campus-make-test-'))
  try {
    mkdirSync(join(directory, 'bin'))
    writeFileSync(join(directory, 'Makefile'), readFileSync('Makefile'))
    // This is an orchestration double, not a dependency install or real gate.
    const fake = '#!/bin/sh\nprintf "%s\\n" "$*" >> calls\nif [ "$*" = "ci" ]; then exit 23; fi\nif ! mkdir busy 2>/dev/null; then exit 24; fi\nsleep 0.1\nrmdir busy\n'
    writeFileSync(join(directory, 'bin', 'npm'), fake, { mode: 0o755 })
    const env = { ...process.env, PATH: join(directory, 'bin') + ':' + process.env.PATH }
    const install = spawnSync('make', ['setup'], { cwd: directory, env, encoding: 'utf8' })
    assert.notEqual(install.status, 0)
    assert.match(install.stderr, /23/)
    assert.equal(readFileSync(join(directory, 'calls'), 'utf8'), 'ci\n')
    writeFileSync(join(directory, 'calls'), '')
    const parallel = spawnSync('make', ['-j8', 'check', 'audit', 'secret-scan', 'verify'], { cwd: directory, env, encoding: 'utf8' })
    assert.equal(parallel.status, 0, parallel.stderr)
    assert.equal(readFileSync(join(directory, 'calls'), 'utf8'), 'run check\nrun audit\nrun secret-scan\nrun verify\n')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
