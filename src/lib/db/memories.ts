import { v4 as uuidv4 } from 'uuid';
import { getDb } from './index';
import type {
  MemoryEvidence,
  MemoryEvidenceRelation,
  MemoryItem,
  MemoryRelation,
  MemoryStatus,
  MemoryType,
} from '@/types';

type MemoryRow = Omit<MemoryItem, 'metadata' | 'evidence_count'> & {
  metadata: string;
  evidence_count?: number;
};

export interface MemoryCandidate extends MemoryItem {
  evidence: Array<Pick<MemoryEvidence, 'memo_id' | 'relation' | 'excerpt' | 'confidence'>>;
}

export interface MemoryMutation {
  local_ref: string;
  type: MemoryType;
  canonical_key: string;
  title: string;
  summary: string;
  operation: 'new' | 'reinforce' | 'contradict' | 'update';
  target_memory_id: string | null;
  status: Exclude<MemoryStatus, 'superseded'>;
  confidence: number;
  evidence_excerpt: string;
}

export interface MemoryRelationMutation {
  source_ref: string;
  target_ref: string;
  relation_type: string;
  confidence: number;
}

function clampConfidence(value: number): number {
  return Math.max(0.05, Math.min(0.99, Number.isFinite(value) ? value : 0.5));
}

function parseMemory(row: MemoryRow): MemoryItem {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata) as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  return {
    ...row,
    metadata,
    evidence_count: row.evidence_count ?? 0,
  };
}

export function getMemoryById(id: string): MemoryItem | null {
  const row = getDb().prepare(`
    SELECT m.*, COUNT(e.id) AS evidence_count
    FROM memory_items m
    LEFT JOIN memory_evidence e ON e.memory_id = m.id
    WHERE m.id = ?
    GROUP BY m.id
  `).get(id) as MemoryRow | undefined;
  return row ? parseMemory(row) : null;
}

export function getMemories(filters: {
  type?: MemoryType;
  status?: MemoryStatus;
  query?: string;
  limit?: number;
  offset?: number;
} = {}): { memories: MemoryItem[]; total: number } {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};
  if (filters.type) {
    conditions.push('m.type = @type');
    params.type = filters.type;
  }
  if (filters.status) {
    conditions.push('m.status = @status');
    params.status = filters.status;
  }
  if (filters.query) {
    conditions.push('(m.title LIKE @query OR m.summary LIKE @query OR m.canonical_key LIKE @query)');
    params.query = `%${filters.query}%`;
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { total } = getDb().prepare(
    `SELECT COUNT(*) AS total FROM memory_items m ${where}`,
  ).get(params) as { total: number };
  const rows = getDb().prepare(`
    SELECT m.*, COUNT(e.id) AS evidence_count
    FROM memory_items m
    LEFT JOIN memory_evidence e ON e.memory_id = m.id
    ${where}
    GROUP BY m.id
    ORDER BY
      CASE m.status WHEN 'active' THEN 0 WHEN 'dormant' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END,
      m.last_confirmed_at DESC
    LIMIT @limit OFFSET @offset
  `).all({
    ...params,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
  }) as MemoryRow[];
  return { memories: rows.map(parseMemory), total };
}

export function getMemoryEvidence(memoryId: string): MemoryEvidence[] {
  return getDb().prepare(`
    SELECT * FROM memory_evidence
    WHERE memory_id = ?
    ORDER BY created_at DESC
  `).all(memoryId) as MemoryEvidence[];
}

export function getMemoryRelations(memoryId: string): MemoryRelation[] {
  return getDb().prepare(`
    SELECT * FROM memory_relations
    WHERE source_memory_id = ? OR target_memory_id = ?
    ORDER BY created_at DESC
  `).all(memoryId, memoryId) as MemoryRelation[];
}

