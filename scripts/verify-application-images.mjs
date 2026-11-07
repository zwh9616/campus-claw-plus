import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { randomBytes, createHash } from 'node:crypto'
import { validateApplicationScan } from './application-image-report.mjs'

// IDF-SC-14/17/18: scan exact production Dockerfiles before runtime acceptance.
const scanner = 'aquasec/trivy@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb'
const id = 'campus-app-audit-' + randomBytes(6).toString('hex')
const parent = resolve('output/application-image-verify')
const directory = resolve(parent, id)
if (dirname(directory) !== parent) throw new Error('Invalid audit directory')
mkdirSync(directory, { recursive: true })
for (const name of ['results', 'backend', 'admin', 'frontend']) rmSync(resolve(parent, name + '.json'), { force: true })
const cacheVolume = id + '-cache'
const results = [], images = [], summaries = []
let failed = false
function run(label, args, timeout = 180000) {
  const child = spawnSync('docker', args, { encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 })
  results.push({ label, exit_code: child.status, output: ((child.stdout ?? '') + (child.stderr ?? '')).replaceAll(directory, '<audit-directory>') })
  console.log(`${label}: exit ${child.status}`)
  if (child.status !== 0) throw new Error(`${label} failed; inspect output/application-image-verify/results.json`)
  return child.stdout ?? ''
}
const inputs = [
  { service: 'backend', context: 'backend', dockerfile: 'backend/Dockerfile', args: [] },
  { service: 'admin', context: 'backend', dockerfile: 'backend/Dockerfile.identity', args: ['--target', 'admin'] },
  { service: 'frontend', context: 'frontend', dockerfile: 'frontend/Dockerfile', args: [] },
]
try {
  for (const { service, context, dockerfile, args } of inputs) {
    const image = id + '-' + service + ':verification'
    images.push(image)
    run(`build production ${service}`, ['build', '--tag', image, '--file', dockerfile, ...args, context])
    const imageId = run(`record immutable ${service} artifact`, ['image', 'inspect', '--format', '{{.Id}}', image]).trim()
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error('Image digest unavailable')
    run(`export ${service} without scanner Docker socket`, ['image', 'save', '--output', resolve(directory, 'image.tar'), image])
    const filename = service + '.json'
    try {
      run(`Trivy HIGH/CRITICAL ${service}`, ['run', '--rm', '--name', id + '-scanner',
        '--mount', `type=bind,source=${directory},target=/reports`, '-v', `${cacheVolume}:/root/.cache/trivy`, scanner,
        'image', '--input', '/reports/image.tar', '--scanners', 'vuln', '--severity', 'HIGH,CRITICAL', '--exit-code', '1',
        '--list-all-pkgs', '--no-progress', '--timeout', '3m', '--format', 'json', '--output', '/reports/' + filename], 210000)
    } finally {
      try { writeFileSync(resolve(parent, filename), readFileSync(resolve(directory, filename))) } catch {}
    }
    const raw = readFileSync(resolve(directory, filename))
    const counts = validateApplicationScan(JSON.parse(raw), service)
    summaries.push({ service, image_id: imageId, dockerfile_sha256: createHash('sha256').update(readFileSync(dockerfile)).digest('hex'),
      raw_sha256: createHash('sha256').update(raw).digest('hex'), ...counts })
  }
  const database = JSON.parse(run('record actual vulnerability database', ['run', '--rm', '--network', 'none',
    '-v', `${cacheVolume}:/root/.cache/trivy`, '--entrypoint', 'cat', scanner, '/root/.cache/trivy/db/metadata.json']))
  summaries.push({ vulnerability_database: database })
} catch (error) {
  failed = true
  console.error(error.message)
} finally {
  for (const [label, args, absent] of [
    ['remove own scanner if timed out', ['rm', '-f', id + '-scanner'], 'No such container'],
    ...images.map(image => ['remove own image tag', ['image', 'rm', image], 'No such image']),
    ['remove own scanner cache', ['volume', 'rm', cacheVolume], 'no such volume'],
  ]) {
    const child = spawnSync('docker', args, { encoding: 'utf8', timeout: 30000 })
    results.push({ label, exit_code: child.status })
    if (child.status !== 0 && !(child.stderr ?? '').includes(absent)) failed = true
  }
  rmSync(directory, { recursive: true, force: true })
  writeFileSync(resolve(parent, 'results.json'), JSON.stringify({ time: new Date().toISOString(), scanner, results, summaries, exit_code: failed ? 1 : 0 }, null, 2) + '\n')
}
process.exitCode = failed ? 1 : 0
