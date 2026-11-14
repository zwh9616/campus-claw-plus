import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// DI-SC-03..07/10/14. Operate only CIDs with this disposable Compose project
// label. No host database/parser ports and no public Document API activation.
export async function verifyDocumentRuntime({ id, directory, compose, run, client, goArgs, goImage, evidence }) {
  const own = service => {
    const cid = compose('DI resolve own '+service, ['ps','--all','-q',service]).trim()
    assert.match(cid,/^[a-f0-9]{64}$/)
    const info = JSON.parse(run('DI inspect own '+service,['inspect',cid]))[0]
    assert.equal(info.Config.Labels['com.docker.compose.project'],id)
    return info
  }
  const parser=own('document-parser'), backend=own('backend')
  const parserImage=parser.Image, backendImage=backend.Image
  const net=id+'_document_parse'
  assert.deepEqual(Object.keys(parser.NetworkSettings.Networks),[net])
  assert.equal(parser.Config.User,'65532:65532');assert.equal(parser.HostConfig.ReadonlyRootfs,true)
  assert.equal(parser.HostConfig.Memory,512*1024*1024);assert.equal(parser.HostConfig.MemorySwap,512*1024*1024)
  assert.equal(parser.HostConfig.NanoCpus,1e9);assert.equal(parser.HostConfig.PidsLimit,32)
  assert.deepEqual(parser.HostConfig.CapDrop,['ALL']);assert.ok(parser.HostConfig.SecurityOpt.includes('no-new-privileges:true'))
  assert.ok(parser.HostConfig.Tmpfs['/tmp'].includes('size=64m'))
  assert.deepEqual(parser.HostConfig.PortBindings,{})
  const names=parser.Config.Env.map(x=>x.split('=')[0])
  assert.deepEqual(names.filter(x=>/^(?:DOCUMENT_|MYSQL_|AUTH_|MODEL_|HTTP_PROXY$|HTTPS_PROXY$)/i.test(x)),['DOCUMENT_PARSER_TOKEN'])
  const network=JSON.parse(run('DI inspect actual parser-only network',['network','inspect',net]))[0]
  assert.equal(network.Internal,true)
  assert.deepEqual(Object.keys(network.Containers).sort(),[parser.Id,backend.Id].sort())
  compose('DI parser cannot route to public network',['exec','-T','document-parser','python','-B','-I','-c',
    'import socket,sys\ntry:\n s=socket.create_connection(("1.1.1.1",443),timeout=.2);s.close()\nexcept OSError: sys.exit(0)\nsys.exit(1)'])
  evidence.push({label:'DI-SC-14 actual private service isolation',exit_code:0,internal:true,network_members:['backend','document-parser'],host_ports:false,database_secrets:false,egress:false,nonroot:true,readonly:true,memory_bytes:536870912,cpus:1,pids:32,parser_image:parserImage,backend_image:backendImage})
  const path=resolve(directory,'document-worker-proof.json')
  // Host owns the private0600 file even when a test process runs as root.
  writeFileSync(path,'{}',{flag:'wx',mode:0o600})
  const stage=name=>run('DI worker '+name,[...goArgs,'--network',id+'_data','-e','DOCUMENT_WORKER_STAGE='+name,
    '--mount',`type=bind,source=${directory},target=/fixtures`,
    '--mount',`type=bind,source=${resolve('document-parser/testdata/acceptance-v1')},target=/corpus,readonly`,
    goImage,'go','test','-count=1','-tags=integration,documentruntime','-run=^TestDocumentProductionWorker$','-timeout=120s','-v','./internal/integration/wiring'],{timeout:145000})
  stage('corpus')
  compose('DI stop actual parser only',['stop','--timeout','15','document-parser'])
  // Preserve all original HTTPS assertions while the parser is really absent.
  client('persist','DI-SC-14 parser outage preserves original HTTPS health TXT and pending tasks')
  compose('DI recreate backend without parser dependency',['up','-d','--no-deps','--force-recreate','--wait','--wait-timeout','45','backend'])
  assert.equal(own('backend').Image,backendImage)
  stage('outage-enqueue')
  compose('DI restore actual private parser',['up','-d','--wait','--wait-timeout','45','document-parser'])
  assert.equal(own('document-parser').Image,parserImage)
  stage('outage-retry')
  compose('DI stop real worker before durable enqueue',['stop','--timeout','15','backend'])
  stage('restart-enqueue')
  compose('DI recreate actual worker on retained database',['up','-d','--no-deps','--force-recreate','--wait','--wait-timeout','45','backend'])
  assert.equal(own('backend').Image,backendImage)
  stage('restart-verify')
  let paused=false
  try {
    const currentParser=own('document-parser')
    run('DI pause own parser during actual claim',['pause',currentParser.Id]);paused=true
    stage('kill-enqueue')
    const currentBackend=own('backend')
    run('DI SIGKILL actual leased worker',['kill','--signal','KILL',currentBackend.Id])
    const killed=own('backend');assert.equal(killed.State.Running,false);assert.equal(killed.State.ExitCode,137)
    stage('kill-expire')
    run('DI unpause own parser',['unpause',currentParser.Id]);paused=false
    // Discard the old in-flight RPC before the new lease; no fake parser result.
    compose('DI restart private parser after killed request',['restart','--timeout','15','document-parser'])
    compose('DI wait for restarted private probe',['up','-d','--wait','--wait-timeout','45','document-parser'])
    compose('DI recover worker with retained durable lease',['up','-d','--no-deps','--wait','--wait-timeout','45','backend'])
    stage('kill-verify')
  } finally {
    if(paused) run('DI failure cleanup unpauses own parser',['unpause',parser.Id])
  }
  assert.equal(own('backend').Image,backendImage);assert.equal(own('document-parser').Image,parserImage)
  compose('DI parser temporary request files reclaimed',['exec','-T','document-parser','python','-B','-I','-c',
    'import glob;assert not glob.glob("/tmp/di-rpc-*")'])
  const proof=JSON.parse(readFileSync(path,'utf8'))
  const summary={label:'DI-SC-03..07/10/14 actual default worker persisted corpus and recovery',exit_code:0,
    scope:'trusted internal fixture insertion; six public Document HTTP operations remain frozen',
    parser_image:parserImage,backend_image:backendImage,forced_test_lease_expiry:true,actual_worker_sigkill:true,
    proof:Object.fromEntries(Object.entries(proof).filter(([k])=>!k.endsWith('_accepted')))}
  evidence.push(summary)
  // Called after the original real MySQL stop/restore regression. A successful
  // old health response cannot stand in for a worker that actually resumed.
  return () => {
    stage('database-verify')
    summary.proof=Object.fromEntries(Object.entries(JSON.parse(readFileSync(path,'utf8'))).filter(([k])=>!k.endsWith('_accepted')))
  }
}
