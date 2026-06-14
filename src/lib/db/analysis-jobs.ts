import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { getDb } from './index';
import { getMemoById } from './memos';
import { getEmbeddingVersion } from '@/lib/ai/retrieval-provider';
import { MEMORY_PROMPT_VERSION } from '@/lib/ai/memory-linker';

export type AnalysisJobType = 'memo.extract' | 'memo.embed' | 'memory.link';
export type AnalysisJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'dead';

export interface AnalysisJob {
  id: string;
  type: AnalysisJobType;
  entity_id: string;
  idempotency_key: string;
  payload: string;
  status: AnalysisJobStatus;
  attempts: number;
  max_attempts: number;
  run_after: string;
  locked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AnalysisBackfillStats {
  memos_total: number;
  memos_pending: number;
  memos_analyzing: number;
  memos_failed: number;
  memos_done: number;
  memos_memory_processed: number;
  memos_embedded: number;
  jobs_pending: number;
  jobs_running: number;
  jobs_failed: number;
  jobs_dead: number;
  jobs_succeeded: number;
}

export function enqueueMemoAnalysis(
  memoId: string,
  force = false,
): AnalysisJob {
  const db = getDb();
  const memo = getMemoById(memoId);
  if (!memo) throw new Error(`无法为不存在的 Memo 创建分析任务: ${memoId}`);
  const contentHash = createHash('sha256').update(memo.plain_text).digest('hex');
  const now = new Date().toISOString();
  const idempotencyKey = force
    ? `memo.extract:${memoId}:${contentHash}:${uuidv4()}`
    : `memo.extract:${memoId}:${contentHash}`;
  const existing = db.prepare(
    'SELECT * FROM analysis_jobs WHERE idempotency_key = ?',
  ).get(idempotencyKey) as AnalysisJob | undefined;
  if (existing) return existing;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO analysis_jobs (
      id, type, entity_id, idempotency_key, payload, status,
      attempts, max_attempts, run_after, created_at, updated_at
    ) VALUES (?, 'memo.extract', ?, ?, ?, 'pending', 0, 3, ?, ?, ?)
  `).run(
    id,
    memoId,
    idempotencyKey,
    JSON.stringify({ memo_id: memoId, content_hash: contentHash }),
    now,
    now,
    now,
  );
  return getAnalysisJob(id)!;
}

export function enqueueMemoryLink(memoId: string, force = false): AnalysisJob {
  const db = getDb();
  const memo = getMemoById(memoId);
  if (!memo) throw new Error(`无法为不存在的 Memo 创建记忆任务: ${memoId}`);
  // Memory linkage is derived from the memo itself. Upstream AI fields may change
  // during extraction and must not create a second job for unchanged user content.
  const contentHash = createHash('sha256').update(memo.plain_text).digest('hex');
  const now = new Date().toISOString();
  const idempotencyKey = force
    ? `memory.link:${memoId}:${contentHash}:${uuidv4()}`
    : `memory.link:${memoId}:${contentHash}:${MEMORY_PROMPT_VERSION}`;
  const existing = db.prepare(
    'SELECT * FROM analysis_jobs WHERE idempotency_key = ?',
  ).get(idempotencyKey) as AnalysisJob | undefined;
  if (existing) return existing;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO analysis_jobs (
      id, type, entity_id, idempotency_key, payload, status,
      attempts, max_attempts, run_after, created_at, updated_at
    ) VALUES (?, 'memory.link', ?, ?, ?, 'pending', 0, 3, ?, ?, ?)
  `).run(
    id,
    memoId,
    idempotencyKey,
    JSON.stringify({ memo_id: memoId, content_hash: contentHash, prompt_version: MEMORY_PROMPT_VERSION }),
    now,
    now,
    now,
  );
  return getAnalysisJob(id)!;
}

