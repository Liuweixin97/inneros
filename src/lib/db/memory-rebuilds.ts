import { v4 as uuidv4 } from 'uuid';
import { MEMORY_PROMPT_VERSION, proposeMemoMemory, type MemoryProposal } from '@/lib/ai/memory-linker';
import { applyMemoryMutations } from '@/lib/db/memories';
import { getDb } from '@/lib/db';
import { getMemoById } from '@/lib/db/memos';

type RebuildStatus = 'previewing' | 'ready' | 'applying' | 'applied' | 'rolled_back' | 'failed';

interface RebuildRunRow {
  id: string;
  status: RebuildStatus;
  prompt_version: string;
  memo_count: number;
  proposal_count: number;
  error_count: number;
  snapshot: string | null;
  created_at: string;
  completed_at: string | null;
  applied_at: string | null;
  rolled_back_at: string | null;
}

interface Snapshot {
  memory_items: Record<string, unknown>[];
  memory_evidence: Record<string, unknown>[];
  memory_relations: Record<string, unknown>[];
}

const ITEM_COLUMNS = [
  'id', 'type', 'canonical_key', 'title', 'summary', 'status', 'confidence',
  'first_seen_at', 'last_confirmed_at', 'supersedes_id', 'model_version',
  'prompt_version', 'metadata', 'created_at', 'updated_at',
] as const;
const EVIDENCE_COLUMNS = [
  'id', 'memory_id', 'memo_id', 'relation', 'excerpt', 'confidence', 'created_at',
] as const;
const RELATION_COLUMNS = [
  'id', 'source_memory_id', 'target_memory_id', 'relation_type', 'confidence',
  'evidence_memo_id', 'created_at',
] as const;

function insertRows(
  table: string,
  columns: readonly string[],
  rows: Record<string, unknown>[],
): void {
  if (rows.length === 0) return;
  const placeholders = columns.map(() => '?').join(', ');
  const statement = getDb().prepare(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
  );
  for (const row of rows) {
    statement.run(...columns.map((column) => row[column]));
  }
}

function snapshotMemories(): Snapshot {
  const db = getDb();
  return {
    memory_items: db.prepare('SELECT * FROM memory_items').all() as Record<string, unknown>[],
    memory_evidence: db.prepare('SELECT * FROM memory_evidence').all() as Record<string, unknown>[],
    memory_relations: db.prepare('SELECT * FROM memory_relations').all() as Record<string, unknown>[],
  };
}

function selectRebuildMemoIds(limit: number): string[] {
  const rows = getDb().prepare(`
    SELECT m.id
    FROM memos m
    WHERE m.privacy_level = 'normal'
      AND m.analysis_status = 'done'
      AND NOT EXISTS (
        SELECT 1
        FROM memory_evidence current_evidence
        JOIN memory_items current_memory ON current_memory.id = current_evidence.memory_id
        WHERE current_evidence.memo_id = m.id
          AND current_memory.prompt_version LIKE 'memory-link-v5.%'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM memory_rebuild_proposals processed_proposal
        JOIN memory_rebuild_runs processed_run ON processed_run.id = processed_proposal.run_id
        WHERE processed_proposal.memo_id = m.id
          AND processed_run.status = 'applied'
          AND processed_run.prompt_version LIKE 'memory-link-v5.%'
      )
      AND (
        (m.ai_emotions != '[]' AND NOT EXISTS (
          SELECT 1 FROM memory_evidence e WHERE e.memo_id = m.id
        ))
        OR EXISTS (
          SELECT 1
          FROM memory_evidence e
          JOIN memory_items mi ON mi.id = e.memory_id
          WHERE e.memo_id = m.id
            AND mi.type = 'event'
            AND mi.prompt_version = 'memory-link-v3'
        )
      )
    ORDER BY
      CASE WHEN m.ai_emotions != '[]' AND NOT EXISTS (
        SELECT 1 FROM memory_evidence e WHERE e.memo_id = m.id
      ) THEN 0 ELSE 1 END,
      CASE m.ai_category WHEN '感受' THEN 0 WHEN '方法论' THEN 1 WHEN '日记' THEN 2 ELSE 3 END,
      length(m.plain_text) DESC,
      m.created_at DESC
    LIMIT ?
  `).all(limit) as Array<{ id: string }>;
  return rows.map((row) => row.id);
}

