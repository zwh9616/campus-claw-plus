import assert from 'node:assert/strict'
import https from 'node:https'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Connect to the published loopback port from the actual Docker client host.
// TLS still validates the configured DNS SAN; no global trust or skip-verify.
export function hostRequest({ port, ca, servername = 'campus.test', path = '/health' }) {
  return new Promise((accept, reject) => {
    const started = performance.now()
    const request = https.get({ host: '127.0.0.1', port, servername, path, ca,
      rejectUnauthorized: true, agent: false, minVersion: 'TLSv1.2',
      signal: AbortSignal.timeout(7000) }, response => {
      const data = []
      let length = 0
      response.on('data', chunk => {
        length += chunk.length
        if (length > 65536) return response.destroy(new Error('Published ingress response exceeds bound'))
        data.push(chunk)
      })
      response.on('error', reject)
      response.on('end', () => accept({ status: response.statusCode, headers: response.headers,
        body: Buffer.concat(data).toString('utf8'), duration_ms: performance.now() - started }))
    })
    request.on('error', reject)
  })
}

export async function verifyHostIngress(port, directory) {
  const ca = readFileSync(resolve(directory, 'ca.pem'))
  const result = await hostRequest({ port, ca })
  assert.equal(result.status, 200)
  assert.deepEqual(JSON.parse(result.body), { status: 'ok', dependencies: { mysql: 'up' } })
  assert.match(result.headers['x-request-id'], /^[a-f0-9]{32}$/)
  assert.ok(result.duration_ms < 3500, 'Host health exceeded 3s budget plus transport allowance')
  const page = await hostRequest({ port, ca, path: '/' })
  assert.equal(page.status, 200)
  assert.match(page.headers['content-type'], /^text\/html/)
  assert.match(page.body, /<html[\s>]/i)
  const anonymous = await hostRequest({ port, ca, path: '/api/v1/me' })
  assert.equal(anonymous.status, 401)
  const denied = JSON.parse(anonymous.body)
  assert.equal(denied.error.code, 'UNAUTHENTICATED')
  assert.equal(denied.request_id, anonymous.headers['x-request-id'])
  await assert.rejects(hostRequest({ port, ca, servername: 'wrong-host.invalid' }),
    error => error.code === 'ERR_TLS_CERT_ALTNAME_INVALID')
  await assert.rejects(hostRequest({ port, ca: readFileSync(resolve(directory, 'https.pem')) }),
    error => /CERT|VERIFY|ISSUER|SELF_SIGNED/.test(error.code ?? ''))
  return { health: result.status, health_duration_ms: result.duration_ms, page: page.status,
    anonymous_me: anonymous.status, wrong_san_rejected: true, wrong_ca_rejected: true }
}
