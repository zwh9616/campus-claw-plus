import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const version = '8.30.1'
const windows = process.platform === 'win32'
if (!windows && process.platform !== 'linux') throw new Error('Use Gitleaks 8.30.1 manually on this operating system')
if (process.arch !== 'x64') throw new Error('Use a matching Gitleaks 8.30.1 binary on this architecture')
const asset = `gitleaks_${version}_${windows ? 'windows_x64.zip' : 'linux_x64.tar.gz'}`
const checksum = windows ? 'd29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e'
  : '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'
const directory = resolve('output/tools/gitleaks-' + version)
const binary = resolve(directory, windows ? 'gitleaks.exe' : 'gitleaks')
mkdirSync(directory, { recursive: true })
mkdirSync('output/verification', { recursive: true })
if (!existsSync(binary)) {
  const response = await fetch(`https://github.com/gitleaks/gitleaks/releases/download/v${version}/${asset}`,
    { signal: AbortSignal.timeout(120000) })
  if (!response.ok) throw new Error('Unable to download official Gitleaks release')
  const bytes = Buffer.from(await response.arrayBuffer())
  if (createHash('sha256').update(bytes).digest('hex') !== checksum) throw new Error('Gitleaks checksum mismatch')
  const archive = resolve('output/tools/' + asset)
  writeFileSync(archive, bytes)
  let result
  if (windows) {
    const quote = value => "'" + value.replaceAll("'", "''") + "'"
    result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Expand-Archive -LiteralPath ' + quote(archive) + ' -DestinationPath ' + quote(directory) + ' -Force'],
      { stdio: 'inherit' })
  } else {
    result = spawnSync('tar', ['-xzf', archive, '-C', directory], { stdio: 'inherit' })
  }
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
for (const args of [
  ['git', '.', '--log-opts=--all', '--report-path=output/verification/secrets-history.json'],
  ['stdin', '--report-path=output/verification/secrets-staged.json'],
]) {
  const options = { stdio: ['pipe', 'inherit', 'inherit'] }
  if (args[0] === 'stdin') {
    const staged = spawnSync('git', ['diff', '--cached', '--no-ext-diff'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    if (staged.status !== 0) process.exit(staged.status ?? 1)
    options.input = staged.stdout
  }
  const scan = spawnSync(binary, [...args, '--redact=100', '--no-banner'], options)
  if (scan.error) throw scan.error
  if (scan.status !== 0) process.exit(scan.status ?? 1)
}
console.log('Full-history and staged-content secret scans passed.')
