import assert from 'node:assert/strict'
import test from 'node:test'
import { documentMigrationTests as names, documentRecoverySteps as labels, validateDocumentMigrationEvidence as validate } from './document-migration-evidence.mjs'

// Validator fixtures only; real MySQL/process/dump evidence is emitted by the
// unchanged original runtime entry point plus the new DI phases.
const valid = () => {
  const passed = name => `--- PASS: ${name} (0.01s)`
  const primary = { label: 'real MySQL identity scenarios', exit_code: 0, output: names.map(passed).join('\n') + '\n' + [1,2,3,4,5].map(n => '    ' + passed(names[1] + '/' + n)).join('\n') }
  const steps = labels.map(label => ({ label, exit_code: 0, output: passed('TestDIBackupRestoreAndActualFiveSixMatrix') }))
  steps[1].output = ['pre06-server','pre06-admin','server','identity-admin'].map((n,i) => (i + 1).toString().repeat(64) + '  /fixtures/' + n).join('\n')
  Object.assign(steps[3], { accepted5_commit: 'c1ac4213580df1fcc03520b8dddcfbece2a3344d', dump_bytes: 16384, dump_sha256: 'a'.repeat(64), backup_utc: '2026-11-14T00:00:00Z' })
  Object.assign(steps[7], { restore_started_utc: '2026-11-14T00:00:01Z', finished_utc: '2026-11-14T00:00:06Z', observed_rto_upper_bound_ms: 5000,
    source: 'idf_test_63', restore: 'idf_test_64', output: 'no promise to restore post-backup6 writes' })
  return { results: [primary,...steps] }
}
test('DI-SC-15 exact real migration groups and every stopped5/interrupted6/restored5 phase required', () => {
  assert.equal(validate(valid()).target, 6)
  for (const label of labels) for (const state of ['missing','failed','duplicate']) {
    const r = valid(), s = r.results.find(x => x.label === label)
    if (state === 'missing') r.results.splice(r.results.indexOf(s),1)
    else if (state === 'failed') s.exit_code = 1
    else r.results.push(structuredClone(s))
    assert.throws(() => validate(r), label + ' ' + state)
  }
})
test('DI-SC-15 missing/nested/duplicate PASS, skips and omitted DDL interruption block verification', () => {
  for (const name of names) for (const mutate of [s => s.replace(`--- PASS: ${name} (0.01s)`, ''), s => s.replace(`--- PASS: ${name}`, `    --- PASS: ${name}`), s => s + `\n--- PASS: ${name} (0.02s)`]) {
    const r = valid();r.results[0].output = mutate(r.results[0].output);assert.throws(() => validate(r))
  }
  for (const change of [s => s + '\n    --- SKIP: TestDI/subcase (0.01s)', s => s.replace('    --- PASS: '+names[1]+'/3 (0.01s)', '')]) {
    const r = valid();r.results[0].output = change(r.results[0].output);assert.throws(() => validate(r))
  }
})
test('DI-SC-15 binary/dump identity, real RTO and separate database data boundary cannot be omitted', () => {
  for (const mutate of [
    r => r.results[2].output = 'compiled',
    r => r.results[4].accepted5_commit = '0'.repeat(40),
    r => r.results[4].dump_bytes = 0,
    r => r.results[8].restore = r.results[8].source,
    r => r.results[8].observed_rto_upper_bound_ms = 1,
    r => r.results[8].observed_rto_upper_bound_ms = 3600001,
    r => r.results[8].output = 'rollback complete',
    r => r.results[7].output = 'all passed',
    r => { [r.results[4],r.results[5]] = [r.results[5],r.results[4]] },
  ]) { const r = valid(); mutate(r); assert.throws(() => validate(r)) }
})
