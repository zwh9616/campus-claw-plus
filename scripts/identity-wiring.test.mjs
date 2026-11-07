import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { validateWiringInputs } from './identity-compose.mjs'

const env = () => ({ HTTP_PORT:'18080', IDENTITY_STATE_DIR: resolve('output/identity'), IDENTITY_PROXY_NETWORK: 'campus-isolated', IDENTITY_PROXY_IP: '172.30.0.2', IDENTITY_HTTPS_HOST: 'campus.test', IDENTITY_HTTPS_PORT: '8443', HTTPS_CERT_FILE: resolve('output/identity/https.pem'), HTTPS_KEY_FILE: resolve('output/identity/https.key') })
test('IDF-SC-18 required input, hostname and exact proxy boundaries', () => {
  validateWiringInputs(env())
  for (const key of Object.keys(env())) for (const value of ['', ' ', undefined]) assert.throws(() => validateWiringInputs({ ...env(), [key]: value }))
  for (const host of ['a;return 200;', 'a\nserver', '*.test', 'https://campus.test', 'campus.test:443', '127.0.0.1', '-bad.test']) assert.throws(() => validateWiringInputs({ ...env(), IDENTITY_HTTPS_HOST: host }))
  for (const ip of ['0.0.0.0', '127.0.0.1', '::1', '172.30.0.2/24', 'not-ip']) assert.throws(() => validateWiringInputs({ ...env(), IDENTITY_PROXY_IP: ip }))
  for (const port of ['0', '-1', '65536', '1.5']) assert.throws(() => validateWiringInputs({ ...env(), IDENTITY_HTTPS_PORT: port }))
  for (const port of ['1', '65535']) validateWiringInputs({ ...env(), IDENTITY_HTTPS_PORT: port })
})
test('IDF-SC-17/18 isolated wiring keeps secrets, ports and current phase separated', () => {
  const c = parse(readFileSync('deploy/identity/compose.yaml', 'utf8'))
  assert.equal(c.services.mysql.ports, undefined)
  assert.equal(c.services.preview.ports, undefined)
  assert.equal(c.services.admin.ports, undefined)
  assert.ok(c.services.mysql.volumes.includes('mysql-data:/var/lib/mysql'))
  assert.equal(c.services.preview.environment.AUTH_TRUSTED_PROXY_CIDRS, '${IDENTITY_PROXY_IP:?Provide IDENTITY_PROXY_IP}/32')
  assert.equal(c.services.preview.env_file.length, 1)
  assert.match(c.services.preview.env_file[0], /backend\.env$/)
  assert.match(c.services.admin.env_file[0], /admin\.env$/)
  for (const service of Object.values(c.services)) for (const mount of service.volumes ?? []) if (typeof mount === 'object' && mount.type === 'bind') { assert.equal(mount.read_only, true); assert.equal(mount.bind.create_host_path, false) }
  assert.deepEqual(c.services.preview.profiles, ['preview'])
  assert.deepEqual(c.services.admin.profiles, ['tools'])
  assert.deepEqual(c.services.gateway.command, ['nginx', '-g', 'daemon off;'])
  assert.equal(JSON.parse(readFileSync('docs/contracts/identity-phase.json')).current_phase, 'identity')
  const root=parse(readFileSync('compose.yaml','utf8'))
  assert.deepEqual(Object.keys(root.services).sort(),['admin','backend','frontend','mysql'])
  assert.equal(root.services.backend.profiles,undefined)
  assert.equal(root.services.mysql.ports,undefined)
  assert.equal(root.services.backend.ports,undefined)
  assert.deepEqual(root.services.backend.healthcheck.test,['CMD','/server','--healthcheck'])
  assert.equal(root.services.backend.build.dockerfile,undefined)
  assert.deepEqual(root.services.admin.profiles,['tools'])
  assert.equal(root.services.frontend.ports.length,1)
  assert.match(root.services.frontend.ports[0],/^127\.0\.0\.1:/)
  const productionProxy=readFileSync('deploy/identity/production-proxy.conf.template','utf8')
  assert.match(productionProxy,/proxy_pass http:\/\/backend:\$\{HTTP_PORT\}/)
  assert.doesNotMatch(productionProxy,/http_x_real_ip|proxy_add_x_forwarded_for/)
  const proxy = readFileSync('deploy/identity/identity-proxy.conf', 'utf8')
  assert.match(proxy, /proxy_set_header X-Real-IP \$remote_addr;/)
  assert.match(proxy, /proxy_set_header X-Forwarded-For "";/)
  assert.match(proxy, /proxy_request_buffering off;/)
  assert.doesNotMatch(proxy, /proxy_add_x_forwarded_for|http_x_real_ip/)
  const nginx = readFileSync('deploy/identity/nginx.conf.template', 'utf8')
  assert.match(nginx, /ssl_protocols TLSv1.2 TLSv1.3;/)
  assert.match(nginx, /access_log off;/)
  assert.match(nginx, /client_max_body_size 0;/)
})
