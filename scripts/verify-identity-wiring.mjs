import assert from 'node:assert/strict'
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
let validContainer
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
const composeArgs = ['compose', '--project-name', id, '--env-file', resolve(directory, 'compose.env'), '--file', 'compose.yaml', '--file', resolve(directory,'network-override.json')]
const compose = (label, args, options = {}) => run(label, [...composeArgs, ...args], { ...options, environment: { ...process.env, ...env, ...options.overrides } })
const client = (phase, label) => {
  run(label, [...goArgs, '--network', phase==='lookup'?id+'_data':id, '-e', `WIRING_EXPECT=${phase}`, '--mount', `type=bind,source=${directory},target=/fixtures`, goImage, 'go', 'test', '-count=1', '-tags=integration', '-timeout=60s', '-v', './internal/integration/wiring'])
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
  const seed = { classes: [{ key: 'wiring-a', name: 'Wiring A' }, { key: 'wiring-b', name: 'Wiring B' }], users: [{ username: 'wiring-teacher', password, role: 'teacher', class_keys: ['wiring-a', 'wiring-b'] }, ...[['wiring-student-a','student',['wiring-a']],['wiring-student-a2','student',['wiring-a']],['wiring-student-b','student',['wiring-b']],['wiring-teacher-b','teacher',['wiring-b']]].map(([username,role,class_keys])=>{const password=randomBytes(24).toString('hex');secrets.push(password);return {username,password,role,class_keys}})] }
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
  env = { HTTP_PORT: '18080', IDENTITY_STATE_DIR: directory, IDENTITY_PROXY_NETWORK: id, IDENTITY_PROXY_IP: ip, IDENTITY_HTTPS_HOST: 'campus.test', IDENTITY_HTTPS_PORT: '0', HTTPS_CERT_FILE: resolve(directory, 'https.pem'), HTTPS_KEY_FILE: resolve(directory, 'https.key') }
  // A host may have exhausted Docker's automatic pools. Override only this
  // disposable project's internal data subnet; preserve services and policy.
  const ids=spawnSync('docker',['network','ls','-q'],{encoding:'utf8',timeout:30000})
  if(ids.status!==0)throw new Error('Network inventory unavailable')
  const inventory=spawnSync('docker',['network','inspect','--format','{{range .IPAM.Config}}{{.Subnet}} {{end}}',...ids.stdout.trim().split(/\s+/)],{encoding:'utf8',timeout:30000})
  if(inventory.status!==0)throw new Error('Network prefix inventory unavailable')
  const integer=ip=>ip.split('.').map(Number).reduce((n,o)=>n*256+o,0)
  const occupied=[...inventory.stdout.matchAll(/(\d+\.\d+\.\d+\.\d+)\/(\d+)/g)].map(m=>[integer(m[1]),integer(m[1])+2**(32-Number(m[2]))-1])
  let dataSubnet
  for(let n=0;n<256;n++){const base=integer(`10.240.${n}.0`);if(occupied.every(([lo,hi])=>base+255<lo||base>hi)){dataSubnet=`10.240.${n}.0/24`;break}}
  if(!dataSubnet)throw new Error('No isolated test subnet available')
  writeFileSync(resolve(directory,'network-override.json'),JSON.stringify({networks:{data:{ipam:{config:[{subnet:dataSubnet}]}}}}))
  validateWiringInputs(env, { ephemeral: true })
  const envText = object => Object.entries(object).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join('\n') + '\n'
  writeFileSync(resolve(directory, 'compose.env'), envText(env), { mode: 0o600 })
  writeFileSync(resolve(directory, 'admin.env'), envText(app), { mode: 0o600 })
  const backend = { MYSQL_DSN: app.MYSQL_DSN, MYSQL_CA_FILE: app.MYSQL_CA_FILE, AUTH_TRUSTED_ORIGIN: 'https://campus.test' }
  writeFileSync(resolve(directory, 'backend.env'), envText(backend), { mode: 0o600 })
  configured = true
  compose('validate explicit candidate compose', ['--profile', 'tools', 'config', '--quiet'])
  compose('SC-09 missing HTTP_PORT is rejected before startup', ['config', '--quiet'], { expected: 'nonzero', overrides: { HTTP_PORT: '' } })
  compose('missing HTTPS key is rejected before startup', [ 'config', '--quiet'], { expected: 'nonzero', overrides: { HTTPS_KEY_FILE: '' } })
} catch (error) {
  failed = true; errors.push(redact(error.message)); console.error(redact(error.message))
}
// Continue below only after fixture/config preparation; all failures still clean up.
try {
  if (failed) throw new Error('Wiring preparation failed')
  compose('build pinned offline admin and preview', ['--profile', 'tools', 'build', 'admin', 'backend', 'frontend'])
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
  client('lookup', 'trusted fixture class lookup on database-only network')
  compose('start isolated Go and HTTPS frontend', [ 'up', '-d', '--wait', '--wait-timeout', '90', 'backend', 'frontend'])
  // Preserve all original process/configuration/HTTP/log/shutdown regression
  // categories on the new default artifact; no skeleton server or alternate health.
  const image = compose('resolve production backend image', ['images', '-q', 'backend']).trim()
  assert.match(image, /^(sha256:)?[a-f0-9]{12,64}$/)
  for (const [name, value] of [['missing', undefined], ['empty', ''], ['whitespace', '   '], ['letters', 'abc'], ['zero', '0'], ['negative', '-1'], ['aboveMaximum', '65536']]) {
    const args = ['run', '--rm', '--network', 'none']
    if(value !== undefined) args.push('-e', 'HTTP_PORT='+value)
    args.push(image)
    const output = run('SC-04/05 production process '+name, args, {expected:'nonzero',timeout:15000})
    const lines = output.trim().split(/\r?\n/).map(x=>JSON.parse(x))
    assert.ok(lines.length && lines.every(x=>x.module==='config' && x.request_id===null))
    assert.match(output,/HTTP_PORT/)
  }
  const occupied = compose('SC-07 occupied port rejects second real server', ['exec','-T','backend','/server'], {expected:'nonzero'})
  assert.match(occupied,/HTTP_PORT listen failed/)
  validContainer = compose('SC-06 start real server with trimmed valid port', ['run','-d','--no-deps','-e','HTTP_PORT= 18081 ','backend']).trim()
  assert.match(validContainer,/^[a-f0-9]{64}$/)
  let ready=false
  for(let attempt=0;attempt<20;attempt++){
    const state=run('SC-06 inspect own trimmed-port instance', ['inspect','--format','{{.State.Health.Status}}',validContainer],{timeout:10000}).trim()
    if(state==='healthy'){ready=true;break}
    await new Promise(resolve=>setTimeout(resolve,500))
  }
  assert.ok(ready,'Trimmed-port server never became healthy')
  run('SC-06 active strict probe succeeds', ['exec',validContainer,'/server','--healthcheck'])
  run('remove only trimmed-port test instance', ['rm','-f',validContainer]); validContainer=undefined
  client('up', 'SC-01/02/03 real same-origin HTTPS, unique health, TLS rejection, login and revoked access')
  const logs = compose('capture sanitized Go request logs', ['logs', '--no-color', '--no-log-prefix', 'backend'])
  const rid = readFileSync(resolve(directory, 'request-proof'), 'utf8')
  const parsedLogs=logs.split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s))
  const requestLog=parsedLogs.find(row=>row.request_id===rid && row.path==='/api/v1/auth/login')
  assert.ok(requestLog,'SC-16/17 request id correlation')
  for(const key of ['ts','level','module','message','method','status','duration_ms']) assert.ok(key in requestLog)
  assert.ok(parsedLogs.some(row=>row.message==='server started' && row.request_id===null))
  assert.ok(!logs.includes('untrusted-client-value') && !logs.includes('verification-private'))
  if (secrets.some(secret => logs.includes(secret))) throw new Error('secret appeared in application log')
  compose('stop database only', ['stop', '--timeout', '15', 'mysql'])
  client('down', 'real database-down health 503 and login 503 without credentials')
  compose('restore database', ['up', '-d', '--wait', '--wait-timeout', '90', 'mysql'])
  client('persist', 'account and class persist after database restart')
  compose('remove candidate containers while retaining named data volume', [ 'down', '--timeout', '15'])
  client('stopped', 'SC-10 stopped production HTTP and HTTPS are unreachable')
  compose('recreate MySQL on retained volume', ['up', '-d', '--wait', '--wait-timeout', '90', 'mysql'])
  compose('recreated database migration state unchanged', ['run', '--rm', '-T', 'admin', 'check'])
  compose('recreate isolated HTTPS path', [ 'up', '-d', '--wait', '--wait-timeout', '90', 'backend', 'frontend'])
  client('persist', 'same account and original password after full container recreation')
  const allLogs = compose('check combined logs contain no generated passwords', [ 'logs', '--no-color', '--no-log-prefix'])
  if (secrets.some(secret => allLogs.includes(secret))) throw new Error('secret appeared in service log')
} catch (error) { failed = true; errors.push(redact(error.message)); console.error(redact(error.message)) }
finally {
  if(validContainer) { try { run('cleanup own trimmed-port instance',['rm','-f',validContainer]) } catch {failed=true} }
  if (configured) {
    if (failed) {
      try {
        const privateFile = resolve(directory, 'credential-proof')
        if (existsSync(privateFile)) secrets.push(...JSON.parse(readFileSync(privateFile, 'utf8')))
        compose('failure diagnostics before cleanup', [ 'logs', '--tail', '30', '--no-color', '--no-log-prefix'])
      } catch { /* Original failure and cleanup status still determine exit. */ }
    }
    try { compose('remove only this disposable project and test data volume', ['--profile', 'tools', 'down', '--volumes', '--timeout', '15']) } catch { failed = true }
  }
  if (createdNetwork) { try { run('remove dedicated proxy network', ['network', 'rm', id]) } catch { failed = true } }
  const output = { time: new Date().toISOString(), scope: 'default production Compose and real cmd/server with disposable test credentials/CA; no native browser or operator deployment claim', results: evidence, errors, exit_code: failed ? 1 : 0 }
  // Fixtures and all private keys are removed even on failure. Keep sanitized proof only.
  if (existsSync(directory)) rmSync(directory, { recursive: true, force: true })
  writeFileSync('output/identity-wiring/results.json', JSON.stringify(output, null, 2) + '\n')
}
process.exitCode = failed ? 1 : 0
