import test from 'node:test'
import assert from 'node:assert/strict'
import{documentWorkerStages,documentWorkerSummary,documentIsolation,documentOutage,validateDocumentRuntimeEvidence}from'./document-runtime-evidence.mjs'
const fixture=()=>{
 const images=['backend','document-parser'].map((service,i)=>({service,image_id:'sha256:'+String(i+1).repeat(64)}))
 const ids={backend_image:images[0].image_id,parser_image:images[1].image_id}
 const results=documentWorkerStages.map(name=>({label:'DI worker '+name,exit_code:0,output:`actual default worker durable stage passed: ${name}\n--- PASS: TestDocumentProductionWorker (1.0s)`}))
 results.splice(results.length-1,0,{label:'stop database only',exit_code:0},{label:'restore database',exit_code:0})
 results.push({label:documentOutage,exit_code:0,output:'durable 202 and genuine pending persistence passed'},
  {label:documentIsolation,exit_code:0,...ids,internal:true,nonroot:true,readonly:true,host_ports:false,database_secrets:false,egress:false,network_members:['backend','document-parser'],memory_bytes:536870912,cpus:1,pids:32},
  {label:documentWorkerSummary,exit_code:0,...ids,scope:'trusted fixture; six public Document HTTP operations remain frozen',forced_test_lease_expiry:true,actual_worker_sigkill:true,proof:{
   corpus:{documents:40,locations:195,chunks:195,persisted_gold_text:true,exact_quote_codepoints:true,original_202_replay:true},
   ...Object.fromEntries(['outage-enqueue','restart-enqueue','kill-enqueue','kill-expire'].map(x=>[x,true])),
   ...Object.fromEntries([['outage-retry',2],['restart-verify',1],['kill-verify',2],['database-verify',1]].map(([x,attempts])=>[x,{attempts,locations:1,chunks:1,original_202_replay:true}]))}})
 return{report:{results},images}
}
test('DI-SC-14 actual persisted corpus and all recovery stages require full evidence',()=>{const x=fixture();assert.equal(validateDocumentRuntimeEvidence(x.report,x.images).locations,195)})
test('DI-SC-07/10 skip/fail/duplicate/out-of-order phases and success text cannot substitute for real worker execution',()=>{
 for(const name of documentWorkerStages)for(const mutate of [r=>r.results.splice(r.results.findIndex(x=>x.label==='DI worker '+name),1),r=>r.results.push(r.results.find(x=>x.label==='DI worker '+name)),r=>r.results.find(x=>x.label==='DI worker '+name).exit_code=1,r=>r.results.find(x=>x.label==='DI worker '+name).output+='\n--- SKIP: TestDocumentProductionWorker (0.1s)',r=>r.results.find(x=>x.label==='DI worker '+name).output='passed']){const x=fixture();mutate(x.report);assert.throws(()=>validateDocumentRuntimeEvidence(x.report,x.images))}
 const x=fixture();x.report.results.reverse();assert.throws(()=>validateDocumentRuntimeEvidence(x.report,x.images))
})
test('DI-SC-03/14 wrong corpus, image, isolation or recovery attempt cannot pass',()=>{
 for(const mutate of [s=>s.proof.corpus.documents--,s=>s.proof.corpus.locations--,s=>s.proof.corpus.exact_quote_codepoints=false,s=>s.parser_image='another',s=>s.actual_worker_sigkill=false,s=>s.proof['kill-verify'].attempts=1,s=>s.proof['outage-retry'].original_202_replay=false,s=>s.proof['database-verify'].attempts=2]){const x=fixture();mutate(x.report.results.at(-1));assert.throws(()=>validateDocumentRuntimeEvidence(x.report,x.images))}
 for(const mutate of [s=>s.egress=true,s=>s.database_secrets=true,s=>s.network_members.push('mysql'),s=>s.memory_bytes++]){const x=fixture();mutate(x.report.results.at(-2));assert.throws(()=>validateDocumentRuntimeEvidence(x.report,x.images))}
})
