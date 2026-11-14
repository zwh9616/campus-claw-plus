import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes, createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// DI-SC-07/09/15: candidate DDL contract probe only. No runtime migration6,
// server/admin/repair6 or holder database is used or claimed by this program.
const runId = 'campus-di-ddl-' + randomBytes(6).toString('hex')
const image = runId + ':probe'
const container = runId + '-mysql'
const directory = resolve('output/document-storage-contract')
mkdirSync(directory, { recursive: true })
const envfile = resolve(directory, runId + '.env')
const password = randomBytes(32).toString('base64url')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const git = args => spawnSync('git', args, { encoding: 'utf8' }).stdout.trim()
const contract = JSON.parse(readFileSync('docs/contracts/document-integration.json'))
const candidate = 'docs/contracts/document-parser/migration/'
const sources = Object.fromEntries(Object.keys(contract.migration.files).map(n => [n, sha(readFileSync(candidate + n))]))
assert.deepEqual(sources, contract.migration.files)
const targetSource = readFileSync('backend/internal/migrations/target.go')
assert.equal(sha(targetSource), contract.baseline.protected_files['backend/internal/migrations/target.go'])
const runtimeTarget = Number(targetSource.toString('utf8').match(/\bconst\s+Target\s*=\s*(\d+)/)?.[1])
assert.equal(runtimeTarget, 5)
assert.equal(runtimeTarget, contract.migration.current_target)
const results = []
const report = { run_id: runId, time: new Date().toISOString(), exit_code: 1,
  source: { commit: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain']) !== '' },
  candidate_sql: sources, scope: 'isolated candidate SQL constraints and actual Go document queue; no Target6/dirty/repair/backup/RPC/runtime activation claim' }

function docker(args, input, timeout = 30000) {
  return spawnSync('docker', args, { input, encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, MYSQL_PWD: password } })
}
function command(label, args, timeout = 180000) {
  const r = docker(args, undefined, timeout)
  results.push({ label, exit_code: r.status })
  if (r.status !== 0) throw new Error(label + ' failed: ' + (r.stderr ?? '').replaceAll(password, '<redacted>').slice(-2000))
  return r.stdout.trim()
}
function sql(label, text, { reject = false, code, database = 'di_contract_probe' } = {}) {
  const r = docker(['exec', '-i', '-e', 'MYSQL_PWD', container, 'mysql', '--protocol=TCP', '-h127.0.0.1', '-uroot', '--batch', '--raw', '--skip-column-names', '--default-character-set=utf8mb4', ...(database ? [database] : [])], text)
  const actualCode = (r.stderr ?? '').match(/\bERROR (\d+) /)
  results.push({ label, exit_code: r.status, expected_rejection: reject, error_code: code,
    actual_error_code: actualCode ? Number(actualCode[1]) : null })
  if (reject) {
    assert.notEqual(r.status, 0, label + ' must reject')
    assert.match(r.stderr ?? '', new RegExp(`ERROR ${code} `), label + ' wrong failure')
  } else if (r.status !== 0) {
    throw new Error(label + ' failed: ' + (r.stderr ?? '').replaceAll(password, '<redacted>').slice(-2000))
  }
  console.log('Document DDL ' + label + ': ' + (reject ? 'expected reject' : 'passed'))
  return (r.stdout ?? '').trim()
}
const insertDocument = (id, classId = 1, creator = 1, extra = '') => `INSERT INTO documents(id,class_id,created_by,title,format,version,status,original_bytes,original_digest,size_bytes,attempts,created_at,updated_at${extra ? ',body,page_count' : ''}) VALUES(${id},${classId},${creator},'课程','pdf',1,'${extra ? 'ready' : 'queued'}','abc',UNHEX(SHA2('abc',256)),3,${extra ? 1 : 0},UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)${extra ? ',' + extra : ''});`
try {
  // No credential file exists until every candidate/baseline preflight passed.
  // Creation and all later failures are covered by this finally cleanup.
  writeFileSync(envfile, 'MYSQL_ROOT_PASSWORD=' + password + '\n', { mode: 0o600 })
  command('build pinned reviewed MySQL candidate-probe image', ['build', '-t', image, 'deploy/identity/mysql'])
  report.image_id = command('record exact probe image', ['image', 'inspect', '--format', '{{.Id}}', image])
  command('start only isolated temporary MySQL', ['run', '-d', '--name', container, '--network', 'none',
    '--memory', '1g', '--memory-swap', '1g', '--cpus', '1', '--mount', 'type=tmpfs,destination=/var/lib/mysql', '--env-file', envfile, report.image_id])
  let ready = false
  for (let attempt = 0; attempt < 120; attempt++) {
    // The official entrypoint's temporary bootstrap daemon skips TCP. A
    // socket-only SELECT can race its shutdown; require the final listener.
    const r = docker(['exec', '-e', 'MYSQL_PWD', container, 'mysql', '--protocol=TCP', '-h127.0.0.1', '-uroot', '--batch', '--skip-column-names', '-e', 'SELECT 1'], undefined, 2000)
    if (r.status === 0 && r.stdout.trim() === '1') { ready = true; break }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.ok(ready, 'Isolated database did not become ready')
  report.mysql_version = sql('actual database version', 'SELECT VERSION();', { database: null })
  assert.match(report.mysql_version, /^8\.4\.13(?:[-.]|$)/)
  sql('fresh isolated schema only', 'CREATE DATABASE di_contract_probe CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;', { database: null })
  const old = readdirSync('backend/internal/migrations/sql').filter(n => n.endsWith('.up.sql')).sort()
  assert.equal(old.length, 5)
  for (const name of old) sql('published table baseline ' + name, readFileSync('backend/internal/migrations/sql/' + name, 'utf8'))
  const count = () => Number(sql('inspect isolated table count', "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='di_contract_probe';"))
  assert.equal(count(), 14)
  sql('exact five candidate DDL', readFileSync(candidate + '000006_documents.up.sql', 'utf8'))
  assert.equal(count(), 19)
  const fk = sql('inspect six candidate FK constraints', "SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema='di_contract_probe' AND table_name IN('documents','document_locations','document_chunks','document_parse_jobs','document_idempotency');")
  assert.equal(Number(fk), 6)
  const checks = sql('inspect eleven enforced candidate CHECK constraints', "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema='di_contract_probe' AND constraint_type='CHECK' AND enforced='YES' AND table_name IN('documents','document_locations','document_chunks','document_parse_jobs','document_idempotency');")
  assert.equal(Number(checks), 11)
  sql('synthetic identity keys only', "INSERT INTO users(id,username,password_hash,role) VALUES(1,'fixture_teacher_1','unusable','teacher'),(2,'fixture_teacher_2','unusable','teacher');INSERT INTO classes(id,stable_key,name) VALUES(1,'fixture_1','班一'),(2,'fixture_2','班二');")
  sql('queued documents for two distinct classes', insertDocument(1) + insertDocument(2, 2, 2))
  sql('Unicode codepoint body and valid ready state', "UPDATE documents SET status='ready',attempts=1,body='课程😀\n\n第二页',page_count=2 WHERE id=1;")
  sql('non-BMP page positions and chunk', "INSERT INTO document_locations VALUES(1,1,1,1,'pdf_page',0,3),(1,1,1,2,'pdf_page',5,8);INSERT INTO document_chunks(document_id,class_id,document_version,unit,ordinal,char_start,char_end,quote) VALUES(1,1,1,1,1,0,3,'课程😀');")
  const measuredCounts = sql('actual MySQL counts emoji as one codepoint', 'SELECT CHAR_LENGTH(body),OCTET_LENGTH(body) FROM documents WHERE id=1;')
  assert.equal(measuredCounts, '8\t21')
  report.unicode_body_counts = measuredCounts.split('\t').map(Number)
  for (const [label, query, code] of [
    ['ready PDF cannot omit page count', insertDocument(3, 1, 1, "'text',NULL"), 3819],
    ['ready cannot omit body', insertDocument(3, 1, 1, 'NULL,1'), 3819],
    ['fourth parse attempt', 'UPDATE documents SET attempts=4 WHERE id=1;', 3819],
    ['original byte count mismatch', 'UPDATE documents SET size_bytes=4 WHERE id=1;', 3819],
    ['Word cannot use PDF page count', "UPDATE documents SET format='docx' WHERE id=1;", 3819],
    ['location cross-class composite FK', "INSERT INTO document_locations VALUES(1,2,1,1,'pdf_page',0,1);", 1452],
    ['location cross-version composite FK', "INSERT INTO document_locations VALUES(1,1,2,1,'pdf_page',0,1);", 1452],
    ['PDF logical unit exceeds page bound', "INSERT INTO document_locations VALUES(1,1,1,201,'pdf_page',0,1);", 3819],
    ['empty source range', "INSERT INTO document_locations VALUES(1,1,1,3,'pdf_page',5,5);", 3819],
    ['chunk cross-class FK', "INSERT INTO document_chunks(document_id,class_id,document_version,unit,ordinal,char_start,char_end,quote) VALUES(1,2,1,1,1,0,1,'x');", 1452],
    ['chunk Unicode range mismatch', "INSERT INTO document_chunks(document_id,class_id,document_version,unit,ordinal,char_start,char_end,quote) VALUES(1,1,1,1,2,0,4,'课程😀');", 3819],
  ]) sql(label, query, { reject: true, code })
  sql('valid leased owner epoch', "START TRANSACTION;UPDATE documents SET status='processing',attempts=1 WHERE id=2;INSERT INTO document_parse_jobs VALUES(2,2,1,'leased',UTC_TIMESTAMP(3),REPEAT('a',32),1,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 60 SECOND));COMMIT;")
  sql('leased owner cannot be null', 'UPDATE document_parse_jobs SET worker_owner=NULL WHERE document_id=2;', { reject: true, code: 3819 })
  sql('leased epoch cannot be zero', 'UPDATE document_parse_jobs SET execution_epoch=0 WHERE document_id=2;', { reject: true, code: 3819 })
  const replay = (user, key) => `INSERT INTO document_idempotency VALUES(${user},1,'${key}',UNHEX(SHA2('payload',256)),1,1,'{"status":"queued"}');`
  sql('binary idempotency key case remains distinct', replay(1, 'ABCDEFGHIJKLMNOP') + replay(1, 'abcdefghijklmnop'))
  sql('same scoped key cannot duplicate', replay(1, 'ABCDEFGHIJKLMNOP'), { reject: true, code: 1062 })
  sql('snapshot cannot bind another creator', replay(2, 'ABCDEFGHIJKLMNOP'), { reject: true, code: 1452 })
  sql('closed original response must be JSON', "UPDATE document_idempotency SET response_body='not JSON';", { reject: true, code: 3819 })
  // Show the SQL/application boundary honestly: quote equality needs a source
  // read in the future service, not just a length CHECK. Never persist poison.
  sql('same-length wrong quote requires application recheck (rolled back)', "START TRANSACTION;UPDATE document_chunks SET quote='错错错' WHERE id=1;ROLLBACK;")
  assert.equal(sql('original quote survived rollback', 'SELECT quote FROM document_chunks WHERE id=1;'), '课程😀')
  sql('remove only synthetic candidate rows', 'DELETE FROM document_idempotency;DELETE FROM document_parse_jobs;DELETE FROM document_chunks;DELETE FROM document_locations;DELETE FROM documents;')
  // DI-SC-07..10: real Go persistence/worker implementation on this exact
  // approved candidate schema. This is still not the runtime migration6.
  const queueFiles = readdirSync('backend/internal/documentqueue').sort()
  const queueSources = Object.fromEntries(queueFiles.map(name => [name, sha(readFileSync('backend/internal/documentqueue/' + name))]))
  const { goImage } = JSON.parse(readFileSync('scripts/toolchain.json', 'utf8'))
  const queueRun = docker(['run', '--rm',
    '--network', 'container:' + container, '--memory', '512m', '--memory-swap', '512m', '--cpus', '1',
    '-e', 'MYSQL_PWD', '-e', 'GOTOOLCHAIN=local',
    '--mount', `type=bind,source=${resolve('backend')},target=/src,readonly`,
    '-v', 'campus-claw-plus-go-cache:/root/.cache/go-build', '-w', '/src', goImage,
    'go', 'test', '-tags=documentqueue', '-shuffle=on', '-count=1', '-timeout=90s', '-v', './internal/documentqueue'], undefined, 150000)
  const queueOutput = ((queueRun.stdout ?? '') + (queueRun.stderr ?? '')).replaceAll(password, '<redacted>')
  writeFileSync(resolve(directory, 'queue-test.log'), queueOutput + '\n')
  results.push({ label: 'actual Go durable document queue on isolated MySQL', exit_code: queueRun.status })
  report.document_queue = { exit_code: queueRun.status, source_files: queueSources,
    log_sha256: sha(readFileSync(resolve(directory, 'queue-test.log'))) }
  assert.equal(queueRun.status, 0, 'actual queue tests failed; original output retained in queue-test.log')
  const actualGroups = [...queueOutput.matchAll(/^--- PASS: (TestMySQL\w+) /gm)].map(m => m[1])
  assert.equal(actualGroups.length, 10, 'all real database queue groups must execute')
  assert.equal(new Set(actualGroups).size, 10)
  assert.ok(!queueOutput.includes('--- SKIP:'))
  assert.deepEqual(Object.fromEntries(queueFiles.map(name => [name, sha(readFileSync('backend/internal/documentqueue/' + name))])), queueSources)
  report.document_queue = { exit_code: 0, groups: actualGroups, source_files: queueSources,
    log_sha256: sha(readFileSync(resolve(directory, 'queue-test.log'))),
    scope: 'actual isolated MySQL queue transactions, 20-way races, leases, atomic publication, explicit retry, single worker and killed process; no production activation/HTTP/migration6 claim' }
  sql('candidate reverse DDL only after all five are empty', readFileSync(candidate + '000006_documents.down.sql', 'utf8'))
  assert.equal(count(), 14)
  report.exit_code = 0
  report.assertions = { old_tables: 14, added_tables: 5, foreign_keys: 6, enforced_checks: 11,
    codepoint_offsets: true, binary_keys: true, application_quote_recheck_still_required: true, runtime_target_still: runtimeTarget }
} catch (error) {
  report.error = error.message.replaceAll(password, '<redacted>')
  console.error(report.error)
} finally {
  report.cleanup = []
  for (const [resource, args, missing] of [[container, ['rm', '-f', container], 'No such container'], [image, ['image', 'rm', image], 'No such image']]) {
    const r = docker(args)
    const ok = r.status === 0 || (r.stderr ?? '').includes(missing)
    report.cleanup.push({ resource, exit_code: r.status, ok })
    if (!ok) report.exit_code = 1
  }
  if (existsSync(envfile)) unlinkSync(envfile)
  report.secret_file_removed = !existsSync(envfile)
  report.finished_at = new Date().toISOString()
  writeFileSync(resolve(directory, 'results.json'), JSON.stringify({ ...report, results }, null, 2) + '\n')
}
process.exitCode = report.exit_code
