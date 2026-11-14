import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { runSequence } from './gate-runner.mjs'
import { runtimeSteps, evidencePaths, loadBatchInputs, validateBatch, validateRuntimeEvidence, sha256, retainedImageTags } from './service-batches.mjs'
import { validateDocumentMigrationEvidence } from './document-migration-evidence.mjs'
import { validateDocumentRuntimeEvidence } from './document-runtime-evidence.mjs'

const directory = 'output/service-batches'
mkdirSync(directory, { recursive: true })
rmSync(directory + '/results.json', { force: true })
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim()
const source = () => ({ commit: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain', '--untracked-files=no']) !== '',
  // Record every tracked input, including staged edits; runtime secrets are ignored and never read.
  fingerprint: sha256(git(['ls-files', '-z']).split('\0').filter(Boolean).sort().map(path => path + ':' + sha256(readFileSync(path))).join('\n')) })
const started = Date.now()
const controller = new AbortController()
const cancel = () => controller.abort()
process.on('SIGINT', cancel)
process.on('SIGTERM', cancel)
let output = { time: new Date(started).toISOString(), exit_code: 1, scope: 'DO-SC-11..13 five-service batch with private document worker; assignment executor unbound, six Document HTTP operations frozen; no independent reviewer or full10B/C claim' }
try {
  const before = source()
  output.source = before
  const inventory = validateBatch(loadBatchInputs())
  const stages = await runSequence(runtimeSteps.map((path, i) => ({ name: path, command: process.execPath,
    args: [path, ...(i === 0 ? ['--retain-images'] : i === 1 ? ['--audited-images'] : [])], timeoutMs: 590000 })),
    { signal: controller.signal, onStart: name => console.log('Batch verify: ' + name) })
  output = { ...output, inventory, stages }
  if (stages.exitCode !== 0) throw new Error('Original runtime verification failed; later stages were not run')
  if (JSON.stringify(before) !== JSON.stringify(source())) throw new Error('Source changed during runtime verification')
  const bytes = Object.fromEntries(evidencePaths.map(path => [path, readFileSync(path)]))
  const reports = Object.fromEntries(evidencePaths.map(path => [path, JSON.parse(bytes[path])]))
  output.images = validateRuntimeEvidence(reports, started, Date.now(), inventory)
  output.document_migration6 = validateDocumentMigrationEvidence(reports['output/identity/results.json'])
  output.document_worker = validateDocumentRuntimeEvidence(reports['output/identity-wiring/results.json'],output.images)
  output.evidence = evidencePaths.map(path => ({ path, sha256: sha256(bytes[path]) }))
  // DI-SC-14: retain all production validation, including the exact fifth
  // service artifact, and separately repeat standalone component/scan tests.
  const candidate = spawnSync(process.execPath, ['scripts/check-document-parser.mjs', '--scan'],
    { stdio: 'inherit', timeout: 390000 })
  if (candidate.status !== 0) throw new Error('Offline parser candidate scan failed after current-service validation')
  const candidatePath = 'output/document-parser/scan/results.json'
  const candidateBytes = readFileSync(candidatePath)
  const candidateReport = JSON.parse(candidateBytes)
  if (candidateReport.exit_code !== 0 || candidateReport.source.commit !== before.commit ||
      Date.parse(candidateReport.time) < started || candidateReport.cleanup.some(c => !c.ok) ||
      candidateReport.tests?.clear_documents !== 40 || candidateReport.tests?.negative_classes !== 25) {
    throw new Error('Offline candidate evidence is not successful and current to this verification')
  }
  output.offline_candidate = { path: candidatePath, sha256: sha256(candidateBytes), image_id: candidateReport.image_id }
  output.exit_code = 0
  console.log('DO-SC-11..13: current-batch real images, default HTTPS, database failure/recovery and isolation evidence passed; Ge review pending.')
} catch (error) {
  output.error = error.message
  console.error(error.message)
} finally {
  try {
    const reports = Object.fromEntries(evidencePaths.slice(0, 2).map(path => {
      try { return [path, JSON.parse(readFileSync(path))] } catch { return [path, null] }
    }))
    output.cleanup = retainedImageTags(reports, started).map(tag => {
      const result = spawnSync('docker', ['image', 'rm', tag], { encoding: 'utf8', timeout: 30000 })
      const ok = result.status === 0 || (result.stderr ?? '').includes('No such image')
      if (!ok) output.exit_code = 1
      return { tag, exit_code: result.status, ok }
    })
  } catch (error) { output.exit_code = 1; output.cleanup_error = error.message }
  output.finished_at = new Date().toISOString()
  writeFileSync(directory + '/results.json', JSON.stringify(output, null, 2) + '\n')
  process.off('SIGINT', cancel)
  process.off('SIGTERM', cancel)
}
process.exitCode = output.exit_code