function summarizeRun(row: RebuildRunRow) {
  const proposals = getDb().prepare(`
    SELECT memo_id, model_version, proposal, status, error_message
    FROM memory_rebuild_proposals
    WHERE run_id = ?
    ORDER BY created_at ASC
  `).all(row.id) as Array<{
    memo_id: string;
    model_version: string;
    proposal: string;
    status: string;
    error_message: string | null;
  }>;
  const typeCounts: Record<string, number> = {};
  let empty = 0;
  const items = proposals.map((proposal) => {
    let parsed: MemoryProposal | null = null;
    try {
      parsed = JSON.parse(proposal.proposal) as MemoryProposal;
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.memories.length === 0) empty += 1;
    for (const memory of parsed?.memories ?? []) {
      typeCounts[memory.type] = (typeCounts[memory.type] || 0) + 1;
    }
    const memo = getMemoById(proposal.memo_id);
    return {
      memo_id: proposal.memo_id,
      memo_title: memo?.ai_title || memo?.plain_text.slice(0, 30) || '已删除笔记',
      memo_date: memo?.created_at || null,
      memo_emotions: memo?.ai_emotions || [],
      status: proposal.status,
      error_message: proposal.error_message,
      memories: parsed?.memories ?? [],
    };
  });
  return {
    id: row.id,
    status: row.status,
    prompt_version: row.prompt_version,
    memo_count: row.memo_count,
    proposal_count: row.proposal_count,
    error_count: row.error_count,
    empty_proposals: empty,
    type_counts: typeCounts,
    created_at: row.created_at,
    completed_at: row.completed_at,
    applied_at: row.applied_at,
    rolled_back_at: row.rolled_back_at,
    items,
  };
}

export function getMemoryRebuildRun(id: string) {
  const row = getDb().prepare(
    'SELECT * FROM memory_rebuild_runs WHERE id = ?',
  ).get(id) as RebuildRunRow | undefined;
  return row ? summarizeRun(row) : null;
}

export function getLatestMemoryRebuildRun() {
  const row = getDb().prepare(
    'SELECT * FROM memory_rebuild_runs ORDER BY created_at DESC LIMIT 1',
  ).get() as RebuildRunRow | undefined;
  return row ? summarizeRun(row) : null;
}

