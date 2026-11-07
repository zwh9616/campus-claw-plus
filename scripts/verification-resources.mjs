import assert from 'node:assert/strict'

// Keep the approved Compose services/health/config; isolate only test resources.
export function isolateCompose(source, project) {
  assert.match(project, /^campus-verify-[a-z0-9-]+$/)
  assert.deepEqual(Object.keys(source.services).sort(), ['backend', 'frontend'])
  const config = structuredClone(source)
  config.name = project
  for (const [name, service] of Object.entries(config.services)) {
    service.image = `${project}-${name}:verification`
    assert.ok(service.ports?.length, 'Verification requires real published ports')
    for (const port of service.ports) {
      assert.equal(port.host_ip, '127.0.0.1')
      port.published = '0' // Docker reserves a free host port atomically.
    }
  }
  return config
}
