import { spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'

const { goImage } = JSON.parse(readFileSync('scripts/toolchain.json', 'utf8'))
const id = 'campus-idf-' + randomBytes(6).toString('hex')
const mysqlImage = id + '-mysql:verification'
const directory = resolve('output/identity', id)
mkdirSync(directory, { recursive: true })
const results = []
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
  run('test fixtures', [...goArgs, '--network', 'none', '--mount', `type=bind,source=${directory},target=/fixtures`, goImage, 'sh', '-c', 'go run ./internal/integration/fixture /fixtures && go build -trimpath -buildvcs=false -o /fixtures/identity-admin ./cmd/identity-admin'])
  const env = readFileSync(resolve(directory, 'test.env'), 'utf8')
  secrets = [...env.matchAll(/idf_(?:app|migration):([^@]+)@/g)].map(m => m[1])
  secrets.push(readFileSync(resolve(directory, 'root-password'), 'utf8'))
  run('isolated network', ['network', 'create', '--internal', id])
  run('isolated MySQL', ['run', '-d', '--name', id, '--network', id, '--network-alias', 'mysql', '--mount', `type=bind,source=${directory},target=/fixtures,readonly`, '--mount', `type=bind,source=${resolve(directory, 'initialize.sql')},target=/docker-entrypoint-initdb.d/initialize.sql,readonly`, '-e', 'MYSQL_ROOT_PASSWORD_FILE=/fixtures/root-password', mysqlImage, '--require-secure-transport=ON', '--ssl-ca=/fixtures/ca.pem', '--ssl-cert=/fixtures/server.pem', '--ssl-key=/fixtures/server.key'])
  run('real MySQL identity scenarios', [...goArgs, '--network', id, '--env-file', resolve(directory, 'test.env'), '--mount', `type=bind,source=${directory},target=/fixtures,readonly`, goImage, 'go', 'test', '-count=1', '-tags=integration', '-timeout=240s', '-v', './internal/integration'])
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
