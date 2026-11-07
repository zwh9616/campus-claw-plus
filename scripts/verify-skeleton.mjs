import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import { isolateCompose } from './verification-resources.mjs'

const cwd = process.cwd()
const env = { ...process.env }
delete env.HTTP_PORT
const project = 'campus-verify-' + randomUUID()
const sourceCompose = ['compose', '-f', resolve('compose.yaml'), '-p', project]
let compose
const results = []
const run = (args, options = {}) => {
  const result = spawnSync('docker', args, { cwd, env, encoding: 'utf8', timeout: 300000, ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('docker ' + args.join(' ') + '\n' + result.stdout + result.stderr)
  return result.stdout
}
const configText = readFileSync('.env', 'utf8')
const match = configText.match(/^HTTP_PORT=(\d+)\s*$/m)
assert.ok(match, 'Fill HTTP_PORT in .env before verification')
const port = Number(match[1])
let url
let frontendUrl
let image
const temp = mkdtempSync(join(tmpdir(), 'campus-claw-plus-'))
let validContainer
let images = []
let cleaned = false
const cleanup = () => {
  if (cleaned) return
  cleaned = true
  const cleanupErrors = []
  const attempt = action => { try { action() } catch (error) { cleanupErrors.push(error) } }
  try {
    if (validContainer) attempt(() => run(['rm', '-f', validContainer]))
    if (compose) attempt(() => run([...compose, 'down', '--timeout', '15']))
    for (const tag of images) {
      // Only tags generated for this invocation; do not prune shared images/cache.
      const exists = spawnSync('docker', ['image', 'inspect', tag], { stdio: 'ignore', timeout: 30000 })
      if (exists.status === 0) attempt(() => run(['image', 'rm', tag]))
    }
  } finally {
    assert.equal(dirname(resolve(temp)), resolve(tmpdir()))
    assert.match(basename(temp), /^campus-claw-plus-/)
    rmSync(temp, { recursive: true, force: true })
    mkdirSync('output/verification', { recursive: true })
    writeFileSync('output/verification/local-results.json', JSON.stringify({
      date: new Date().toISOString(), commit: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
      scope: 'Local Docker execution only; not independent peer or new-session acceptance',
      project, results, cleanup: cleanupErrors.length ? 'failed' : 'passed',
    }, null, 2))
  }
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Verification cleanup failed')
}
const cancel = () => { try { cleanup() } finally { process.exit(130) } }
process.once('SIGINT', cancel)
process.once('SIGTERM', cancel)
const record = (scenario, actual) => { results.push({ scenario, actual, passed: true }); console.log('PASS ' + scenario) }
const health = async () => {
  const started = performance.now()
  const response = await fetch(url + '?token=verification-private', {
    headers: { 'X-Request-ID': 'client-controlled' }, signal: AbortSignal.timeout(5000),
  })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /^application\/json/)
  assert.deepEqual(await response.json(), { status: 'ok', dependencies: {} })
  const id = response.headers.get('x-request-id')
  assert.match(id ?? '', /^[a-f0-9]{32}$/)
  const duration = performance.now() - started
  assert.ok(duration <= 2000, 'Health request exceeded 2000ms')
  return { id, durationMs: Number(duration.toFixed(2)), slow: duration > 500 }
}
try {
  const empty = join(temp, 'empty.env')
  writeFileSync(empty, '')
  const missing = spawnSync('docker', ['compose', '-f', resolve('compose.yaml'), '--env-file', empty, 'config', '--quiet'],
    { cwd, env, encoding: 'utf8', timeout: 30000 })
  assert.notEqual(missing.status, 0)
  assert.match(missing.stderr, /HTTP_PORT/)
  record('SC-09 Compose missing required configuration', { exitCode: missing.status })
  const source = JSON.parse(run([...sourceCompose, 'config', '--format', 'json']))
  const isolated = isolateCompose(source, project)
  const composeFile = join(temp, 'compose.json')
  writeFileSync(composeFile, JSON.stringify(isolated))
  compose = ['compose', '-f', composeFile, '-p', project]
  image = isolated.services.backend.image
  images = Object.values(isolated.services).map(service => service.image)
  run([...compose, 'config', '--quiet'])
  run([...compose, 'up', '--build', '-d', '--wait', '--wait-timeout', '120'])
  const backendAddress = run([...compose, 'port', 'backend', String(port)]).trim()
  const frontendAddress = run([...compose, 'port', 'frontend', '80']).trim()
  assert.match(backendAddress, /^127\.0\.0\.1:\d+$/)
  assert.match(frontendAddress, /^127\.0\.0\.1:\d+$/)
  url = 'http://' + backendAddress + '/health'
  frontendUrl = 'http://' + frontendAddress + '/'
  const config = JSON.parse(run([...compose, 'config', '--format', 'json']))
  assert.deepEqual(Object.keys(config.services).sort(), ['backend', 'frontend'])
  const psText = run([...compose, 'ps', '--format', 'json']).trim()
  const entries = psText.startsWith('[') ? JSON.parse(psText) : psText.split('\n').map(line => JSON.parse(line))
  const ps = entries.find(service => service.Service === 'backend')
  assert.ok(ps, 'Backend missing from compose ps')
  assert.equal(ps.Health, 'healthy')
  record('SC-08 local Compose startup (not second-machine acceptance)', { backend: ps.Health, port, backendAddress, frontendAddress, project })
  const first = await health()
  const second = await health()
  assert.notEqual(first.id, second.id)
  record('SC-02/03 healthy JSON with no external dependencies', { first, second })
  const response = await fetch(frontendUrl, { signal: AbortSignal.timeout(5000) })
  assert.equal(response.status, 200)
  assert.match(await response.text(), /CampusClawPlus/)
  record('SC-01 static frontend HTTP', { status: response.status, browserCheck: 'recorded separately' })
  for (const [name, value] of [['missing', undefined], ['empty', ''], ['whitespace', '   '],
    ['letters', 'abc'], ['zero', '0'], ['negative', '-1'], ['aboveMaximum', '65536']]) {
    const args = ['run', '--rm', '--network', 'none']
    if (value !== undefined) args.push('-e', 'HTTP_PORT=' + value)
    args.push(image)
    const invalid = spawnSync('docker', args, { encoding: 'utf8', timeout: 15000 })
    assert.notEqual(invalid.status, 0)
    const lines = invalid.stdout.trim().split('\n').map(line => JSON.parse(line))
    assert.ok(lines.every(line => line.request_id === null && line.module === 'config'))
    assert.match(invalid.stdout, /HTTP_PORT/)
    record('SC-04/05 process configuration ' + name, { exitCode: invalid.status, jsonLines: lines.length })
  }
  const occupied = spawnSync('docker', [...compose, 'exec', '-T', 'backend', '/server'],
    { cwd, env, encoding: 'utf8', timeout: 15000 })
  assert.notEqual(occupied.status, 0)
  assert.match(occupied.stdout, /HTTP_PORT listen failed/)
  record('SC-07 occupied port is failure of new executable', { exitCode: occupied.status })
  validContainer = run(['run', '-d', '--network', 'none', '-e', 'HTTP_PORT= 18081 ', image]).trim()
  run(['exec', validContainer, '/server', '--healthcheck'])
  record('SC-06 valid trimmed configuration and recovery', { healthcheckExitCode: 0 })
  run(['stop', '--time', '15', validContainer])
  run(['rm', validContainer])
  validContainer = undefined
  const lines = run([...compose, 'logs', '--no-color', '--no-log-prefix', 'backend']).trim().split('\n').filter(Boolean)
  const logs = lines.map(line => JSON.parse(line))
  const requestLogs = logs.filter(line => line.message === 'request completed')
  for (const id of [first.id, second.id]) {
    const log = requestLogs.find(line => line.request_id === id)
    assert.ok(log)
    assert.equal(log.status, 200)
    assert.equal(log.path, '/health')
    for (const key of ['ts', 'level', 'module', 'message', 'method', 'duration_ms']) assert.ok(key in log)
  }
  assert.ok(logs.some(line => line.message === 'server started' && line.request_id === null))
  assert.ok(!lines.join('\n').includes('verification-private'))
  assert.ok(!lines.join('\n').includes('client-controlled'))
  record('SC-16/17 JSON logs and request identifier correlation', { lines: logs.length })
  run([...compose, 'down', '--timeout', '15'])
  await assert.rejects(fetch(url, { signal: AbortSignal.timeout(2000) }))
  await assert.rejects(fetch(frontendUrl, { signal: AbortSignal.timeout(2000) }))
  run([...compose, 'up', '-d', '--wait', '--wait-timeout', '120'])
  url = 'http://' + run([...compose, 'port', 'backend', String(port)]).trim() + '/health'
  await health()
  record('SC-10 stop and restart', { stopped: true, restarted: true })
} finally {
  process.off('SIGINT', cancel)
  process.off('SIGTERM', cancel)
  cleanup()
}
