import assert from 'node:assert/strict'

export const documentWorkerStages=['corpus','outage-enqueue','outage-retry','restart-enqueue','restart-verify','kill-enqueue','kill-expire','kill-verify','database-verify']
export const documentWorkerSummary='DI-SC-03..07/10/14 actual default worker persisted corpus and recovery'
export const documentIsolation='DI-SC-14 actual private service isolation'
export const documentOutage='DI-SC-14 parser outage preserves original HTTPS health TXT and pending tasks'
export function validateDocumentRuntimeEvidence(report,images) {
  const one=label=>{const xs=report.results.filter(s=>s.label===label);assert.equal(xs.length,1,'Exactly one real runtime phase: '+label);assert.equal(xs[0].exit_code,0);return xs[0]}
  let previous=-1
  for(const name of documentWorkerStages){
    const row=one('DI worker '+name),index=report.results.indexOf(row);assert.ok(index>previous);previous=index
    assert.equal(typeof row.output,'string');assert.ok(!/^\s*--- (?:FAIL|SKIP):/m.test(row.output))
    assert.equal((row.output.match(/^--- PASS: TestDocumentProductionWorker \(\d+(?:\.\d+)?s\)$/gm)??[]).length,1)
    assert.ok(row.output.includes('actual default worker durable stage passed: '+name))
  }
  const outage=one(documentOutage);assert.ok(outage.output.includes('durable 202 and genuine pending persistence passed'))
  const isolation=one(documentIsolation),summary=one(documentWorkerSummary),p=summary.proof
  for(const row of [isolation,summary])for(const [service,field] of [['backend','backend_image'],['document-parser','parser_image']])assert.equal(row[field],images.find(x=>x.service===service)?.image_id)
  for(const key of ['internal','nonroot','readonly'])assert.equal(isolation[key],true)
  for(const key of ['host_ports','database_secrets','egress'])assert.equal(isolation[key],false)
  assert.deepEqual(isolation.network_members,['backend','document-parser'])
  assert.equal(isolation.memory_bytes,536870912);assert.equal(isolation.cpus,1);assert.equal(isolation.pids,32)
  assert.equal(summary.forced_test_lease_expiry,true);assert.equal(summary.actual_worker_sigkill,true)
  assert.equal(p.corpus.documents,40);assert.equal(p.corpus.locations,195);assert.ok(p.corpus.chunks>=195)
  for(const k of ['persisted_gold_text','exact_quote_codepoints','original_202_replay'])assert.equal(p.corpus[k],true)
  for(const k of ['outage-enqueue','restart-enqueue','kill-enqueue','kill-expire'])assert.equal(p[k],true)
  for(const [name,attempts]of [['outage-retry',2],['restart-verify',1],['kill-verify',2],['database-verify',1]]){
    assert.equal(p[name].attempts,attempts);assert.equal(p[name].original_202_replay,true);assert.ok(p[name].locations>0&&p[name].chunks>=p[name].locations)
  }
  const down=one('stop database only'),restore=one('restore database')
  assert.ok(report.results.indexOf(down)<report.results.indexOf(restore))
  assert.ok(report.results.indexOf(restore)<report.results.indexOf(one('DI worker database-verify')))
  assert.ok(summary.scope.includes('six public Document HTTP operations remain frozen'))
  return {stages:documentWorkerStages,documents:40,locations:195,chunks:p.corpus.chunks,actual_worker_sigkill:true,forced_test_lease_expiry:true,actual_database_recovery:true,public_document_http:'frozen',parser_image:summary.parser_image,backend_image:summary.backend_image}
}
