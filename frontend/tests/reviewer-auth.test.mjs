import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthClient } from '../src/auth/client.ts'

// FEF-SC-04/07/08: independent review probes through the public client API.
const identity = (version = 1) => ({ user_id: '1', class_id: '2', role: 'teacher',
  session_id: 'd'.repeat(32), session_version: version, expires_at: '2030-01-01T00:00:00.000Z' })
const session = () => Response.json({ access_token: 'synthetic-review-only', token_type: 'Bearer',
  expires_in: 900, principal: identity() })
const csrf = () => Response.json({ csrf_token: 'c'.repeat(32) })
const denied = () => Response.json({ error: { code: 'UNAUTHENTICATED', message: 'Synthetic rejection',
  fields: [], details: null }, request_id: 'e'.repeat(32) }, { status: 401 })

test('FEF-SC-07/08 reviewer: late successful identity cannot resurrect a logged-out session', async () => {
  let release
  const delayed = new Promise(resolve => { release = resolve })
  const responses = [session(), csrf(), delayed, new Response(null, { status: 204 })]
  const calls = []
  const client = createAuthClient(async (url, options) => {
    calls.push({ url, options })
    assert.ok(responses.length, 'Unexpected retry')
    return responses.shift()
  })
  await client.login('review-user', 'synthetic-only')
  const read = client.verify()
  await client.logout()
  assert.equal(client.snapshot().phase, 'anonymous')
  assert.equal(calls[2].options.signal.aborted, true)
  release(Response.json(identity()))
  await read
  assert.equal(client.snapshot().principal, undefined)
  assert.equal(client.snapshot().phase, 'anonymous')
  assert.equal(calls.length, 4)
})

test('FEF-SC-04/08 reviewer: revoked access and refresh hide identity without retrying or logging out another session', async () => {
  const responses = [session(), csrf(), denied(), csrf(), denied()]
  const calls = []
  const client = createAuthClient(async url => {
    calls.push(url)
    assert.ok(responses.length, 'Unexpected retry')
    return responses.shift()
  })
  await client.login('review-user', 'synthetic-only')
  await Promise.all([client.verify(), client.verify(), client.verify()])
  assert.equal(client.snapshot().phase, 'anonymous')
  assert.equal(client.snapshot().principal, undefined)
  assert.deepEqual(calls.map(url => url.split('/').at(-1)), ['login', 'csrf', 'me', 'csrf', 'refresh'])
})

test('FEF-SC-07 reviewer: another tab changing context invalidates an already pending old identity response', async () => {
  let release
  const delayed = new Promise(resolve => { release = resolve })
  const next = { ...identity(2), class_id: '3' }
  const responses = [session(), csrf(), delayed, csrf(), Response.json({
    access_token: 'synthetic-new-context', token_type: 'Bearer', expires_in: 900, principal: next,
  }), csrf(), Response.json(next)]
  const calls = []
  const client = createAuthClient(async (url, options) => {
    calls.push({ url, options })
    assert.ok(responses.length, 'Unexpected retry')
    return responses.shift()
  })
  await client.login('review-user', 'synthetic-only')
  const oldRead = client.verify()
  const changed = client.externalChange()
  // Deliver the old successful response only after the cross-tab notification.
  release(Response.json(identity()))
  await Promise.all([oldRead, changed])
  assert.equal(calls[2].options.signal.aborted, true)
  assert.equal(client.snapshot().phase, 'authenticated')
  assert.equal(client.snapshot().principal.class_id, '3')
  assert.equal(client.snapshot().principal.session_version, 2)
})
