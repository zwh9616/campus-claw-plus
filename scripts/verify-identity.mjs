import { spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync, rmSync, writeFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { createHash } from 'node:crypto'

const { goImage } = JSON.parse(readFileSync('scripts/toolchain.json', 'utf8'))
const id = 'campus-idf-' + randomBytes(6).toString('hex')
const mysqlImage = id + '-mysql:verification'
const directory = resolve('output/identity', id)
mkdirSync(directory, { recursive: true })
const results = []
// Last accepted artifact before MR-SC-08; keep the exact source for the real
// higher-version rejection drill, rather than recompiling a simulated checker.
const pre05Commit = 'e617cc00f067cfee84aca0fd69687c385c9b2982'
const pre04Commit = '5a6451ca5a5b313fedf9742f1e20bd3ffb0e10e8'
const pre06Commit = 'c1ac4213580df1fcc03520b8dddcfbece2a3344d'
let secrets = []
const redact = text => secrets.reduce((out, secret) => out.split(secret).join('<redacted>'), text).replaceAll(directory, '<fixture-directory>')
function run(label, args, timeout = 300000) {
  const r = spawnSync('docker', args, { encoding: 'utf8', timeout })
  const output = redact((r.stdout ?? '') + (r.stderr ?? ''))
  results.push({ label, exit_code: r.status, output })
  console.log(`${label}: ${r.status === 0 ? 'PASS' : 'FAIL'}`)
  if (r.status !== 0) throw new Error(`${label} failed; sanitized evidence saved`)
  return r.stdout
}
const goArgs = ['run', '--rm', '-e', 'GOTOOLCHAIN=local', '-v', 'campus-claw-plus-go-modules:/go/pkg/mod', '-v', 'campus-claw-plus-go-cache:/root/.cache/go-build', '--mount', `type=bind,source=${resolve('backend')},target=/src,readonly`, '-w', '/src']
let failed = false
try {
  run('build reviewed MySQL runtime without mysqlsh and with current Go gosu', ['build', '--tag', mysqlImage, 'deploy/identity/mysql'])
  run('test fixtures', [...goArgs, '--network', 'none', '--mount', `type=bind,source=${directory},target=/fixtures`, goImage, 'sh', '-c', 'go run ./internal/integration/fixture /fixtures && go build -trimpath -buildvcs=false -o /fixtures/identity-admin ./cmd/identity-admin && go build -trimpath -buildvcs=false -o /fixtures/server ./cmd/server'])
  const archive = spawnSync('git', ['archive', '--format=tar', pre04Commit, 'backend'], { maxBuffer: 32 * 1024 * 1024, timeout: 30000 })
  if (archive.status !== 0) throw new Error('accepted pre-04 source archive unavailable')
  writeFileSync(resolve(directory, 'pre04.tar'), archive.stdout)
  run('build actual accepted pre-04 artifacts', [...goArgs, '--network', 'none', '--mount', `type=bind,source=${directory},target=/fixtures`, goImage, 'sh', '-c', 'mkdir /tmp/pre04 && tar -xf /fixtures/pre04.tar -C /tmp/pre04 && cd /tmp/pre04/backend && go build -trimpath -buildvcs=false -o /fixtures/pre04-server ./cmd/server && go build -trimpath -buildvcs=false -o /fixtures/pre04-admin ./cmd/identity-admin'])
  const archive05 = spawnSync('git', ['archive', '--format=tar', pre05Commit, 'backend'], { maxBuffer: 32 * 1024 * 1024, timeout: 30000 })
  if (archive05.status !== 0) throw new Error('accepted pre-05 source archive unavailable')
  writeFileSync(resolve(directory, 'pre05.tar'), archive05.stdout)
  run('AT-SC-20 build actual accepted schema4 artifacts', [...goArgs, '--network', 'none', '--mount', `type=bind,source=${directory},target=/fixtures`, goImage, 'sh', '-c', 'mkdir /tmp/pre05 && tar -xf /fixtures/pre05.tar -C /tmp/pre05 && cd /tmp/pre05/backend && go build -trimpath -buildvcs=false -o /fixtures/pre05-server ./cmd/server && go build -trimpath -buildvcs=false -o /fixtures/pre05-admin ./cmd/identity-admin'])
  const archive06 = spawnSync('git', ['archive', '--format=tar', pre06Commit, 'backend'], { maxBuffer: 32 * 1024 * 1024, timeout: 30000 })
  if (archive06.status !== 0) throw new Error('accepted schema5 source archive unavailable')
  writeFileSync(resolve(directory, 'pre06.tar'), archive06.stdout)
  run('DI-SC-15 build actual accepted schema5 artifacts', [...goArgs, '--network', 'none', '--mount', `type=bind,source=${directory},target=/fixtures`, goImage, 'sh', '-c', 'mkdir /tmp/pre06 && tar -xf /fixtures/pre06.tar -C /tmp/pre06 && cd /tmp/pre06/backend && go build -trimpath -buildvcs=false -o /fixtures/pre06-server ./cmd/server && go build -trimpath -buildvcs=false -o /fixtures/pre06-admin ./cmd/identity-admin'])
  run('DI-SC-15 record actual accepted5 and candidate6 artifact IDs', [...goArgs, '--network', 'none', '--mount', `type=bind,source=${directory},target=/fixtures,readonly`, goImage, 'sh', '-c', 'sha256sum /fixtures/pre06-server /fixtures/pre06-admin /fixtures/server /fixtures/identity-admin'])
  const env = readFileSync(resolve(directory, 'test.env'), 'utf8')
  secrets = [...env.matchAll(/idf_(?:app|migration):([^@]+)@/g)].map(m => m[1])
  secrets.push(readFileSync(resolve(directory, 'root-password'), 'utf8'))
  const parserSecret=env.match(/^DOCUMENT_PARSER_TOKEN=(.+)$/m)?.[1]
  if(!parserSecret)throw new Error('Parser fixture credential missing')
  secrets.push(parserSecret)
  run('isolated network', ['network', 'create', '--internal', id])
  run('isolated MySQL', ['run', '-d', '--name', id, '--network', id, '--network-alias', 'mysql', '--mount', `type=bind,source=${directory},target=/fixtures,readonly`, '--mount', `type=bind,source=${resolve(directory, 'initialize.sql')},target=/docker-entrypoint-initdb.d/initialize.sql,readonly`, '-e', 'MYSQL_ROOT_PASSWORD_FILE=/fixtures/root-password', mysqlImage, '--require-secure-transport=ON', '--ssl-ca=/fixtures/ca.pem', '--ssl-cert=/fixtures/server.pem', '--ssl-key=/fixtures/server.key'])
  run('real MySQL identity scenarios', [...goArgs, '--network', id, '--env-file', resolve(directory, 'test.env'), '--mount', `type=bind,source=${directory},target=/fixtures,readonly`, goImage, 'go', 'test', '-count=1', '-tags=integration', '-timeout=240s', '-v', './internal/integration'])
  const backupGo = stage => [...goArgs, '--network', id, '--env-file', resolve(directory, 'test.env'), '-e', `MR_BACKUP_STAGE=${stage}`, '--mount', `type=bind,source=${directory},target=/fixtures,readonly`, goImage, 'go', 'test', '-count=1', '-tags=integration,mrbackup', '-timeout=120s', '-run', '^TestMRBackupRestoreAndOldArtifact$', '-v', './internal/integration']
  run('prepare real pre-upgrade v3 backup', backupGo('prepare'))
  // Dump bytes contain identity data. Keep them only in memory and pipe them
  // directly into the isolated restore; never put them in logs or evidence.
  const dump = spawnSync('docker', ['exec', id, 'mysqldump', '--defaults-extra-file=/fixtures/backup-client.cnf', '--single-transaction', '--no-tablespaces', '--set-gtid-purged=OFF', '--skip-comments', 'idf_test_15'], { timeout: 60000, maxBuffer: 8 * 1024 * 1024 })
  results.push({ label: 'real consistent v3 mysqldump', exit_code: dump.status, output: 'Dump and client credentials omitted' })
  if (dump.status !== 0 || !dump.stdout?.length) throw new Error('real consistent backup failed')
  const restored = spawnSync('docker', ['exec', '-i', id, 'mysql', '--defaults-extra-file=/fixtures/backup-client.cnf', 'idf_test_16'], { input: dump.stdout, timeout: 60000 })
  dump.stdout.fill(0)
  results.push({ label: 'restore into independent v3 database', exit_code: restored.status, output: 'Restore data omitted' })
  if (restored.status !== 0) throw new Error('isolated restore failed')
  run('actual old artifact rejection and restored identities', backupGo('verify'))
  const assignmentBackupGo = stage => [...goArgs, '--network', id, '--env-file', resolve(directory, 'test.env'), '-e', `AT_BACKUP_STAGE=${stage}`, '--mount', `type=bind,source=${directory},target=/fixtures,readonly`, goImage, 'go', 'test', '-count=1', '-tags=integration,atbackup', '-timeout=120s', '-run', '^TestATBackupRestoreAndActualTargetMatrix$', '-v', './internal/integration']
  run('AT-SC-20 prepare real pre-upgrade4 backup', assignmentBackupGo('prepare'))
  const dump05 = spawnSync('docker', ['exec', id, 'mysqldump', '--defaults-extra-file=/fixtures/backup-client.cnf', '--single-transaction', '--no-tablespaces', '--set-gtid-purged=OFF', '--skip-comments', 'idf_test_28'], { timeout: 60000, maxBuffer: 8 * 1024 * 1024 })
  results.push({ label: 'AT-SC-20 real consistent v4 mysqldump', exit_code: dump05.status, output: 'Dump and client credentials omitted' })
  if (dump05.status !== 0 || !dump05.stdout?.length) throw new Error('AT real consistent backup failed')
  const restored05 = spawnSync('docker', ['exec', '-i', id, 'mysql', '--defaults-extra-file=/fixtures/backup-client.cnf', 'idf_test_29'], { input: dump05.stdout, timeout: 60000 })
  dump05.stdout.fill(0)
  results.push({ label: 'AT-SC-20 restore into independent v4 database', exit_code: restored05.status, output: 'Restore data omitted' })
  if (restored05.status !== 0) throw new Error('AT isolated restore failed')
  run('AT-SC-20 actual schema4/5 artifacts and restored identity/material bytes', assignmentBackupGo('verify'))

  const documentBackupGo = stage => [...goArgs, '--network', id, '--env-file', resolve(directory, 'test.env'), '-e', `DI_BACKUP_STAGE=${stage}`, '--mount', `type=bind,source=${directory},target=/fixtures${stage === 'prepare' ? '' : ',readonly'}`, goImage, 'go', 'test', '-count=1', '-tags=integration,dibackup', '-timeout=120s', '-run', '^TestDIBackupRestoreAndActualFiveSixMatrix$', '-v', './internal/integration']
  // Keep the saved session private AND readable by the unprivileged host
  // runner. Root in the test container truncates this existing file without
  // changing its host ownership; creating it there would leave root:0600.
  const recoveryFile = resolve(directory, 'di-recovery-state.json')
  writeFileSync(recoveryFile, '', { mode: 0o600, flag: 'wx' })
  run('DI-SC-15 prepare5 data and stop actual accepted5 writer', documentBackupGo('prepare'))
  const recoveryStat = statSync(recoveryFile)
  if (process.platform !== 'win32' && (recoveryStat.uid !== process.getuid() || (recoveryStat.mode & 0o777) !== 0o600)) throw new Error('Private recovery state ownership/mode invalid')
  const recovery = JSON.parse(readFileSync(recoveryFile))
  secrets.push(recovery.TeacherToken)
  const backupTime = new Date().toISOString()
  const dump06 = spawnSync('docker', ['exec', id, 'mysqldump', '--defaults-extra-file=/fixtures/backup-client.cnf', '--single-transaction', '--no-tablespaces', '--set-gtid-purged=OFF', '--skip-comments', 'idf_test_63'], { timeout: 60000, maxBuffer: 8 * 1024 * 1024 })
  results.push({ label: 'DI-SC-15 actual stopped5 consistent mysqldump', exit_code: dump06.status, output: 'Dump bytes, saved session and credentials omitted', backup_utc: backupTime, accepted5_commit: pre06Commit,
    dump_bytes: dump06.stdout?.length, dump_sha256: createHash('sha256').update(dump06.stdout ?? '').digest('hex') })
  if (dump06.status !== 0 || !dump06.stdout?.length) throw new Error('DI actual consistent5 backup failed')
  let restoreStarted
  try {
    run('DI-SC-15 actual migration6 interruption preserves dirty source', documentBackupGo('interrupt'))
    restoreStarted = Date.now()
    const restored06 = spawnSync('docker', ['exec', '-i', id, 'mysql', '--defaults-extra-file=/fixtures/backup-client.cnf', 'idf_test_64'], { input: dump06.stdout, timeout: 60000 })
    results.push({ label: 'DI-SC-15 restore5 into separate database after failed6', exit_code: restored06.status, output: 'Restore bytes omitted' })
    if (restored06.status !== 0) throw new Error('DI isolated5 restore failed')
  } finally { dump06.stdout.fill(0) }
  run('DI-SC-15 actual5/6 recovery saved session TXT pending replay and forward repair', documentBackupGo('verify'))
  results.push({ label: 'DI-SC-15 measured recovery and data boundary', exit_code: 0, output: 'Restored5 uses accepted5 artifacts; preserved6 is separate; no promise to restore post-backup6 writes',
    restore_started_utc: new Date(restoreStarted).toISOString(), finished_utc: new Date().toISOString(), observed_rto_upper_bound_ms: Date.now() - restoreStarted, source: 'idf_test_63', restore: 'idf_test_64' })

} catch (e) { failed = true; console.error(e.message) }
finally {
  for (const [label, args] of [['remove test container and its anonymous volume', ['rm', '-f', '-v', id]], ['remove test network', ['network', 'rm', id]], ['remove only own MySQL image tag', ['image', 'rm', mysqlImage]]]) {
    const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 30000 })
    results.push({ label, exit_code: r.status, output: redact((r.stdout ?? '') + (r.stderr ?? '')) })
    if (r.status !== 0 && !((r.stderr ?? '').includes('No such') || (r.stderr ?? '').includes('not found'))) failed = true
  }
  // Only this random run directory, resolved beneath workspace/output/identity.
  rmSync(directory, { recursive: true, force: true })
  writeFileSync('output/identity/results.json', JSON.stringify({ time: new Date().toISOString(), mysqlImage, results }, null, 2) + '\n')
}
process.exitCode = failed ? 1 : 0
