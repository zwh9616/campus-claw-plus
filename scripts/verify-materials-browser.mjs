import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { browserProof } from '../frontend/tests/materials-real-browser.mjs'
import { randomBytes } from 'node:crypto'
import { parseEnv } from 'node:util'
import { validateWiringInputs } from './identity-compose.mjs'
import { hostRequest, verifyHostIngress } from './identity-host-ingress.mjs'
import { verificationSubnets } from './verification-subnets.mjs'

const { goImage } = JSON.parse(readFileSync('scripts/toolchain.json', 'utf8'))
const id = 'campus-material-browser-' + randomBytes(6).toString('hex')
const directory = resolve('output/material-real', id)
assert.ok(directory.startsWith(resolve('output/material-real') + sep))
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
  const occupied = [...inventory.stdout.matchAll(/(\d+\.\d+\.\d+\.\d+)\/(\d+)/g)].map(m => m[0])
  const [dataSubnet, ingressSubnet] = verificationSubnets(occupied)
  writeFileSync(resolve(directory,'network-override.json'),JSON.stringify({networks:{
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

// MF-SC-12: a separate real browser run, after the unchanged npm gate.
try {
  if (failed) throw new Error('Browser fixture preparation failed')
  compose('build actual default production artifacts', ['--profile','tools','build','mysql','admin','backend','frontend'])
  compose('start isolated persistent MySQL', ['up','-d','--wait','--wait-timeout','120','mysql'])
  compose('migrate real isolated schema', ['run','--rm','-T','admin','migrate'])
  compose('check real schema and SQL manifest', ['run','--rm','-T','admin','check'])
  const seed = JSON.parse(readFileSync(resolve(directory,'seed.json'),'utf8'))
  compose('initialize real two-class five-user accounts', ['run','--rm','-T','admin','initialize'], {input:JSON.stringify(seed)})
  client('lookup','lookup real second class ID')
  compose('start default HTTPS frontend and API', ['up','-d','--wait','--wait-timeout','90','backend','frontend'])
  const frontend=compose('resolve own frontend', ['ps','-q','frontend']).trim()
  const ports=JSON.parse(run('inspect actual published HTTPS port',['inspect','--format','{{json .NetworkSettings.Ports}}',frontend]))
  assert.equal(ports['443/tcp'][0].HostIp,'127.0.0.1')
  const port=Number(ports['443/tcp'][0].HostPort)
  await verifyHostIngress(port,directory)
  const browserEnv=parseEnv(readFileSync(resolve(directory,'backend.env'),'utf8'))
  browserEnv.AUTH_TRUSTED_ORIGIN='https://campus.test:'+port
  writeFileSync(resolve(directory,'backend.env'),Object.entries(browserEnv).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n')
  compose('align trusted origin to allocated host port',['up','-d','--wait','--wait-timeout','90','--no-deps','--force-recreate','backend'])
  await verifyHostIngress(port,directory)
  const option=process.argv.indexOf('--playwright')
  if(option<0 || !process.argv[option+1])throw new Error('Provide --playwright ABSOLUTE_EXTERNAL_PLAYWRIGHT_PATH')
  const database=/\/([A-Za-z0-9_]+)(?:\?|$)/.exec(browserEnv.MYSQL_DSN)?.[1]
  assert.ok(database)
  const result=await browserProof({directory,port,playwrightPath:process.argv[option+1],markFailed:materialId=>{
    assert.match(materialId,/^[1-9][0-9]{0,18}$/)
    // The password is read inside this disposable container, never interpolated
    // into argv/logs. Only the current browser's numeric test object is changed.
    const command=`MYSQL_PWD="$(cat /input/root-password)" mysql --protocol=socket -uroot --database=${database} --batch --skip-column-names --execute="UPDATE materials SET index_status='failed' WHERE id=${materialId}; SELECT ROW_COUNT();"`
    const changed=compose('controlled failed state for own isolated material',['exec','-T','mysql','sh','-c',command])
    assert.equal(changed.trim(),'1')
  }})
  evidence.push({label:'real native browser with trusted TLS and MySQL',exit_code:0,...result})
  console.log('Real materials browser: PASS ('+result.cases+' cases)')
} catch(error) {failed=true;errors.push(redact(error.message));console.error(redact(error.message))}
finally {
  if(configured) {try {compose('remove only own browser project and volume',['--profile','tools','down','--volumes','--timeout','15'])}catch{failed=true}}
  if(createdNetwork) {try {run('remove own proxy network',['network','rm',id])}catch{failed=true}}
  assert.ok(directory.startsWith(resolve('output/material-real')+sep))
  if(existsSync(directory))rmSync(directory,{recursive:true,force:true})
  writeFileSync('output/material-real/runtime.json',JSON.stringify({time:new Date().toISOString(),scope:'default production Compose with disposable MySQL, trusted browser HTTPS and own test accounts',results:evidence,errors,exit_code:failed?1:0},null,2)+'\n')
}
process.exitCode=failed?1:0
