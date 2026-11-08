import { browserProof } from './browser-real.mjs'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { parseEnv } from 'node:util'
import { validateWiringInputs } from 'file:///C:/Users/lenovo/Desktop/SoftwareDevelopment/group_project/output/review-18/scripts/identity-compose.mjs'
import { hostRequest, verifyHostIngress } from 'file:///C:/Users/lenovo/Desktop/SoftwareDevelopment/group_project/output/review-18/scripts/identity-host-ingress.mjs'
import { verificationSubnets } from 'file:///C:/Users/lenovo/Desktop/SoftwareDevelopment/group_project/output/review-18/scripts/verification-subnets.mjs'

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
const composeArgs = ['compose', '--project-name', id, '--env-file', resolve(directory, 'compose.env'), '--file', 'C:/Users/lenovo/Desktop/SoftwareDevelopment/group_project/output/review-18/compose.yaml', '--file', resolve(directory,'network-override.json')]
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
  const existingNetworks = spawnSync('docker',['network','ls','-q'],{encoding:'utf8',timeout:30000})
  if(existingNetworks.status!==0)throw new Error('Browser network inventory unavailable')
  const existingRanges=spawnSync('docker',['network','inspect','--format','{{range .IPAM.Config}}{{.Subnet}} {{end}}',...existingNetworks.stdout.trim().split(/\s+/)],{encoding:'utf8',timeout:30000})
  if(existingRanges.status!==0)throw new Error('Browser subnet inventory unavailable')
  const occupiedForProxy=[...existingRanges.stdout.matchAll(/(\d+\.\d+\.\d+\.\d+)\/(\d+)/g)].map(m=>m[0])
  const [browserProxySubnet]=verificationSubnets(occupiedForProxy,1)
  run('dedicated explicit free internal proxy network', ['network', 'create', '--internal', '--subnet', browserProxySubnet,id]); createdNetwork = true
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
  const occupied = [...inventory.stdout.matchAll(/(\d+\.\d+\.\d+\.\d+)\/(\d+)/g)].map(m => m[0])
  const [dataSubnet, ingressSubnet] = verificationSubnets(occupied)
  writeFileSync(resolve(directory,'network-override.json'),JSON.stringify({services:{frontend:{build:{context:resolve('frontend')}}},networks:{
    data:{ipam:{config:[{subnet:dataSubnet}]}},
    ingress:{ipam:{config:[{subnet:ingressSubnet}]}},
  }}))
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
  compose('build pinned MySQL, offline admin and production applications', ['--profile', 'tools', 'build', 'mysql', 'admin', 'backend', 'frontend'])
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
  const frontend = compose('resolve only this project HTTPS frontend', ['ps', '-q', 'frontend']).trim()
  assert.match(frontend, /^[a-f0-9]{64}$/)
  const ports = JSON.parse(run('inspect only published HTTPS binding', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', frontend]))
  assert.deepEqual(Object.keys(ports).filter(key => ports[key]?.length), ['443/tcp'])
  assert.equal(ports['443/tcp'].length, 1)
  assert.equal(ports['443/tcp'][0].HostIp, '127.0.0.1')
  const publishedPort = Number(ports['443/tcp'][0].HostPort)
  assert.ok(Number.isInteger(publishedPort) && publishedPort > 0 && publishedPort <= 65535)
  const hostResult = await verifyHostIngress(publishedPort, directory)
  evidence.push({ label: 'IDF-SC-18 actual host loopback HTTPS, CA/SAN and anonymous denial', exit_code: 0, ...hostResult })
  console.log('Actual host published HTTPS and CA/SAN rejection: PASS')
  const browserEnv = parseEnv(readFileSync(resolve(directory,'backend.env'),'utf8'))
  browserEnv.AUTH_TRUSTED_ORIGIN = 'https://campus.test:' + publishedPort
  writeFileSync(resolve(directory,'backend.env'), Object.entries(browserEnv).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n')
  compose('bind explicit published Origin for real browser verification', ['up','-d','--wait','--wait-timeout','90','--force-recreate','backend'])
  compose('reload existing proxy without reassigning ephemeral host port', ['exec','-T','frontend','nginx','-s','reload'])
  await verifyHostIngress(publishedPort,directory)
  const browserResult = await browserProof({directory, port:publishedPort})
  evidence.push({label:'FEF-SC-14 real default TLS browser and MySQL',exit_code:0,browser:browserResult})
  console.log('Real browser + ordinary trust + default ingress: PASS')
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
