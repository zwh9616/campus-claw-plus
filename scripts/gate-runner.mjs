import { spawn } from 'node:child_process'
import { openSync, closeSync, writeFileSync, unlinkSync } from 'node:fs'

// DO-SC-04/05: no shell, fail fast, bound every stage and stop its process tree.
export function runStage(step, { signal, stdio = 'inherit', onStart = () => {} } = {}) {
  if (signal?.aborted) return Promise.resolve({ name: step.name, exitCode: 130, reason: 'cancelled' })
  return new Promise(resolve => {
    const started = performance.now()
    const child = spawn(step.command, step.args, { stdio, detached: process.platform !== 'win32' })
    let reason
    let escalation
    const stop = cause => {
      if (reason) return
      reason = cause
      if (!child.pid) return
      const kill = force => {
        try {
          if (process.platform === 'win32') {
            spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
          } else process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM')
        } catch (error) { if (error.code !== 'ESRCH') throw error }
      }
      kill(false)
      escalation = setTimeout(() => kill(true), 20000)
      escalation.unref()
    }
    const cancel = () => stop('cancelled')
    signal?.addEventListener('abort', cancel, { once: true })
    const timer = setTimeout(() => stop('timeout'), step.timeoutMs)
    child.once('spawn', () => { onStart(step.name); if (signal?.aborted) cancel() })
    let spawnError
    child.once('error', error => { spawnError = error.code ?? 'spawn_error' })
    child.once('close', (code, childSignal) => {
      clearTimeout(timer)
      clearTimeout(escalation)
      signal?.removeEventListener('abort', cancel)
      resolve({ name: step.name,
        exitCode: reason === 'timeout' ? 124 : reason === 'cancelled' ? 130 : code ?? 1,
        reason: reason ?? spawnError ?? (childSignal ? 'signal' : code === 0 ? 'passed' : 'failed'),
        signal: childSignal, durationMs: Math.round(performance.now() - started) })
    })
  })
}

export async function runSequence(steps, options = {}) {
  const results = []
  for (const step of steps) {
    const result = await runStage(step, options)
    results.push(result)
    if (result.exitCode !== 0) break
  }
  return { exitCode: results.at(-1)?.exitCode ?? 1, results,
    notRun: steps.slice(results.length).map(step => step.name) }
}

export function acquireLock(path) {
  let fd
  try { fd = openSync(path, 'wx') } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Gate lock exists: wait for the active gate; after a crash confirm it stopped before removing output/verification/gate.lock')
    throw error
  }
  writeFileSync(fd, String(process.pid))
  return () => { closeSync(fd); unlinkSync(path) }
}
