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
      for (const marker of ['样板审查', '隔离合成数据', 'LoginSample', 'AccountSample', 'MaterialSample', '资料样板边界标题', '当前显示合成样板结果', 'DocumentSample', '提交后流程预览', '本班资料长标题与非BMP字符']) assert.ok(!text.includes(marker), 'Sample fixture leaked into production: ' + marker)
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
    // MF-SC-10: direct fixture source access is also rejected outside samples mode.
    const fixture = await fetch(`http://127.0.0.1:${address.port}/src/samples/MaterialSamples.tsx`)
    assert.equal(fixture.status, mode === 'samples' ? 200 : 404)
    // DI-SC-13: new PDF/Word fixtures and styles share the same isolation boundary.
    for (const path of ['DocumentSamples.tsx', 'document-samples.css']) {
      const documentFixture = await fetch(`http://127.0.0.1:${address.port}/src/samples/${path}`)
      assert.equal(documentFixture.status, mode === 'samples' ? 200 : 404)
    }
  } finally { await server.close() }
}
console.log('FEF-SC-13: production excludes samples; normal dev rejects test entry; explicit samples mode serves it.')
