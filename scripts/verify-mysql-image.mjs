import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomBytes, createHash } from 'node:crypto'
import { auditCache, databaseArgs, scanner } from './verify-image-audits.mjs'

// IDF-SC-14/17/18: audit the same runtime used by Compose and real DB tests.
const id = 'campus-mysql-audit-' + randomBytes(6).toString('hex')
const image = id + ':verification'
const directory = resolve('output/mysql-image-verify', id)
const parent = resolve('output/mysql-image-verify')
assert.equal(dirname(directory), parent)
const { volume: cacheVolume, owned: ownsCache } = auditCache(id)
mkdirSync(directory, { recursive: true })
for (const name of ['results', 'mysql']) rmSync(resolve(parent, name + '.json'), { force: true })
const results = []
let failed = false, summary
function run(label, args, timeout = 180000) {
  const child = spawnSync('docker', args, { encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 })
  const output = ((child.stdout ?? '') + (child.stderr ?? '')).replaceAll(directory, '<audit-directory>')
  results.push({ label, exit_code: child.status, output })
  console.log(`${label}: exit ${child.status}`)
  if (child.status !== 0) throw new Error(`${label} failed; inspect output/mysql-image-verify/results.json`)
  return child.stdout ?? ''
}
try {
  run('build fixed MySQL 8.4.13 runtime', ['build', '--tag', image, 'deploy/identity/mysql'])
  const imageId = run('record immutable built artifact', ['image', 'inspect', '--format', '{{.Id}}', image]).trim()
  assert.match(imageId, /^sha256:[a-f0-9]{64}$/)
  run('MySQL version, mysqlsh removal, real gosu UID/GID drop', ['run', '--rm', '--network', 'none', '--entrypoint', '/bin/sh', image, '-ec',
    'mysqld --version | grep 8.4.13; mysql --version; ! command -v mysqlsh; test ! -d /usr/lib/mysqlsh; test "$(gosu mysql id -u)" = 999; test "$(gosu mysql id -g)" = 999'])
  run('export artifact for scanner without Docker socket', ['image', 'save', '--output', resolve(directory, 'image.tar'), image])
  run('Trivy HIGH/CRITICAL audit of fixed artifact', ['run', '--rm', '--name', id + '-scanner',
    '--mount', `type=bind,source=${directory},target=/reports`,
    '-v', `${cacheVolume}:/root/.cache/trivy`, scanner,
    'image', '--input', '/reports/image.tar', ...databaseArgs, '--cache-backend', 'memory', '--scanners', 'vuln', '--severity', 'HIGH,CRITICAL',
    '--exit-code', '1', '--list-all-pkgs', '--no-progress', '--timeout', '3m', '--format', 'json', '--output', '/reports/mysql.json'], 210000)
  const raw = readFileSync(resolve(directory, 'mysql.json'))
  const report = JSON.parse(raw)
  const findings = report.Results.flatMap(result => result.Vulnerabilities ?? [])
  assert.equal(findings.length, 0, 'No HIGH/CRITICAL vulnerability may be ignored')
  assert.equal(report.Metadata.ImageConfig.config.Env.find(x => x.startsWith('MYSQL_VERSION=')), 'MYSQL_VERSION=8.4.13-1.el9')
  const gosu = report.Results.find(result => result.Target === 'usr/local/bin/gosu')
  assert.ok(gosu, 'Scanner must analyze the replacement binary')
  assert.ok(gosu.Packages.some(pkg => pkg.Name === 'stdlib' && pkg.Version === 'v1.27.3'), 'Scanner must identify current gosu Go toolchain')
  writeFileSync(resolve(parent, 'mysql.json'), raw)
  const database = JSON.parse(run('record actual vulnerability database metadata', ['run', '--rm', '--network', 'none',
    '-v', `${cacheVolume}:/root/.cache/trivy`, '--entrypoint', 'cat', scanner, '/root/.cache/trivy/db/metadata.json']))
  summary = { image_id: imageId, scanner, raw_sha256: createHash('sha256').update(raw).digest('hex'),
    HIGH: 0, CRITICAL: 0, gosu_go: '1.27.3', vulnerability_database: database }
  console.log('MySQL image audit: HIGH=0 CRITICAL=0; gosu Go1.27.3; no ignore flags')
} catch (error) {
  failed = true
  console.error(error.message)
  // Preserve a failing scan too, without including any runtime credentials.
  try { writeFileSync(resolve(parent, 'mysql.json'), readFileSync(resolve(directory, 'mysql.json'))) } catch {}
} finally {
  const scannerCleanup = spawnSync('docker', ['rm', '-f', id + '-scanner'], { encoding: 'utf8', timeout: 30000 })
  results.push({ label: 'remove own scanner if its client timed out', exit_code: scannerCleanup.status })
  if (scannerCleanup.status !== 0 && !(scannerCleanup.stderr ?? '').includes('No such container')) failed = true
  const cleanup = spawnSync('docker', ['image', 'rm', image], { encoding: 'utf8', timeout: 30000 })
  results.push({ label: 'remove only own image tag', exit_code: cleanup.status })
  if (cleanup.status !== 0 && !(cleanup.stderr ?? '').includes('No such image')) failed = true
  if (ownsCache) {
    const cacheCleanup = spawnSync('docker', ['volume', 'rm', cacheVolume], { encoding: 'utf8', timeout: 30000 })
    results.push({ label: 'remove only own scanner cache volume', exit_code: cacheCleanup.status })
    if (cacheCleanup.status !== 0 && !(cacheCleanup.stderr ?? '').includes('no such volume')) failed = true
  }
  rmSync(directory, { recursive: true, force: true })
  writeFileSync(resolve(parent, 'results.json'), JSON.stringify({ time: new Date().toISOString(),
    source_dockerfile_sha256: createHash('sha256').update(readFileSync('deploy/identity/mysql/Dockerfile')).digest('hex'),
    results, summary, exit_code: failed ? 1 : 0 }, null, 2) + '\n')
}
process.exitCode = failed ? 1 : 0