export async function previewMemoryRebuild(input: {
  limit?: number;
  concurrency?: number;
}) {
  const limit = Math.max(1, Math.min(50, input.limit ?? 20));
  const concurrency = Math.max(1, Math.min(4, input.concurrency ?? 2));
  const memoIds = selectRebuildMemoIds(limit);
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO memory_rebuild_runs (
      id, status, prompt_version, memo_count, created_at
    ) VALUES (?, 'previewing', ?, ?, ?)
  `).run(id, MEMORY_PROMPT_VERSION, memoIds.length, now);

  let cursor = 0;
  let proposalCount = 0;
  let errorCount = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, memoIds.length)) }, async () => {
    while (cursor < memoIds.length) {
      const memoId = memoIds[cursor];
      cursor += 1;
      const memo = getMemoById(memoId);
      if (!memo) continue;
      try {
        const proposal = await proposeMemoMemory(memo);
        db.prepare(`
          INSERT INTO memory_rebuild_proposals (
            id, run_id, memo_id, model_version, proposal, status, created_at
          ) VALUES (?, ?, ?, ?, ?, 'ready', ?)
        `).run(
          uuidv4(),
          id,
          memoId,
          proposal.modelVersion,
          JSON.stringify(proposal),
          new Date().toISOString(),
        );
        proposalCount += 1;
      } catch (error) {
        db.prepare(`
          INSERT INTO memory_rebuild_proposals (
            id, run_id, memo_id, model_version, proposal, status, error_message, created_at
          ) VALUES (?, ?, ?, 'unknown', '{}', 'failed', ?, ?)
        `).run(
          uuidv4(),
          id,
          memoId,
          error instanceof Error ? error.message.slice(0, 2000) : '未知错误',
          new Date().toISOString(),
        );
        errorCount += 1;
      }
    }
  });
  await Promise.all(workers);
  const completedAt = new Date().toISOString();
  db.prepare(`
    UPDATE memory_rebuild_runs
    SET status = ?, proposal_count = ?, error_count = ?, completed_at = ?
    WHERE id = ?
  `).run(errorCount === memoIds.length && memoIds.length > 0 ? 'failed' : 'ready', proposalCount, errorCount, completedAt, id);
  return getMemoryRebuildRun(id)!;
}

export function applyMemoryRebuild(id: string) {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM memory_rebuild_runs WHERE id = ?',
  ).get(id) as RebuildRunRow | undefined;
  if (!row) throw new Error('找不到记忆重建任务');
  if (row.status !== 'ready') throw new Error(`当前状态 ${row.status} 不能应用`);

  const proposals = db.prepare(`
    SELECT proposal FROM memory_rebuild_proposals
    WHERE run_id = ? AND status = 'ready'
    ORDER BY created_at ASC
  `).all(id) as Array<{ proposal: string }>;
  const snapshot = JSON.stringify(snapshotMemories());
  db.prepare(
    "UPDATE memory_rebuild_runs SET status = 'applying', snapshot = ? WHERE id = ?",
  ).run(snapshot, id);
  try {
    for (const rowProposal of proposals) {
      applyMemoryMutations(JSON.parse(rowProposal.proposal) as MemoryProposal);
    }
    const appliedAt = new Date().toISOString();
    db.prepare(
      "UPDATE memory_rebuild_runs SET status = 'applied', applied_at = ? WHERE id = ?",
    ).run(appliedAt, id);
  } catch (error) {
    db.prepare(
      "UPDATE memory_rebuild_runs SET status = 'failed' WHERE id = ?",
    ).run(id);
    throw error;
  }
  return getMemoryRebuildRun(id)!;
}

export function rollbackMemoryRebuild(id: string) {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM memory_rebuild_runs WHERE id = ?',
  ).get(id) as RebuildRunRow | undefined;
  if (!row) throw new Error('找不到记忆重建任务');
  if (row.status !== 'applied' || !row.snapshot) throw new Error('该任务没有可回滚的已应用快照');
  const newerApplied = db.prepare(`
    SELECT id FROM memory_rebuild_runs
    WHERE status = 'applied' AND applied_at > ?
    LIMIT 1
  `).get(row.applied_at) as { id: string } | undefined;
  if (newerApplied) throw new Error('存在更新的已应用重建，不能回滚较早版本');

  const snapshot = JSON.parse(row.snapshot) as Snapshot;
  const restore = db.transaction(() => {
    db.pragma('defer_foreign_keys = ON');
    db.prepare('DELETE FROM memory_relations').run();
    db.prepare('DELETE FROM memory_evidence').run();
    db.prepare('DELETE FROM memory_items').run();
    insertRows('memory_items', ITEM_COLUMNS, snapshot.memory_items);
    insertRows('memory_evidence', EVIDENCE_COLUMNS, snapshot.memory_evidence);
    insertRows('memory_relations', RELATION_COLUMNS, snapshot.memory_relations);
  });
  restore();
  db.prepare(`
    UPDATE memory_rebuild_runs
    SET status = 'rolled_back', rolled_back_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), id);
  return getMemoryRebuildRun(id)!;
}
