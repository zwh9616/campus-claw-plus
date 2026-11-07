import assert from 'node:assert/strict'

// IDF-SC-17: a zero exit with no recognized application is not scan coverage.
export function validateApplicationScan(report, service) {
  assert.ok(Array.isArray(report.Results) && report.Results.length > 0, 'Scanner must recognize image contents')
  const findings = report.Results.flatMap(result => result.Vulnerabilities ?? [])
  assert.equal(findings.length, 0, 'HIGH/CRITICAL findings must block the gate')
  if (service === 'frontend') {
    assert.ok(report.Results.some(result => result.Packages?.some(pkg => pkg.Name === 'nginx' && pkg.Version.startsWith('1.30.6'))), 'Scanner must identify the pinned Nginx runtime')
  } else {
    assert.ok(['backend', 'admin'].includes(service), 'Unknown application image')
    const binary = service === 'backend' ? 'server' : 'identity-admin'
    assert.ok(report.Results.some(result => result.Target === binary && result.Packages?.some(pkg => pkg.Name === 'stdlib' && pkg.Version === 'v1.27.3')), 'Scanner must analyze the real Go application and compiler')
  }
  return { HIGH: 0, CRITICAL: 0 }
}
