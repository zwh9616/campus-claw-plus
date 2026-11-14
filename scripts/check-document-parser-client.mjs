// DI-SC-14: real Go -> private HTTP -> Python child, exclusively owned network.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes, createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

assert.equal(process.argv.length, 4, 'Expected --image immutable-image-id')
assert.equal(process.argv[2], '--image')
const image = process.argv[3]
assert.match(image, /^sha256:[a-f0-9]{64}$/)
const toolchain = JSON.parse(readFileSync('scripts/toolchain.json'))
const id = 'campus-parser-client-' + randomBytes(6).toString('hex')
const directory = resolve('output', id)
const helper = resolve('backend/output', id)
mkdirSync(directory, { recursive: true }); mkdirSync(helper, { recursive: true })
const secret = resolve(directory, 'credentials.env')
const probeCode = `package main
import("context";"encoding/base64";"encoding/json";"fmt";"os";"strings";"time";"github.com/zwh9616/campus-claw-plus/backend/internal/documentparser")
type entry struct{File string;Format string;Gold []struct{Kind string;Unit int;Text string}}
func main(){if err:=run();err!=nil{fmt.Fprintln(os.Stderr,"private client probe failed");os.Exit(1)}}
func run()error{
 c,e:=documentparser.New(documentparser.Origin,os.Getenv("DOCUMENT_PARSER_TOKEN"));if e!=nil{return e};defer c.Close()
 if len(os.Args)>1&&os.Args[1]=="unavailable"{if c.Healthy(context.Background()){return fmt.Errorf("false health")};r:=c.Parse(context.Background(),"pdf",[]byte("source"));if r.FailureReason!="worker_interrupted"{return fmt.Errorf("outage mapping")};return json.NewEncoder(os.Stdout).Encode(map[string]any{"unavailable":true,"health":false,"reason":r.FailureReason})}
 ready:=false;for i:=0;i<20;i++{if c.Healthy(context.Background()){ready=true;break};time.Sleep(50*time.Millisecond)};if !ready{return fmt.Errorf("startup health")}
 raw,e:=os.ReadFile("/fixtures/manifest.json");if e!=nil{return e};var set struct{Cases []entry};if e=json.Unmarshal(raw,&set);e!=nil{return e};if len(set.Cases)!=40{return fmt.Errorf("corpus count")}
 rows:=[]map[string]any{};locations:=0
 for _,x:=range set.Cases{source,e:=os.ReadFile("/fixtures/"+x.File);if e!=nil{return e};r:=c.Parse(context.Background(),x.Format,source);if r.Status!="ready"{return fmt.Errorf("real parse")};gold:=[]struct{Kind string;Unit int;Text string}{};for _,g:=range x.Gold{if strings.TrimSpace(g.Text)!=""{gold=append(gold,g)}};if len(gold)!=len(r.Locations){return fmt.Errorf("gold locations")};for i,l:=range r.Locations{if l.Kind!=gold[i].Kind||l.Unit!=gold[i].Unit{return fmt.Errorf("source unit")}};locations+=len(r.Locations);rows=append(rows,map[string]any{"file":x.File,"format":x.Format,"status":r.Status,"locations":len(r.Locations)})}
 if locations!=195{return fmt.Errorf("location total")}
 wrong,e:=documentparser.New(documentparser.Origin,base64.RawURLEncoding.EncodeToString(make([]byte,32)));if e!=nil{return e};defer wrong.Close();if wrong.Healthy(context.Background())||wrong.Parse(context.Background(),"pdf",[]byte("x")).FailureReason!="internal_failure"{return fmt.Errorf("wrong auth accepted")}
 return json.NewEncoder(os.Stdout).Encode(map[string]any{"documents":rows,"locations":locations,"wrong_auth_rejected":true})}
`
writeFileSync(resolve(helper, 'main.go'), probeCode)
const results = []
let report = { time: new Date().toISOString(), image_id: image, scope: 'standalone real client/server interoperability probe; default service, persistence and public HTTP acceptance are validated separately', exit_code: 1 }
let credential = ''
function run(label, args, timeout = 180000) {
  const child = spawnSync('docker', args, { encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024 })
  results.push({ label, exit_code: child.status, stdout: child.stdout ?? '', stderr: child.stderr ?? '', error: child.error?.message })
  if (child.status !== 0) throw new Error('Private client step failed: ' + label)
  return child.stdout
}
try {
  // Credentials are created only inside the protected cleanup scope, never logged.
  const token = randomBytes(32).toString('base64url')
  credential = token
  writeFileSync(secret, 'DOCUMENT_PARSER_TOKEN=' + token + '\n', { mode: 0o600 })
  run('compile actual Go client probe', ['run', '--rm', '--name', id + '-build', '--label', 'campus.client-run=' + id, '--network', 'none', '-e', 'GOTOOLCHAIN=local', '-e', 'CGO_ENABLED=0',
    '--mount', `type=bind,source=${resolve('backend')},target=/src,readonly`,
    '--mount', `type=bind,source=${helper},target=/out`, '-v', 'campus-claw-plus-go-cache:/root/.cache/go-build', '-w', '/src', toolchain.goImage,
    'go', 'build', '-trimpath', '-buildvcs=false', '-o', '/out/probe', './output/' + id])
  run('create exclusive internal parser network', ['network', 'create', '--internal', '--label', 'campus.client-run=' + id, id])
  run('start actual private server', ['run', '-d', '--rm', '--name', id + '-server', '--label', 'campus.client-run=' + id, '--network', id, '--network-alias', 'document-parser',
    '--user', '65532:65532', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '512m', '--memory-swap', '512m', '--cpus', '1', '--pids-limit', '32',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', '--env-file', secret, '--entrypoint', 'python', image, '-B', '-I', '/app/server.py'])
  const network = JSON.parse(run('inspect actual internal isolation', ['network', 'inspect', '--format', '{{json .Internal}}', id]))
  assert.equal(network, true)
  const bindings = JSON.parse(run('inspect no published parser port', ['inspect', '--format', '{{json .HostConfig.PortBindings}}', id + '-server']))
  assert.ok(bindings === null || Object.keys(bindings).length === 0)
  const args = ['run', '--rm', '--name', id + '-probe', '--label', 'campus.client-run=' + id, '--network', id, '--user', '65532:65532', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--memory', '512m', '--memory-swap', '512m', '--cpus', '1', '--pids-limit', '32', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', '--env-file', secret,
    '--mount', `type=bind,source=${resolve(helper, 'probe')},target=/probe,readonly`,
    '--mount', `type=bind,source=${resolve('document-parser/testdata/acceptance-v1')},target=/fixtures,readonly`, '--entrypoint', '/probe', toolchain.goImage]
  const actual = JSON.parse(run('40 real Go HTTP Python extractions', args))
  assert.equal(actual.documents.length, 40); assert.equal(actual.locations, 195); assert.equal(actual.wrong_auth_rejected, true)
  assert.ok(actual.documents.every(x => x.status === 'ready'))
  const logs = run('read controlled private logs', ['logs', id + '-server'])
  assert.ok(!logs.includes(token), 'Generated parser credential leaked into logs')
  for (const line of logs.trim().split('\n')) {
    const value = JSON.parse(line)
    assert.deepEqual(Object.keys(value).sort(), ['duration_ms', 'path', 'request_id', 'status'])
  }
  run('stop only owned parser', ['rm', '-f', id + '-server'])
  const outage = JSON.parse(run('actual parser disappearance', [...args, 'unavailable']))
  assert.equal(outage.unavailable, true); assert.equal(outage.reason, 'worker_interrupted'); assert.equal(outage.health, false)
  report = { ...report, actual, outage, network_internal: network, no_host_ports: true, safe_logs: true, probe_sha256: createHash('sha256').update(readFileSync(resolve(helper, 'probe'))).digest('hex'), exit_code: 0 }
} catch (error) {
  report.error = error.message
} finally {
  report.cleanup = []
  for (const [kind, args] of [['probe', ['rm', '-f', id + '-probe']], ['server', ['rm', '-f', id + '-server']], ['build', ['rm', '-f', id + '-build']], ['network', ['network', 'rm', id]]]) {
    const inspect = spawnSync('docker', kind === 'network' ? ['network', 'inspect', '--format', '{{json .Labels}}', id] : ['inspect', '--format', '{{json .Config.Labels}}', id + '-' + kind], { encoding: 'utf8', timeout: 10000 })
    if (inspect.status !== 0 && /No such (container|network|object)|network .* not found/i.test(inspect.stderr ?? '')) {
      report.cleanup.push({ kind, ok: true, already_removed: true }); continue
    }
    let owned = false
    try { owned = inspect.status === 0 && JSON.parse(inspect.stdout)?.['campus.client-run'] === id } catch {}
    if (!owned) { report.cleanup.push({ kind, ok: false, ownership_unconfirmed: true }); report.exit_code = 1; continue }
    const child = spawnSync('docker', args, { encoding: 'utf8', timeout: 30000 })
    const ok = child.status === 0 || /No such (container|network)/i.test(child.stderr ?? '') || /network .* not found/i.test(child.stderr ?? '')
    report.cleanup.push({ kind, ok })
    if (!ok) report.exit_code = 1
  }
  if (existsSync(secret)) unlinkSync(secret)
  report.secret_file_removed = !existsSync(secret)
  report.finished_at = new Date().toISOString()
  report.results = results.map(item => ({ ...item, stdout: credential ? item.stdout.replaceAll(credential, '[redacted-test-credential]') : item.stdout, stderr: credential ? item.stderr.replaceAll(credential, '[redacted-test-credential]') : item.stderr }))
  writeFileSync(resolve(directory, 'results.json'), JSON.stringify(report, null, 2) + '\n')
}
console.log(JSON.stringify(report))
process.exitCode = report.exit_code
