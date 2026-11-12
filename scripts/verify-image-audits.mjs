import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, realpathSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acquireLock, runSequence } from './gate-runner.mjs'

export const scanner = 'aquasec/trivy@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb'
export const databaseArgs = ['--db-repository', 'ghcr.io/aquasecurity/trivy-db:2',
  '--db-repository', 'mirror.gcr.io/aquasec/trivy-db:2']
const workspace = realpathSync('.')
const workspaceId = createHash('sha256').update(process.platform === 'win32' ? workspace.toLowerCase() : workspace).digest('hex').slice(0, 16)
const databaseVolume = `campus-trivy-db-${workspaceId}`

export function auditCache(runId) {
  const owned = process.argv[2] !== '--prepared-db'
  return { volume: owned ? `${runId}-cache` : databaseVolume, owned }
}

// IDF-SC-17 / DO-SC-04: share the database, then scan every actual image.
async function main(args) {
  const prepareOnly = args.length === 1 && args[0] === '--prepare-only'
  const retainImages = args.length === 1 && args[0] === '--retain-images'
  if (args.length && !prepareOnly && !retainImages) throw new Error('Expected --prepare-only, --retain-images or no arguments')
  mkdirSync('output/verification', { recursive: true })
  const release = acquireLock(resolve('output/verification/trivy-db.lock'))
  const controller = new AbortController()
  const cancel = () => controller.abort()
  process.on('SIGINT', cancel)
  process.on('SIGTERM', cancel)
  const container = 'campus-trivy-db-prep-' + randomBytes(6).toString('hex')
  try {
    const sources = prepareOnly ? ['--db-repository', 'public.ecr.aws/aquasecurity/trivy-db:2', ...databaseArgs] : databaseArgs
    const steps = [{ name: 'prepare Trivy vulnerability database', command: 'docker', timeoutMs: prepareOnly ? 910000 : 190000,
      args: ['run', '--rm', '--name', container, '-v', `${databaseVolume}:/root/.cache/trivy`, scanner,
        'image', '--download-db-only', ...sources, '--no-progress', '--timeout', prepareOnly ? '15m' : '3m'] }]
    if (!prepareOnly) {
      // If preparation fails, earlier reports cannot stand in for this run.
      for (const path of ['mysql-image-verify/results.json', 'mysql-image-verify/mysql.json',
        'application-image-verify/results.json', 'application-image-verify/backend.json',
        'application-image-verify/admin.json', 'application-image-verify/frontend.json']) {
        rmSync(resolve('output', path), { force: true })
      }
      for (const script of ['verify-mysql-image.mjs', 'verify-application-images.mjs']) {
        steps.push({ name: script, command: process.execPath, args: [`scripts/${script}`, '--prepared-db', ...(retainImages ? ['--retain-images'] : [])], timeoutMs: 540000 })
      }
    }
    const result = await runSequence(steps, { signal: controller.signal, onStart: name => console.log(name) })
    for (const stage of result.results) console.log(`${stage.name}: ${stage.reason}, exit=${stage.exitCode}`)
    if (result.notRun.length) console.error('Image audits not run: ' + result.notRun.join(', '))
    process.exitCode = result.exitCode
  } finally {
    const cleanup = spawnSync('docker', ['rm', '-f', container], { encoding: 'utf8', timeout: 10000 })
    if (cleanup.status !== 0 && !(cleanup.stderr ?? '').includes('No such container')) {
      console.error('Could not remove the database preparation container')
      process.exitCode = 1
    }
    process.off('SIGINT', cancel)
    process.off('SIGTERM', cancel)
    release()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2))
