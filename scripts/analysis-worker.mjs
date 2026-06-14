const baseUrl = (process.env.INNEROS_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const extractConcurrency = Math.max(1, Math.min(32, Number(process.env.ANALYSIS_EXTRACT_CONCURRENCY) || 16));
const memoryConcurrency = Math.max(1, Math.min(8, Number(process.env.ANALYSIS_MEMORY_CONCURRENCY) || 4));
const embeddingConcurrency = Math.max(1, Math.min(12, Number(process.env.ANALYSIS_EMBEDDING_CONCURRENCY) || 6));
const batchSize = Math.max(10, Math.min(500, Number(process.env.ANALYSIS_BATCH_SIZE) || 100));
const pauseMs = Math.max(250, Number(process.env.ANALYSIS_WORKER_PAUSE_MS) || 1000);

let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

async function runBatch() {
  const response = await fetch(`${baseUrl}/api/analysis-jobs/backfill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enqueue_limit: batchSize * 2,
      extract_limit: batchSize,
      extract_concurrency: extractConcurrency,
      memory_limit: batchSize,
      memory_concurrency: memoryConcurrency,
      embedding_limit: batchSize,
      embedding_concurrency: embeddingConcurrency,
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Worker request failed: ${response.status}`);
  return body;
}

console.log(
  `[analysis-worker] ${baseUrl} extract=${extractConcurrency} embedding=${embeddingConcurrency} memory=${memoryConcurrency} batch=${batchSize}`,
);

while (!stopping) {
  try {
    const result = await runBatch();
    const stats = result.stats;
    console.log(JSON.stringify({
      extract: result.processed.extract,
      memory: result.processed.memory,
      embedding: result.processed.embedding,
      pending_jobs: stats.jobs_pending,
      failed_jobs: stats.jobs_failed,
      dead_jobs: stats.jobs_dead,
      memos_done: stats.memos_done,
      memories_processed: stats.memos_memory_processed,
      memos_embedded: stats.memos_embedded,
      memos_total: stats.memos_total,
    }));

    const remainingMemos = stats.memos_pending + stats.memos_analyzing + stats.memos_failed;
    const missingMemory = Math.max(0, stats.memos_done - stats.memos_memory_processed);
    const missingEmbeddings = Math.max(0, stats.memos_done - stats.memos_embedded);
    if (remainingMemos === 0 && missingMemory === 0 && missingEmbeddings === 0 && stats.jobs_pending === 0 && stats.jobs_running === 0) {
      console.log('[analysis-worker] backfill complete');
      break;
    }
  } catch (error) {
    console.error('[analysis-worker]', error);
  }
  await new Promise((resolve) => setTimeout(resolve, pauseMs));
}
