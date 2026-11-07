import { spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { parseEnv } from 'node:util'
import { validateWiringInputs } from './identity-compose.mjs'

const { goImage } = JSON.parse(readFileSync('scripts/toolchain.json', 'utf8'))
const id = 'campus-wiring-' + randomBytes(6).toString('hex')
const directory = resolve('output/identity-wiring', id)
mkdirSync(directory, { recursive: true, mode: 0o700 })
const evidence = []
const errors = []
let secrets = [], failed = false, configured = false, createdNetwork = false, env = {}
const redact = text => secrets.reduce((out, s) => out.split(s).join('<redacted>'), text).replaceAll(directory, '<fixture-directory>')
function run(label, args, { input, expected = 0, timeout = 300000, environment } = {}) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout, input, env: environment ?? process.env, maxBuffer: 8*1024*1024 })
  evidence.push({ label, exit_code: result.status, expected, output: redact((result.stdout ?? '') + (result.stderr ?? '')) })
  if (expected === 'nonzero' ? result.status === 0 || result.status === null : result.status !== expected) throw new Error(`${label}: unexpected exit status; sanitized evidence saved`)
  console.log(`${label}: PASS (exit ${result.status})`)
  return result.stdout ?? ''
}
const goArgs = ['run', '--rm', '-e', 'GOTOOLCHAIN=local', '-v', 'campus-claw-plus-go-modules:/go/pkg/mod', '-v', 'campus-claw-plus-go-cache:/root/.cache/go-build', '--mount', `type=bind,source=${resolve('backend')},target=/src,readonly`, '-w', '/src']
const composeArgs = ['compose', '--project-name', id, '--env-file', resolve(directory, 'compose.env'), '--file', 'deploy/identity/compose.yaml']
const compose = (label, args, options = {}) => run(label, [...composeArgs, ...args], { ...options, environment: { ...process.env, ...env, ...options.overrides } })
const client = (phase, label) => {
  run(label, [...goArgs, '--network', id, '-e', `WIRING_EXPECT=${phase}`, '--mount', `type=bind,source=${directory},target=/fixtures`, goImage, 'go', 'test', '-count=1', '-tags=integration', '-timeout=60s', '-v', './internal/integration/wiring'])
  const proof = resolve(directory, 'credential-proof')
  if (existsSync(proof)) secrets.push(...JSON.parse(readFileSync(proof, 'utf8')))
}
try {
  run('generate disposable wiring credentials/certificates', [...goArgs, '--network', 'none', '--mount', `type=bind,source=${directory},target=/fixtures`, goImage, 'go', 'run', './internal/integration/fixture', '/fixtures'])
  const app = parseEnv(readFileSync(resolve(directory, 'test.env'), 'utf8'))
  secrets = [...Object.values(app).flatMap(s => [...s.matchAll(/idf_(?:app|migration):([^@]+)@/g)].map(m => m[1])), readFileSync(resolve(directory, 'root-password'), 'utf8')]
  const password = randomBytes(24).toString('hex')
  const secondPassword = randomBytes(24).toString('hex')
  secrets.push(password, secondPassword)
  const seed = { classes: [{ key: 'wiring-a', name: 'Wiring A' }, { key: 'wiring-b', name: 'Wiring B' }], users: [{ username: 'wiring-teacher', password, role: 'teacher', class_keys: ['wiring-a', 'wiring-b'] }] }
  writeFileSync(resolve(directory, 'seed.json'), JSON.stringify(seed), { mode: 0o600 })
  run('dedicated internal proxy network', ['network', 'create', '--internal', id]); createdNetwork = true
  const ipam = JSON.parse(run('discover allocated proxy address', ['network', 'inspect', '--format', '{{json .IPAM.Config}}', id]))[0]
  // Docker allows a static endpoint only on a user-configured subnet. Discover
  // a free range first, then explicitly create it; a race fails closed.
  run('release automatically allocated proxy network', ['network', 'rm', id]); createdNetwork = false
  run('create explicit isolated proxy subnet', ['network', 'create', '--internal', '--subnet', ipam.Subnet, '--gateway', ipam.Gateway, id]); createdNetwork = true
  // Reserve the last usable address. Docker allocates dynamic peers from the
  // start, including preview created before gateway by depends_on.
  const [base, prefix] = ipam.Subnet.split('/')
  const octets = base.split('.').map(Number)
  const start = (octets[0]*2**24 + octets[1]*2**16 + octets[2]*256 + octets[3]) >>> 0
  const address = ((start | (2 ** (32 - Number(prefix)) - 1)) - 1) >>> 0
  const ip = [address>>>24, address>>>16&255, address>>>8&255, address&255].join('.')
  env = { IDENTITY_STATE_DIR: directory, IDENTITY_PROXY_NETWORK: id, IDENTITY_PROXY_IP: ip, IDENTITY_HTTPS_HOST: 'campus.test', IDENTITY_HTTPS_PORT: '0', HTTPS_CERT_FILE: resolve(directory, 'https.pem'), HTTPS_KEY_FILE: resolve(directory, 'https.key') }
  validateWiringInputs(env, { ephemeral: true })
  const envText = object => Object.entries(object).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join('\n') + '\n'
  writeFileSync(resolve(directory, 'compose.env'), envText(env), { mode: 0o600 })
  writeFileSync(resolve(directory, 'admin.env'), envText(app), { mode: 0o600 })
  const backend = { MYSQL_DSN: app.MYSQL_DSN, MYSQL_CA_FILE: app.MYSQL_CA_FILE, AUTH_TRUSTED_ORIGIN: 'https://campus.test' }
  writeFileSync(resolve(directory, 'backend.env'), envText(backend), { mode: 0o600 })
  configured = true
  compose('validate explicit candidate compose', ['--profile', 'preview', '--profile', 'tools', 'config', '--quiet'])
  compose('missing HTTPS key is rejected before startup', ['--profile', 'preview', 'config', '--quiet'], { expected: 'nonzero', overrides: { HTTPS_KEY_FILE: '' } })
} catch (error) {
  failed = true; errors.push(redact(error.message)); console.error(redact(error.message))
}
// Continue below only after fixture/config preparation; all failures still clean up.
try {
  if (failed) throw new Error('Wiring preparation failed')
  compose('build pinned offline admin and preview', ['--profile', 'tools', '--profile', 'preview', 'build', 'admin', 'preview', 'gateway'])
  compose('start fresh persistent MySQL', ['up', '-d', '--wait', '--wait-timeout', '120', 'mysql'])
  compose('offline migrations', ['run', '--rm', '-T', 'admin', 'migrate'])
  compose('offline manifest/schema check', ['run', '--rm', '-T', 'admin', 'check'])
  const adminFile = resolve(directory, 'admin.env')
  const originalAdmin = readFileSync(adminFile, 'utf8')
  try {
    // A valid PEM from a different leaf is not the database's trusted CA.
    writeFileSync(adminFile, originalAdmin.replace('/fixtures/ca.pem', '/fixtures/not-the-ca.pem'))
    compose('database CA file missing is rejected', ['run', '--rm', '-T', 'admin', 'check'], { expected: 'nonzero' })
  } finally { writeFileSync(adminFile, originalAdmin) }
  const caFile = resolve(directory, 'ca.pem')
  const originalCA = readFileSync(caFile)
  try {
    // The fixture generator runs as container root. Replace the public CA file
    // through the caller-owned directory rather than requiring host write UID.
    rmSync(caFile)
    writeFileSync(caFile, readFileSync(resolve(directory, 'https.pem')))
    compose('valid but wrong database trust certificate is rejected', ['run', '--rm', '-T', 'admin', 'check'], { expected: 'nonzero' })
  } finally { writeFileSync(caFile, originalCA) }
  const seed = JSON.parse(readFileSync(resolve(directory, 'seed.json'), 'utf8'))
  compose('offline initialize via stdin', ['run', '--rm', '-T', 'admin', 'initialize'], { input: JSON.stringify(seed) })
  seed.users[0].password = secrets.at(-1)
  compose('repeat initialize does not replace existing password', ['run', '--rm', '-T', 'admin', 'initialize'], { input: JSON.stringify(seed) })
  compose('start isolated Go and HTTPS frontend', ['--profile', 'preview', 'up', '-d', '--wait', '--wait-timeout', '90', 'preview', 'gateway'])
  client('up', 'real same-origin HTTPS, TLS rejection, login and revoked access')
  const logs = compose('capture sanitized Go request logs', ['logs', '--no-color', '--no-log-prefix', 'preview'])
  const rid = readFileSync(resolve(directory, 'request-proof'), 'utf8')
  if (!logs.split(/\r?\n/).filter(Boolean).map(s => JSON.parse(s)).some(row => row.request_id === rid && row.path === '/api/v1/auth/login')) throw new Error('server request id is not correlated across HTTPS and JSON log')
  if (secrets.some(secret => logs.includes(secret))) throw new Error('secret appeared in application log')
  compose('stop database only', ['stop', '--timeout', '15', 'mysql'])
  client('down', 'real database-down health 503 and login 503 without credentials')
  compose('restore database', ['up', '-d', '--wait', '--wait-timeout', '90', 'mysql'])
  client('persist', 'account and class persist after database restart')
  compose('remove candidate containers while retaining named data volume', ['--profile', 'preview', 'down', '--timeout', '15'])
  compose('recreate MySQL on retained volume', ['up', '-d', '--wait', '--wait-timeout', '90', 'mysql'])
  compose('recreated database migration state unchanged', ['run', '--rm', '-T', 'admin', 'check'])
  compose('recreate isolated HTTPS path', ['--profile', 'preview', 'up', '-d', '--wait', '--wait-timeout', '90', 'preview', 'gateway'])
  client('persist', 'same account and original password after full container recreation')
  const allLogs = compose('check combined logs contain no generated passwords', ['--profile', 'preview', 'logs', '--no-color', '--no-log-prefix'])
  if (secrets.some(secret => allLogs.includes(secret))) throw new Error('secret appeared in service log')
} catch (error) { failed = true; errors.push(redact(error.message)); console.error(redact(error.message)) }
finally {
  if (configured) {
    if (failed) {
      try {
        const privateFile = resolve(directory, 'credential-proof')
        if (existsSync(privateFile)) secrets.push(...JSON.parse(readFileSync(privateFile, 'utf8')))
        compose('failure diagnostics before cleanup', ['--profile', 'preview', 'logs', '--tail', '30', '--no-color', '--no-log-prefix'])
      } catch { /* Original failure and cleanup status still determine exit. */ }
    }
    try { compose('remove only this disposable project and test data volume', ['--profile', 'preview', '--profile', 'tools', 'down', '--volumes', '--timeout', '15']) } catch { failed = true }
  }
  if (createdNetwork) { try { run('remove dedicated proxy network', ['network', 'rm', id]) } catch { failed = true } }
  const output = { time: new Date().toISOString(), scope: 'isolated unactivated identity wiring; not production/browser acceptance', results: evidence, errors, exit_code: failed ? 1 : 0 }
  // Fixtures and all private keys are removed even on failure. Keep sanitized proof only.
  if (existsSync(directory)) rmSync(directory, { recursive: true, force: true })
  writeFileSync('output/identity-wiring/results.json', JSON.stringify(output, null, 2) + '\n')
}
process.exitCode = failed ? 1 : 0