export function searchMemoryEvidenceByTerms(
  terms: string[],
  limit = 20,
): Array<{ memoId: string; score: number; matchedTerms: string[] }> {
  const normalizedTerms = [...new Set(terms.map((term) => term.trim()).filter((term) => term.length >= 2))]
    .slice(0, 10);
  if (normalizedTerms.length === 0) return [];
  const params: Record<string, unknown> = { limit: Math.max(limit * 4, 40) };
  const conditions = normalizedTerms.map((term, index) => {
    params[`term${index}`] = `%${term}%`;
    return `(m.title LIKE @term${index} OR m.summary LIKE @term${index})`;
  });
  const rows = getDb().prepare(`
    SELECT e.memo_id, m.title, m.summary, m.confidence
    FROM memory_items m
    JOIN memory_evidence e ON e.memory_id = m.id
    WHERE m.status != 'superseded'
      AND (${conditions.join(' OR ')})
    ORDER BY m.last_confirmed_at DESC
    LIMIT @limit
  `).all(params) as Array<{
    memo_id: string;
    title: string;
    summary: string;
    confidence: number;
  }>;
  const byMemo = new Map<string, { memoId: string; score: number; matchedTerms: string[] }>();
  for (const row of rows) {
    const haystack = `${row.title} ${row.summary}`.toLowerCase();
    const matchedTerms = normalizedTerms.filter((term) => haystack.includes(term.toLowerCase()));
    const score = matchedTerms.reduce((sum, term) => sum + Math.min(8, term.length * 1.5), 0)
      + Number(row.confidence || 0) * 3;
    const existing = byMemo.get(row.memo_id);
    if (!existing || score > existing.score) {
      byMemo.set(row.memo_id, { memoId: row.memo_id, score, matchedTerms });
    }
  }
  return [...byMemo.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export function getCurrentMemoryEvidence(
  limit = 16,
  maximumAgeDays = 400,
): Array<{ memoId: string; score: number; matchedTerms: string[] }> {
  const cutoff = new Date(Date.now() - maximumAgeDays * 86_400_000).toISOString();
  const rows = getDb().prepare(`
    SELECT e.memo_id, m.type, m.title, m.confidence, m.last_confirmed_at
    FROM memory_items m
    JOIN memory_evidence e ON e.memory_id = m.id
    WHERE m.status = 'active'
      AND m.type IN ('goal', 'project', 'constraint')
      AND m.last_confirmed_at >= ?
    ORDER BY m.last_confirmed_at DESC, m.confidence DESC, e.created_at DESC
    LIMIT ?
  `).all(cutoff, Math.max(limit * 3, 30)) as Array<{
    memo_id: string;
    type: string;
    title: string;
    confidence: number;
    last_confirmed_at: string;
  }>;
  const byMemo = new Map<string, { memoId: string; score: number; matchedTerms: string[] }>();
  for (const row of rows) {
    const ageDays = Math.max(
      0,
      (Date.now() - new Date(row.last_confirmed_at).getTime()) / 86_400_000,
    );
    const score = 22 + Number(row.confidence || 0) * 8 + 10 * Math.exp(-ageDays / 150);
    const candidate = {
      memoId: row.memo_id,
      score,
      matchedTerms: [`当前${row.type === 'goal' ? '目标' : row.type === 'project' ? '项目' : '约束'}`, row.title],
    };
    const existing = byMemo.get(row.memo_id);
    if (!existing || candidate.score > existing.score) byMemo.set(row.memo_id, candidate);
  }
  return [...byMemo.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function tokenize(values: string[]): string[] {
  return [...new Set(values
    .flatMap((value) => value.toLowerCase().split(/[\s,，。；;、:：/\\()[\]（）]+/))
    .map((value) => value.trim())
    .filter((value) => value.length >= 2))]
    .slice(0, 24);
}

export function findMemoryCandidates(input: {
  text: string;
  people: string[];
  projects: string[];
  topics: string[];
  limit?: number;
}): MemoryCandidate[] {
  const tokens = tokenize([
    ...input.people,
    ...input.projects,
    ...input.topics,
    ...input.text.slice(0, 600).split(/\s+/),
  ]);
  const rows = getDb().prepare(`
    SELECT m.*, COUNT(e.id) AS evidence_count
    FROM memory_items m
    LEFT JOIN memory_evidence e ON e.memory_id = m.id
    WHERE m.status != 'superseded'
    GROUP BY m.id
    ORDER BY m.last_confirmed_at DESC
    LIMIT 160
  `).all() as MemoryRow[];

  const scored = rows.map((row) => {
    const memory = parseMemory(row);
    const haystack = `${memory.canonical_key} ${memory.title} ${memory.summary}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (haystack.includes(token)) score += token.length >= 4 ? 3 : 1;
    }
    if (input.people.some((name) => memory.type === 'person' && haystack.includes(name.toLowerCase()))) score += 8;
    if (input.projects.some((name) => memory.type === 'project' && haystack.includes(name.toLowerCase()))) score += 8;
    return { memory, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || b.memory.last_confirmed_at.localeCompare(a.memory.last_confirmed_at))
    .slice(0, input.limit ?? 30)
    .map(({ memory }) => ({
      ...memory,
      evidence: getDb().prepare(`
        SELECT memo_id, relation, excerpt, confidence
        FROM memory_evidence
        WHERE memory_id = ?
        ORDER BY created_at DESC
        LIMIT 3
      `).all(memory.id) as MemoryCandidate['evidence'],
    }));
}

export function applyMemoryMutations(input: {
  memoId: string;
  memoDate: string;
  modelVersion: string;
  promptVersion: string;
  memories: MemoryMutation[];
  relations: MemoryRelationMutation[];
}): MemoryItem[] {
  const db = getDb();
  const now = new Date().toISOString();
  const refs = new Map<string, string>();
  const affected = new Set<string>();

  const run = db.transaction(() => {
    // Re-linking a memo replaces only that memo's derived evidence and relations.
    db.prepare('DELETE FROM memory_relations WHERE evidence_memo_id = ?').run(input.memoId);
    db.prepare('DELETE FROM memory_evidence WHERE memo_id = ?').run(input.memoId);

    for (const mutation of input.memories) {
      let memoryId = mutation.target_memory_id;
      const target = memoryId ? getMemoryById(memoryId) : null;
      if (mutation.operation !== 'new' && !target) continue;

      if (mutation.operation === 'reinforce' && target) {
        const nextConfidence = clampConfidence(
          target.confidence + (1 - target.confidence) * clampConfidence(mutation.confidence) * 0.25,
        );
        db.prepare(`
          UPDATE memory_items
          SET confidence = ?,
              last_confirmed_at = ?,
              status = ?,
              updated_at = ?
          WHERE id = ?
        `).run(nextConfidence, input.memoDate, mutation.status, now, target.id);
        memoryId = target.id;
      } else {
        const supersedesId = mutation.operation === 'update' && target ? target.id : null;
        memoryId = uuidv4();
        let canonicalKey = mutation.canonical_key;
        if (supersedesId) canonicalKey = `${canonicalKey}:v:${memoryId.slice(0, 8)}`;
        try {
          db.prepare(`
            INSERT INTO memory_items (
              id, type, canonical_key, title, summary, status, confidence,
              first_seen_at, last_confirmed_at, supersedes_id,
              model_version, prompt_version, metadata, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?)
          `).run(
            memoryId,
            mutation.type,
            canonicalKey,
            mutation.title,
            mutation.summary,
            mutation.status,
            clampConfidence(mutation.confidence),
            input.memoDate,
            input.memoDate,
            supersedesId,
            input.modelVersion,
            input.promptVersion,
            now,
            now,
          );
        } catch (error) {
          const existing = db.prepare(
            'SELECT id FROM memory_items WHERE type = ? AND canonical_key = ?',
          ).get(mutation.type, mutation.canonical_key) as { id: string } | undefined;
          if (!existing) throw error;
          memoryId = existing.id;
          db.prepare(`
            UPDATE memory_items
            SET last_confirmed_at = ?,
                confidence = MAX(confidence, ?),
                updated_at = ?
            WHERE id = ?
          `).run(input.memoDate, clampConfidence(mutation.confidence), now, memoryId);
        }
        if (supersedesId) {
          db.prepare(`
            UPDATE memory_items SET status = 'superseded', updated_at = ? WHERE id = ?
          `).run(now, supersedesId);
        }
      }

      if (!memoryId) continue;
      refs.set(mutation.local_ref, memoryId);
      affected.add(memoryId);
      const evidenceRelation: MemoryEvidenceRelation = {
        new: 'introduced',
        reinforce: 'supports',
        contradict: 'contradicts',
        update: 'updates',
      }[mutation.operation] as MemoryEvidenceRelation;
      db.prepare(`
        INSERT INTO memory_evidence (
          id, memory_id, memo_id, relation, excerpt, confidence, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(memory_id, memo_id, relation) DO UPDATE SET
          excerpt = excluded.excerpt,
          confidence = excluded.confidence
      `).run(
        uuidv4(),
        memoryId,
        input.memoId,
        evidenceRelation,
        mutation.evidence_excerpt,
        clampConfidence(mutation.confidence),
        now,
      );

      if (target && mutation.operation === 'contradict' && memoryId !== target.id) {
        db.prepare(`
          INSERT OR IGNORE INTO memory_relations (
            id, source_memory_id, target_memory_id, relation_type,
            confidence, evidence_memo_id, created_at
          ) VALUES (?, ?, ?, 'contradicts', ?, ?, ?)
        `).run(uuidv4(), memoryId, target.id, clampConfidence(mutation.confidence), input.memoId, now);
      }
    }

    for (const relation of input.relations) {
      const sourceId = refs.get(relation.source_ref) || relation.source_ref;
      const targetId = refs.get(relation.target_ref) || relation.target_ref;
      if (!sourceId || !targetId || sourceId === targetId) continue;
      if (!getMemoryById(sourceId) || !getMemoryById(targetId)) continue;
      db.prepare(`
        INSERT INTO memory_relations (
          id, source_memory_id, target_memory_id, relation_type,
          confidence, evidence_memo_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_memory_id, target_memory_id, relation_type, evidence_memo_id)
        DO UPDATE SET confidence = excluded.confidence
      `).run(
        uuidv4(),
        sourceId,
        targetId,
        relation.relation_type,
        clampConfidence(relation.confidence),
        input.memoId,
        now,
      );
    }

    db.prepare(`
      DELETE FROM memory_items
      WHERE status != 'superseded'
        AND NOT EXISTS (
          SELECT 1 FROM memory_evidence e WHERE e.memory_id = memory_items.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM memory_relations r
          WHERE r.source_memory_id = memory_items.id OR r.target_memory_id = memory_items.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM memory_items newer WHERE newer.supersedes_id = memory_items.id
        )
    `).run();
  });
  run();

  return [...affected].map(getMemoryById).filter((item): item is MemoryItem => Boolean(item));
}
