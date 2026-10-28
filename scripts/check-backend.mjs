import { spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
const local = spawnSync('go', ['version'], { encoding: 'utf8' })
if (!local.error && local.status === 0 && local.stdout.includes('go1.27.3 ')) {
  mkdirSync('output', { recursive: true })
  for (const args of [['vet', './...'], ['test', '-shuffle=on', './...'],
    ['build', '-trimpath', '-buildvcs=false', '-o', resolve('output/check-server' + (process.platform === 'win32' ? '.exe' : '')), './cmd/server']]) {
    run('go', args, { cwd: resolve('backend') })
  }
} else {
  const { goImage } = JSON.parse(readFileSync('scripts/toolchain.json', 'utf8'))
  run('docker', ['run', '--rm', '--network', 'none',
    '-e', 'GOTOOLCHAIN=local', '-v', resolve('backend') + ':/src:ro',
    '-v', 'campus-claw-plus-go-cache:/root/.cache/go-build', '-w', '/src', goImage,
    'sh', '-c', 'go vet ./... && go test -shuffle=on ./... && CGO_ENABLED=0 go build -trimpath -buildvcs=false -o /tmp/server ./cmd/server'])
}
