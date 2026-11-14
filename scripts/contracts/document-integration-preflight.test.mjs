import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

test('DI-SC-14/15 candidate preflight failure creates no temporary credential file', () => {
  const parent = resolve('output')
  mkdirSync(parent, { recursive: true })
  const directory = mkdtempSync(join(parent, 'document-preflight-'))
  try {
    const candidate = join(directory, 'docs/contracts/document-parser/migration')
    mkdirSync(candidate, { recursive: true })
    mkdirSync(join(directory, 'backend/internal/migrations'), { recursive: true })
    const contract = JSON.parse(readFileSync('docs/contracts/document-integration.json', 'utf8'))
    contract.migration.files['000006_documents.up.sql'] = '0'.repeat(64)
    writeFileSync(join(directory, 'docs/contracts/document-integration.json'), JSON.stringify(contract))
    for (const name of ['000006_documents.up.sql', '000006_documents.down.sql']) copyFileSync('docs/contracts/document-parser/migration/' + name, join(candidate, name))
    copyFileSync('backend/internal/migrations/target.go', join(directory, 'backend/internal/migrations/target.go'))
    // Fail before any Docker/git operation; neither tool is made available to
    // the child. The real committed probe CLI handles these candidate bytes.
    const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.toLowerCase() !== 'path'))
    environment.PATH = ''
    const result = spawnSync(process.execPath, [resolve('scripts/check-document-storage-contract.mjs')], {
      cwd: directory, env: environment, encoding: 'utf8', timeout: 30000,
    })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /ERR_ASSERTION/)
    const secretDirectory = join(directory, 'output/document-storage-contract')
    const files = existsSync(secretDirectory) ? readdirSync(secretDirectory).filter(name => name.endsWith('.env')) : []
    assert.deepEqual(files, [], 'Rejected candidate must not leave credentials on disk')
  } finally {
    // This freshly created test directory is the only recursive removal target.
    assert.equal(dirname(resolve(directory)), parent)
    assert.ok(basename(directory).startsWith('document-preflight-'))
    rmSync(directory, { recursive: true, force: true })
  }
})
