import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runSequence, acquireLock } from './gate-runner.mjs'

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 19)) throw new Error('Gate requires Node >=22.19.0')
if (!process.env.npm_execpath) throw new Error('Use npm run gate (or make gate)')
mkdirSync('output/verification', { recursive: true })
const release = acquireLock(resolve('output/verification/gate.lock'))
const controller = new AbortController()
const cancel = () => controller.abort()
process.on('SIGINT', cancel)
process.on('SIGTERM', cancel)
try {
  const steps = [['check', 600000], ['audit', 180000], ['secret-scan', 300000], ['verify', 600000]]
    .map(([name, timeoutMs]) => ({ name, timeoutMs, command: process.execPath,
      args: [process.env.npm_execpath, 'run', name] }))
  const result = await runSequence(steps, { signal: controller.signal,
    onStart: name => console.log('\nGate: ' + name) })
  writeFileSync('output/verification/gate-results.json', JSON.stringify({
    time: new Date().toISOString(), node: process.version, ...result,
  }, null, 2) + '\n')
  for (const stage of result.results) console.log(`Gate ${stage.name}: ${stage.reason}, exit=${stage.exitCode}`)
  if (result.notRun.length) console.error('Not run: ' + result.notRun.join(', '))
  process.exitCode = result.exitCode
} finally {
  process.off('SIGINT', cancel)
  process.off('SIGTERM', cancel)
  release()
}
