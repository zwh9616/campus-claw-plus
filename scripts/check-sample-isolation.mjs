import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from '../frontend/node_modules/vite/dist/node/index.js'

// FEF-SC-13: visual fixtures must never become a production identity source.
function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) inspect(path)
    else {
      assert.notEqual(entry.name, 'samples.html', 'Test entry emitted into production')
      const text = readFileSync(path, 'utf8')
      for (const marker of ['样板审查', '隔离合成数据', 'LoginSample', 'AccountSample']) assert.ok(!text.includes(marker), 'Sample fixture leaked into production: ' + marker)
    }
  }
}
inspect(resolve('frontend/dist'))
for (const mode of ['development', 'samples']) {
  const server = await createServer({ root: resolve('frontend'), configFile: resolve('frontend/vite.config.ts'), mode, server: { host: '127.0.0.1', port: 0, strictPort: false } })
  try {
    await server.listen()
    const address = server.httpServer.address()
    assert.ok(address && typeof address !== 'string')
    const result = await fetch(`http://127.0.0.1:${address.port}/samples.html`)
    assert.equal(result.status, mode === 'samples' ? 200 : 404)
    if (mode === 'samples') assert.match(await result.text(), /src\/samples\/main.tsx/)
  } finally { await server.close() }
}
console.log('FEF-SC-13: production excludes samples; normal dev rejects test entry; explicit samples mode serves it.')