export function enqueueMemoEmbedding(memoId: string, force = false): AnalysisJob {
  const db = getDb();
  const memo = getMemoById(memoId);
  if (!memo) throw new Error(`无法为不存在的 Memo 创建向量任务: ${memoId}`);
  const contentHash = createHash('sha256').update(memo.plain_text).digest('hex');
  const version = getEmbeddingVersion();
  const now = new Date().toISOString();
  const idempotencyKey = force
    ? `memo.embed:${memoId}:${contentHash}:${version}:${uuidv4()}`
    : `memo.embed:${memoId}:${contentHash}:${version}`;
  const existing = db.prepare(
    'SELECT * FROM analysis_jobs WHERE idempotency_key = ?',
  ).get(idempotencyKey) as AnalysisJob | undefined;
  if (existing) return existing;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO analysis_jobs (
      id, type, entity_id, idempotency_key, payload, status,
      attempts, max_attempts, run_after, created_at, updated_at
    ) VALUES (?, 'memo.embed', ?, ?, ?, 'pending', 0, 3, ?, ?, ?)
  `).run(
    id,
    memoId,
    idempotencyKey,
    JSON.stringify({ memo_id: memoId, content_hash: contentHash, embedding_version: version }),
    now,
    now,
    now,
  );
  return getAnalysisJob(id)!;
}

export function getAnalysisJob(id: string): AnalysisJob | null {
  const row = getDb().prepare(
    'SELECT * FROM analysis_jobs WHERE id = ?',
  ).get(id) as AnalysisJob | undefined;
  return row ?? null;
}

export function claimNextAnalysisJob(types?: AnalysisJobType[]): AnalysisJob | null {
  const db = getDb();
  const now = new Date().toISOString();
  const allowedTypes = types?.length ? types : ['memo.extract', 'memo.embed', 'memory.link'];
  const typePlaceholders = allowedTypes.map(() => '?').join(', ');
  const claim = db.transaction(() => {
    const candidate = db.prepare(`
      SELECT id
      FROM analysis_jobs
      WHERE status IN ('pending', 'failed')
        AND run_after <= ?
        AND attempts < max_attempts
        AND type IN (${typePlaceholders})
      ORDER BY created_at ASC
      LIMIT 1
    `).get(now, ...allowedTypes) as { id: string } | undefined;
    if (!candidate) return null;

    const result = db.prepare(`
      UPDATE analysis_jobs
      SET status = 'running',
          attempts = attempts + 1,
          locked_at = ?,
          updated_at = ?
      WHERE id = ?
        AND status IN ('pending', 'failed')
    `).run(now, now, candidate.id);
    return result.changes === 1 ? getAnalysisJob(candidate.id) : null;
  });
  return claim();
}

export function enqueueAnalysisBackfill(batchSize = 500): {
  scanned: number;
  memo_extract_enqueued: number;
  memo_embed_enqueued: number;
  memory_link_enqueued: number;
} {
  const db = getDb();
  const rows = db.prepare(`
    SELECT m.id, m.analysis_status, m.embedding,
      EXISTS (
        SELECT 1 FROM analysis_jobs j
        WHERE j.entity_id = m.id
          AND j.type = 'memory.link'
          AND j.status = 'succeeded'
      ) AS memory_processed,
      EXISTS (
        SELECT 1 FROM memo_chunks c
        WHERE c.memo_id = m.id
          AND c.embedding_version = '${getEmbeddingVersion()}'
      ) AS chunks_processed
    FROM memos m
    WHERE m.privacy_level = 'normal'
      AND (
        m.analysis_status IN ('pending', 'analyzing', 'failed')
        OR m.embedding IS NULL
        OR m.embedding NOT LIKE '{"version":"memo-chunks-v2:%'
        OR NOT EXISTS (
          SELECT 1 FROM memo_chunks c
          WHERE c.memo_id = m.id
            AND c.embedding_version = '${getEmbeddingVersion()}'
        )
        OR (
          m.analysis_status = 'done'
          AND NOT EXISTS (
            SELECT 1 FROM analysis_jobs j
            WHERE j.entity_id = m.id
              AND j.type = 'memory.link'
              AND j.status = 'succeeded'
          )
        )
      )
    ORDER BY m.created_at ASC
    LIMIT ?
  `).all(Math.max(1, Math.min(5000, batchSize))) as Array<{
    id: string;
    analysis_status: string;
    embedding: string | null;
    memory_processed: number;
    chunks_processed: number;
  }>;

  let memoExtractEnqueued = 0;
  let memoEmbedEnqueued = 0;
  let memoryLinkEnqueued = 0;
  for (const row of rows) {
    if (row.analysis_status !== 'done') {
      enqueueMemoAnalysis(row.id);
      memoExtractEnqueued += 1;
      continue;
    }
    if (
      !row.embedding
      || !row.embedding.startsWith('{"version":"memo-chunks-v2:')
      || !row.chunks_processed
    ) {
      enqueueMemoEmbedding(row.id);
      memoEmbedEnqueued += 1;
    }
    if (!row.memory_processed) {
      enqueueMemoryLink(row.id);
      memoryLinkEnqueued += 1;
    }
  }
  return {
    scanned: rows.length,
    memo_extract_enqueued: memoExtractEnqueued,
    memo_embed_enqueued: memoEmbedEnqueued,
    memory_link_enqueued: memoryLinkEnqueued,
  };
}

export function getAnalysisBackfillStats(): AnalysisBackfillStats {
  const db = getDb();
  const memoStats = db.prepare(`
    SELECT
      COUNT(*) AS memos_total,
      SUM(CASE WHEN analysis_status = 'pending' THEN 1 ELSE 0 END) AS memos_pending,
      SUM(CASE WHEN analysis_status = 'analyzing' THEN 1 ELSE 0 END) AS memos_analyzing,
      SUM(CASE WHEN analysis_status = 'failed' THEN 1 ELSE 0 END) AS memos_failed,
      SUM(CASE WHEN analysis_status = 'done' THEN 1 ELSE 0 END) AS memos_done,
      SUM(CASE
        WHEN embedding LIKE '{"version":"memo-chunks-v2:%'
          AND EXISTS (
            SELECT 1 FROM memo_chunks c
            WHERE c.memo_id = memos.id
              AND c.embedding_version = '${getEmbeddingVersion()}'
          )
        THEN 1
        ELSE 0
      END) AS memos_embedded,
      (
        SELECT COUNT(DISTINCT entity_id)
        FROM analysis_jobs
        WHERE type = 'memory.link' AND status = 'succeeded'
      ) AS memos_memory_processed
    FROM memos
  `).get() as Omit<AnalysisBackfillStats,
    'jobs_pending' | 'jobs_running' | 'jobs_failed' | 'jobs_dead' | 'jobs_succeeded'>;
  const jobStats = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS jobs_pending,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS jobs_running,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS jobs_failed,
      SUM(CASE WHEN status = 'dead' THEN 1 ELSE 0 END) AS jobs_dead,
      SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS jobs_succeeded
    FROM analysis_jobs
  `).get() as Pick<AnalysisBackfillStats,
    'jobs_pending' | 'jobs_running' | 'jobs_failed' | 'jobs_dead' | 'jobs_succeeded'>;
  return Object.fromEntries(
    Object.entries({ ...memoStats, ...jobStats }).map(([key, value]) => [key, Number(value) || 0]),
  ) as unknown as AnalysisBackfillStats;
}

