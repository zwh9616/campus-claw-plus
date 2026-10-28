import { access, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

for (const file of ['AGENTS.md', ...['product', 'backend', 'security', 'testing', 'deployment']
  .map(name => `docs/standards/${name}.md`),
  '.agents/skills/campus-add-tests/SKILL.md', '.agents/skills/campus-release-check/SKILL.md']) {
  await access(file)
}
const sample = (await readFile('.env.example', 'utf8')).trim()
if (sample !== 'HTTP_PORT=') throw new Error('.env.example must contain only HTTP_PORT=')
execFileSync('git', ['check-ignore', '-q', '.env'])
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' }).split('\0').filter(Boolean)
if (files.some(file => {
  const name = file.split('/').at(-1)
  return (name.startsWith('.env') && name !== '.env.example') || /\.(pem|key)$/.test(name)
})) throw new Error('Environment or private key files must not be committed')
console.log('Foundation: rule/skill entry points exist, sample keys are empty, .env is ignored.')
console.log('This check is separate from real authorization review and full-history secret scanning.')
