import { analyzeMemo } from '@/lib/ai/analyzer';
import { createHash } from 'crypto';
import {
  claimNextAnalysisJob,
  enqueueMemoryLink,
  enqueueMemoEmbedding,
  enqueueMemoAnalysis,
  markAnalysisJobFailed,
  markAnalysisJobSucceeded,
  recoverStaleAnalysisJobs,
  type AnalysisJob,
} from '@/lib/db/analysis-jobs';
import { getMemoById, replaceMemoChunks, updateMemo } from '@/lib/db/memos';
import { rebuildTopicsFromMemos } from '@/lib/db/topics';
import { linkMemoToMemory } from '@/lib/ai/memory-linker';
import {
  createEmbeddings,
  getEmbeddingVersion,
  isEmbeddingEnabled,
} from '@/lib/ai/retrieval-provider';

async function processMemoExtract(job: AnalysisJob): Promise<void> {
  const memo = getMemoById(job.entity_id);
  if (!memo) return;

  let payload: { content_hash?: string } = {};
  try {
    payload = JSON.parse(job.payload) as { content_hash?: string };
  } catch {
    // Invalid payload is handled using the entity id.
  }

  // An older queued job must not overwrite analysis for newer memo content.
  const currentHash = createHash('sha256').update(memo.plain_text).digest('hex');
  if (payload.content_hash && currentHash !== payload.content_hash) {
    enqueueMemoAnalysis(memo.id);
    return;
  }

  updateMemo(memo.id, { analysis_status: 'analyzing' });
  const result = await analyzeMemo(memo.plain_text, memo.user_id);
  updateMemo(memo.id, {
    ai_title: result.title,
    ai_summary: result.summary,
    ai_category: result.category,
    ai_topics: result.topics,
    ai_emotions: result.emotions,
    ai_people: result.people,
    ai_projects: result.projects,
    ai_actions: result.actions,
    ai_key_questions: result.key_questions,
    analysis_status: 'done',
  });
  if (isEmbeddingEnabled()) enqueueMemoEmbedding(memo.id, true);
  enqueueMemoryLink(memo.id, true);
}

async function processMemoEmbed(job: AnalysisJob): Promise<void> {
  if (!isEmbeddingEnabled()) return;
  const memo = getMemoById(job.entity_id);
  if (!memo) return;
  let payload: { content_hash?: string } = {};
  try {
    payload = JSON.parse(job.payload) as { content_hash?: string };
  } catch {
    // Invalid payload falls back to embedding the current memo.
  }
  const currentHash = createHash('sha256').update(memo.plain_text).digest('hex');
  if (payload.content_hash && currentHash !== payload.content_hash) {
    enqueueMemoEmbedding(memo.id);
    return;
  }
  const metadata = [
    memo.ai_title,
    memo.ai_summary,
    memo.ai_topics.join('、'),
    memo.ai_people.join('、'),
    memo.ai_projects.join('、'),
  ].filter(Boolean).join('\n');
  const chunkSize = 1200;
  const overlap = 180;
  const chunks: Array<{
    chunkIndex: number;
    startOffset: number;
    endOffset: number;
    content: string;
    embeddingInput: string;
  }> = [];
  for (
    let start = 0;
    start < memo.plain_text.length && chunks.length < 16;
    start += chunkSize - overlap
  ) {
    const text = memo.plain_text.slice(start, start + chunkSize).trim();
    if (!text) continue;
    chunks.push({
      chunkIndex: chunks.length,
      startOffset: start,
      endOffset: Math.min(memo.plain_text.length, start + chunkSize),
      content: text,
      embeddingInput: `${metadata}\n${text}`.slice(0, 1800),
    });
  }
  if (chunks.length === 0) {
    chunks.push({
      chunkIndex: 0,
      startOffset: 0,
      endOffset: memo.plain_text.length,
      content: memo.plain_text,
      embeddingInput: metadata || memo.plain_text,
    });
  }
  const vectors = await createEmbeddings(chunks.map((chunk) => chunk.embeddingInput));
  const version = getEmbeddingVersion();
  replaceMemoChunks(
    memo.id,
    version,
    chunks.map((chunk, index) => ({
      chunkIndex: chunk.chunkIndex,
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset,
      content: chunk.content,
      embedding: vectors[index],
    })),
  );
  updateMemo(memo.id, {
    embedding: JSON.stringify({
      version,
      chunk_count: chunks.length,
    }),
  });
}

