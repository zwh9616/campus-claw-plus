import { loadBatchInputs, validateBatch } from './service-batches.mjs'

const batch = validateBatch(loadBatchInputs())
console.log(`DO-SC-11/13: ${batch.batch}, ${batch.sources.length} registered services; pinned image sources and <=3s probes. Runtime and Ge review remain separate.`)
