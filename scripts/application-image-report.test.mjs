import test from 'node:test'
import assert from 'node:assert/strict'
import { validateApplicationScan } from './application-image-report.mjs'

test('IDF-SC-17 complete application coverage accepts a clean actual runtime report', () => {
  for (const [service, target] of [['backend', 'server'], ['admin', 'identity-admin']]) {
    assert.deepEqual(validateApplicationScan({ Results: [{ Target: target, Packages: [{ Name: 'stdlib', Version: 'v1.27.3' }] }] }, service), { HIGH: 0, CRITICAL: 0 })
  }
  validateApplicationScan({ Results: [{ Packages: [{ Name: 'nginx', Version: '1.30.6-r1' }] }] }, 'frontend')
})

test('IDF-SC-17 a vulnerability or absent binary coverage cannot become a scan pass', () => {
  const clean = { Results: [{ Target: 'server', Packages: [{ Name: 'stdlib', Version: 'v1.27.3' }] }] }
  for (const Severity of ['HIGH', 'CRITICAL']) {
    const report = structuredClone(clean)
    report.Results[0].Vulnerabilities = [{ VulnerabilityID: 'test-finding', Severity }]
    assert.throws(() => validateApplicationScan(report, 'backend'), /findings must block/)
  }
  for (const report of [{ Results: [] }, { Results: [{ Target: 'unrelated', Packages: [] }] }, { Results: [{ Target: 'server', Packages: [{ Name: 'stdlib', Version: 'v1.24.6' }] }] }]) {
    assert.throws(() => validateApplicationScan(report, 'backend'))
  }
  assert.throws(() => validateApplicationScan(clean, 'frontend'), /Nginx/)
})
