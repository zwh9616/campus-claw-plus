import { readFileSync, statSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { isIP } from 'node:net'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function validateWiringInputs(env, { ephemeral = false } = {}) {
  const register = JSON.parse(readFileSync('deploy/identity/inputs.json', 'utf8'))
  for (const { name } of register.inputs) {
    if (typeof env[name] !== 'string' || !env[name] || env[name] !== env[name].trim() || /[\r\n\0]/.test(env[name])) throw new Error(`${name} missing or invalid`)
  }
  if (!isAbsolute(env.IDENTITY_STATE_DIR)) throw new Error('IDENTITY_STATE_DIR must be absolute')
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,100}$/.test(env.IDENTITY_PROXY_NETWORK)) throw new Error('IDENTITY_PROXY_NETWORK invalid')
  if (isIP(env.IDENTITY_PROXY_IP) !== 4 || /^(0\.|127\.|169\.254\.)/.test(env.IDENTITY_PROXY_IP)) throw new Error('IDENTITY_PROXY_IP invalid')
  const host = env.IDENTITY_HTTPS_HOST
  if (host.length > 253 || !host.split('.').every(label => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label)) || isIP(host)) throw new Error('IDENTITY_HTTPS_HOST invalid')
  if (!/^\d+$/.test(env.HTTP_PORT ?? "") || +env.HTTP_PORT < 1 || +env.HTTP_PORT > 65535) throw new Error("HTTP_PORT invalid")
  const port = env.IDENTITY_HTTPS_PORT
  if (!/^\d+$/.test(port) || +port > 65535 || +port < (ephemeral ? 0 : 1)) throw new Error('IDENTITY_HTTPS_PORT invalid')
  for (const key of register.existing_frozen_inputs) if (!isAbsolute(env[key] ?? '')) throw new Error(`${key} must be absolute`)
}

export function checkWiringFiles(env) {
  const register = JSON.parse(readFileSync('deploy/identity/inputs.json', 'utf8'))
  for (const file of Object.keys(register.state_files)) if (!statSync(resolve(env.IDENTITY_STATE_DIR, file)).isFile()) throw new Error('Wiring input file unavailable')
  for (const key of register.existing_frozen_inputs) if (!statSync(env[key]).isFile()) throw new Error(`${key} unavailable`)
  const backend = parseEnv(readFileSync(resolve(env.IDENTITY_STATE_DIR, 'backend.env'), 'utf8'))
  const admin = parseEnv(readFileSync(resolve(env.IDENTITY_STATE_DIR, 'admin.env'), 'utf8'))
  if (Object.keys(backend).sort().join() !== ['AUTH_TRUSTED_ORIGIN', 'MYSQL_CA_FILE', 'MYSQL_DSN'].join() || Object.keys(admin).sort().join() !== ['MYSQL_CA_FILE', 'MYSQL_DSN', 'MYSQL_MIGRATION_DSN'].join()) throw new Error('Wiring process key separation invalid')
  const origin = `https://${env.IDENTITY_HTTPS_HOST}${+env.IDENTITY_HTTPS_PORT === 443 ? '' : ':' + env.IDENTITY_HTTPS_PORT}`
  if (backend.AUTH_TRUSTED_ORIGIN !== origin) throw new Error('AUTH_TRUSTED_ORIGIN must match published HTTPS origin')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length < 4) throw new Error('Usage: node scripts/identity-compose.mjs LOCAL_ENV_FILE COMPOSE_ARGS...')
    const file = resolve(process.argv[2])
    const env = parseEnv(readFileSync(file, 'utf8'))
    validateWiringInputs(env)
    checkWiringFiles(env)
    // Avoid expanded `config` output: it contains runtime credentials.
    if (process.argv.slice(3).includes('config')) throw new Error('Expanded configuration is not a shareable diagnostic; use the verifier')
    const result = spawnSync('docker', ['compose', '--env-file', file, '--file', 'compose.yaml', ...process.argv.slice(3)], { stdio: 'inherit', env: { ...process.env, ...env } })
    process.exitCode = result.status ?? 1
  } catch (error) {
    // Filesystem errors can expose private paths; known validation errors omit values.
    console.error(error.code ? 'Wiring file unavailable' : error.message)
    process.exitCode = 1
  }
}