export function markAnalysisJobSucceeded(id: string): void {
  const now = new Date().toISOString();
  getDb().prepare(`
    UPDATE analysis_jobs
    SET status = 'succeeded',
        locked_at = NULL,
        last_error = NULL,
        updated_at = ?,
        completed_at = ?
    WHERE id = ?
  `).run(now, now, id);
}

export function markAnalysisJobFailed(job: AnalysisJob, error: unknown): void {
  const now = new Date();
  const exhausted = job.attempts >= job.max_attempts;
  const delaySeconds = Math.min(300, 2 ** Math.max(0, job.attempts - 1) * 5);
  const runAfter = new Date(now.getTime() + delaySeconds * 1000).toISOString();
  getDb().prepare(`
    UPDATE analysis_jobs
    SET status = ?,
        locked_at = NULL,
        last_error = ?,
        run_after = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    exhausted ? 'dead' : 'failed',
    error instanceof Error ? error.message.slice(0, 2000) : '未知任务错误',
    runAfter,
    now.toISOString(),
    job.id,
  );
}

export function recoverStaleAnalysisJobs(staleMinutes = 10): number {
  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();
  const now = new Date().toISOString();
  const result = getDb().prepare(`
    UPDATE analysis_jobs
    SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'failed' END,
        locked_at = NULL,
        last_error = '任务运行超时，等待重试',
        run_after = ?,
        updated_at = ?
    WHERE status = 'running'
      AND locked_at < ?
  `).run(now, now, cutoff);
  return result.changes;
}