async function processMemoryLink(job: AnalysisJob): Promise<void> {
  const memo = getMemoById(job.entity_id);
  if (!memo || memo.analysis_status !== 'done') return;
  await linkMemoToMemory(memo);
}

async function processJob(job: AnalysisJob): Promise<void> {
  if (job.type === 'memo.extract') {
    await processMemoExtract(job);
    return;
  }
  if (job.type === 'memory.link') {
    await processMemoryLink(job);
    return;
  }
  if (job.type === 'memo.embed') {
    await processMemoEmbed(job);
    return;
  }
  throw new Error(`不支持的分析任务类型: ${job.type}`);
}

export async function drainAnalysisJobs(limit = 10, concurrency = 4, userId?: string): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  recoverStaleAnalysisJobs();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const changedTopicUserIds = new Set<string>();

  const workerCount = Math.max(1, Math.min(concurrency, limit));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      if (processed >= limit) return;
      const job = claimNextAnalysisJob(undefined, userId);
      if (!job) return;
      processed += 1;
      try {
        await processJob(job);
        markAnalysisJobSucceeded(job.id);
        succeeded += 1;
        if (job.type === 'memo.extract') changedTopicUserIds.add(job.user_id);
      } catch (error) {
        if (job.type === 'memo.extract') {
          const memo = getMemoById(job.entity_id);
          if (memo) updateMemo(memo.id, { analysis_status: 'failed' });
        }
        markAnalysisJobFailed(job, error);
        failed += 1;
      }
    }
  });
  await Promise.all(workers);

  for (const changedUserId of changedTopicUserIds) rebuildTopicsFromMemos(changedUserId);
  return { processed, succeeded, failed };
}

async function drainJobType(
  type: AnalysisJob['type'],
  limit: number,
  concurrency: number,
  userId?: string,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, limit)) },
    async () => {
      while (processed < limit) {
        const job = claimNextAnalysisJob([type], userId);
        if (!job) return;
        processed += 1;
        try {
          await processJob(job);
          markAnalysisJobSucceeded(job.id);
          succeeded += 1;
        } catch (error) {
          if (job.type === 'memo.extract') {
            const memo = getMemoById(job.entity_id);
            if (memo) updateMemo(memo.id, { analysis_status: 'failed' });
          }
          markAnalysisJobFailed(job, error);
          failed += 1;
        }
      }
    },
  );
  await Promise.all(workers);
  return { processed, succeeded, failed };
}

export async function drainBackfillJobs(options: {
  extractLimit?: number;
  extractConcurrency?: number;
  memoryLimit?: number;
  memoryConcurrency?: number;
  embeddingLimit?: number;
  embeddingConcurrency?: number;
} = {}, userId?: string) {
  recoverStaleAnalysisJobs();
  const extract = await drainJobType(
    'memo.extract',
    Math.max(1, Math.min(500, options.extractLimit ?? 100)),
    Math.max(1, Math.min(8, options.extractConcurrency ?? 4)),
    userId,
  );
  if (extract.succeeded > 0) rebuildTopicsFromMemos(userId);
  const embedding = await drainJobType(
    'memo.embed',
    Math.max(1, Math.min(500, options.embeddingLimit ?? 100)),
    Math.max(1, Math.min(6, options.embeddingConcurrency ?? 3)),
    userId,
  );
  const memory = await drainJobType(
    'memory.link',
    Math.max(1, Math.min(500, options.memoryLimit ?? 100)),
    Math.max(1, Math.min(4, options.memoryConcurrency ?? 2)),
    userId,
  );
  return { extract, embedding, memory };
}
