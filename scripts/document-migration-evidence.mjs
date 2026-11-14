import assert from 'node:assert/strict'

export const documentMigrationTests = ['TestDIMigration6FreshUpgradeAndHistory', 'TestDIFiveDDLInterruptionAndForwardRepair', 'TestDIExactStructureDrift', 'TestDIEmptyDisposableDownOnly']
export const documentRecoverySteps = ['DI-SC-15 build actual accepted schema5 artifacts',
  'DI-SC-15 record actual accepted5 and candidate6 artifact IDs', 'DI-SC-15 prepare5 data and stop actual accepted5 writer',
  'DI-SC-15 actual stopped5 consistent mysqldump', 'DI-SC-15 actual migration6 interruption preserves dirty source',
  'DI-SC-15 restore5 into separate database after failed6', 'DI-SC-15 actual5/6 recovery saved session TXT pending replay and forward repair',
  'DI-SC-15 measured recovery and data boundary']

const onePass = (output, name, indent = '') => {
  assert.equal(typeof output, 'string')
  assert.ok(!/^\s*--- (?:FAIL|SKIP):/m.test(output), 'Failed/skipped migration tests block verification')
  assert.equal((output.match(new RegExp(`^${indent}--- PASS: ${name} \\(\\d+(?:\\.\\d+)?s\\)$`, 'gm')) ?? []).length, 1, 'Exactly one actual migration test required: ' + name)
}
export function validateDocumentMigrationEvidence(report) {
  const required = label => {
    const steps = report.results.filter(r => r.label === label)
    assert.equal(steps.length, 1, 'Exactly one migration6 phase required: ' + label)
    assert.equal(steps[0].exit_code, 0, 'Migration6 phase failed: ' + label)
    return steps[0]
  }
  const actual = required('real MySQL identity scenarios')
  for (const name of documentMigrationTests) onePass(actual.output, name)
  for (let step = 1; step <= 5; step++) onePass(actual.output, `TestDIFiveDDLInterruptionAndForwardRepair/${step}`, '    ')
  let previous = -1
  for (const label of documentRecoverySteps) {
    const index = report.results.indexOf(required(label))
    assert.ok(index > previous, 'Stopped writer, backup, interrupted upgrade and isolated recovery must remain ordered')
    previous = index
  }
  onePass(required(documentRecoverySteps[2]).output, 'TestDIBackupRestoreAndActualFiveSixMatrix')
  onePass(required(documentRecoverySteps[4]).output, 'TestDIBackupRestoreAndActualFiveSixMatrix')
  onePass(required(documentRecoverySteps[6]).output, 'TestDIBackupRestoreAndActualFiveSixMatrix')
  const ids = required(documentRecoverySteps[1]).output
  const binaries = {}
  for (const name of ['pre06-server', 'pre06-admin', 'server', 'identity-admin']) {
    const matches = [...ids.matchAll(new RegExp(`^([a-f0-9]{64})  /fixtures/${name}$`, 'gm'))]
    assert.equal(matches.length, 1, 'Exact binary SHA required: ' + name)
    binaries[name] = matches[0][1]
  }
  assert.notEqual(binaries['pre06-server'], binaries.server)
  assert.notEqual(binaries['pre06-admin'], binaries['identity-admin'])
  const dump = required(documentRecoverySteps[3])
  assert.equal(dump.accepted5_commit, 'c1ac4213580df1fcc03520b8dddcfbece2a3344d')
  assert.ok(Number.isInteger(dump.dump_bytes) && dump.dump_bytes > 0 && dump.dump_bytes <= 8 * 1024 * 1024)
  assert.match(dump.dump_sha256, /^[a-f0-9]{64}$/)
  const measured = required(documentRecoverySteps[7])
  const start = Date.parse(measured.restore_started_utc), finish = Date.parse(measured.finished_utc)
  assert.ok(Number.isFinite(Date.parse(dump.backup_utc)) && Date.parse(dump.backup_utc) <= start && start <= finish)
  assert.ok(Number.isInteger(measured.observed_rto_upper_bound_ms) && measured.observed_rto_upper_bound_ms > 0 && measured.observed_rto_upper_bound_ms <= 3600000)
  assert.ok(measured.observed_rto_upper_bound_ms >= finish - start && measured.observed_rto_upper_bound_ms <= finish - start + 1000)
  assert.equal(measured.source, 'idf_test_63'); assert.equal(measured.restore, 'idf_test_64')
  assert.ok(measured.output.includes('no promise to restore post-backup6 writes'))
  return { target: 6, restored_target: 5, tests: documentMigrationTests, interrupted_ddl_steps: 5,
    accepted5_commit: dump.accepted5_commit, binaries, dump_sha256: dump.dump_sha256,
    backup_utc: dump.backup_utc, observed_rto_upper_bound_ms: measured.observed_rto_upper_bound_ms,
    separate_preserved_source: measured.source, isolated_restore: measured.restore }
}
