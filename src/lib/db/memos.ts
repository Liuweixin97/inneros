import { v4 as uuidv4 } from 'uuid';
import type { Memo, MemoCreateInput, MemoFilters } from '@/types';
import { getDb, MEMO_JSON_FIELDS, parseJsonFields, stringifyJsonFields } from './index';

// ---- Internal helpers ----

function parseMemoRow(row: Record<string, unknown>): Memo {
  return parseJsonFields(row, MEMO_JSON_FIELDS) as unknown as Memo;
}

function extractHashtags(content: string): string[] {
  const matches = content.match(/#([\u4e00-\u9fa5\w/.-]+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => {
    let tag = m.slice(1).trim();
    while (tag && /[./-]$/.test(tag)) {
      tag = tag.slice(0, -1);
    }
    return tag;
  }).filter(Boolean))];
}

function generatePlainText(content: string, source: string): string {
  let text = content;

  // For Flomo imports, strip redundant tags and bold titles from the beginning of the plain text preview
  if (source === 'flomo') {
    text = text.replace(/^(#[^\s\n#]+[\s\n]*)+/, '');
    text = text.replace(/^(\*\*[^*]+\*\*[\s\n]*)+/, '');
  }

  // Preserve block boundaries from the rich-text editor before stripping HTML.
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  // Strip general markdown formatting characters for clean plain text
  text = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

// ---- Public API ----

export function getMemos(filters: MemoFilters = {}): { memos: Memo[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.query) {
    conditions.push('(plain_text LIKE @query OR raw_content LIKE @query)');
    params.query = `%${filters.query}%`;
  }

  if (filters.tag) {
    conditions.push("original_tags LIKE @tag");
    params.tag = `%"${filters.tag}"%`;
  }

  if (filters.category) {
    conditions.push('ai_category = @category');
    params.category = filters.category;
  }

  if (filters.emotion) {
    conditions.push("ai_emotions LIKE @emotion");
    params.emotion = `%"${filters.emotion}"%`;
  }

  if (filters.topic) {
    conditions.push("ai_topics LIKE @topic");
    params.topic = `%"${filters.topic}"%`;
  }

  if (filters.dateFrom) {
    conditions.push('created_at >= @dateFrom');
    params.dateFrom = filters.dateFrom;
  }

  if (filters.dateTo) {
    conditions.push('created_at <= @dateTo');
    params.dateTo = filters.dateTo;
  }

  if (filters.analysisStatus) {
    conditions.push('analysis_status = @analysisStatus');
    params.analysisStatus = filters.analysisStatus;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM memos ${whereClause}`);
  const { count: total } = countStmt.get(params) as { count: number };

  // Fetch rows
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const dataStmt = db.prepare(
    `SELECT * FROM memos ${whereClause} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
  );
  const rows = dataStmt.all({ ...params, limit, offset }) as Record<string, unknown>[];

  return {
    memos: rows.map(parseMemoRow),
    total,
  };
}

export function getMemoById(id: string): Memo | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM memos WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return parseMemoRow(row);
}

export function createMemo(input: MemoCreateInput): Memo {
  const db = getDb();
  const id = uuidv4();
  const now = input.created_at || new Date().toISOString();

  // Extract tags from content (#hashtag pattern) and merge with explicit tags
  const contentTags = extractHashtags(input.content);
  const allTags = [...new Set([...(input.tags || []), ...contentTags])];

  const plainText = generatePlainText(input.content, input.source || 'manual');

  const memo: Record<string, unknown> = {
    id,
    raw_content: input.content,
    plain_text: plainText,
    created_at: now,
    updated_at: now,
    source: input.source || 'manual',
    original_tags: allTags,
    ai_title: input.ai_title || null,
    ai_summary: null,
    ai_category: null,
    ai_topics: [],
    ai_emotions: [],
    ai_people: [],
    ai_projects: [],
    ai_actions: [],
    ai_key_questions: [],
    embedding: null,
    analysis_status: 'pending',
    privacy_level: 'normal',
  };

  const dbMemo = stringifyJsonFields(memo, MEMO_JSON_FIELDS);

  const columns = Object.keys(dbMemo);
  const placeholders = columns.map((c) => `@${c}`).join(', ');
  const stmt = db.prepare(
    `INSERT INTO memos (${columns.join(', ')}) VALUES (${placeholders})`
  );
  stmt.run(dbMemo);

  return parseJsonFields(dbMemo, MEMO_JSON_FIELDS) as unknown as Memo;
}

export function createMemosBatch(inputs: MemoCreateInput[]): Memo[] {
  const db = getDb();

  const insertStmt = db.prepare(`
    INSERT INTO memos (
      id, raw_content, plain_text, created_at, updated_at, source, original_tags,
      ai_title, ai_summary, ai_category, ai_topics, ai_emotions, ai_people,
      ai_projects, ai_actions, ai_key_questions, embedding, analysis_status, privacy_level
    ) VALUES (
      @id, @raw_content, @plain_text, @created_at, @updated_at, @source, @original_tags,
      @ai_title, @ai_summary, @ai_category, @ai_topics, @ai_emotions, @ai_people,
      @ai_projects, @ai_actions, @ai_key_questions, @embedding, @analysis_status, @privacy_level
    )
  `);

  const runInsertBatch = db.transaction((memos: Record<string, unknown>[]) => {
    for (const memo of memos) {
      insertStmt.run(memo);
    }
  });

  const parsedMemos = inputs.map((input) => {
    const id = uuidv4();
    const now = input.created_at || new Date().toISOString();
    const contentTags = extractHashtags(input.content);
    const allTags = [...new Set([...(input.tags || []), ...contentTags])];
    const plainText = generatePlainText(input.content, input.source || 'flomo');

    const memo: Record<string, unknown> = {
      id,
      raw_content: input.content,
      plain_text: plainText,
      created_at: now,
      updated_at: now,
      source: input.source || 'flomo',
      original_tags: allTags,
      ai_title: input.ai_title || null,
      ai_summary: null,
      ai_category: null,
      ai_topics: [],
      ai_emotions: [],
      ai_people: [],
      ai_projects: [],
      ai_actions: [],
      ai_key_questions: [],
      embedding: null,
      analysis_status: 'pending',
      privacy_level: 'normal',
    };

    const dbMemo = stringifyJsonFields(memo, MEMO_JSON_FIELDS);
    return {
      dbMemo,
      originalMemo: parseJsonFields(dbMemo, MEMO_JSON_FIELDS) as unknown as Memo,
    };
  });

  runInsertBatch(parsedMemos.map((p) => p.dbMemo));

  return parsedMemos.map((p) => p.originalMemo);
}


export function updateMemo(id: string, updates: Partial<Memo>): Memo | null {
  const db = getDb();

  // Check existence
  const existing = db.prepare('SELECT * FROM memos WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) return null;

  const safeUpdates: Record<string, unknown> = { ...updates };
  safeUpdates.updated_at = new Date().toISOString();

  // Remove id and created_at from updates
  delete safeUpdates.id;
  delete safeUpdates.created_at;

  // Stringify JSON fields
  const dbUpdates = stringifyJsonFields(safeUpdates, MEMO_JSON_FIELDS);

  const setClauses = Object.keys(dbUpdates).map((key) => `${key} = @${key}`);
  const stmt = db.prepare(
    `UPDATE memos SET ${setClauses.join(', ')} WHERE id = @id`
  );
  const applyUpdate = db.transaction(() => {
    stmt.run({ ...dbUpdates, id });
    if ('embedding' in safeUpdates && safeUpdates.embedding === null) {
      db.prepare('DELETE FROM memo_chunks WHERE memo_id = ?').run(id);
    }
  });
  applyUpdate();

  return getMemoById(id);
}

export function deleteMemo(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM memos WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getMemoStats(): {
  total: number;
  today: number;
  thisWeek: number;
  topTags: { name: string; count: number }[];
} {
  const db = getDb();

  const { total } = db.prepare('SELECT COUNT(*) as total FROM memos').get() as { total: number };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { today } = db
    .prepare('SELECT COUNT(*) as today FROM memos WHERE created_at >= ?')
    .get(todayStart.toISOString()) as { today: number };

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const { thisWeek } = db
    .prepare('SELECT COUNT(*) as thisWeek FROM memos WHERE created_at >= ?')
    .get(weekStart.toISOString()) as { thisWeek: number };

  // Aggregate top tags from all memos
  const allMemos = db.prepare('SELECT original_tags FROM memos').all() as { original_tags: string }[];
  const tagCounts: Record<string, number> = {};
  for (const row of allMemos) {
    try {
      const tags: string[] = JSON.parse(row.original_tags);
      for (const tag of tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    } catch {
      // skip invalid JSON
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return { total, today, thisWeek, topTags };
}

export function getRecentMemos(limit: number = 10): Memo[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM memos ORDER BY created_at DESC LIMIT ?')
    .all(limit) as Record<string, unknown>[];
  return rows.map(parseMemoRow);
}

export function searchMemos(query: string, limit: number = 20): Memo[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM memos
       WHERE privacy_level = 'normal'
         AND (plain_text LIKE @query OR raw_content LIKE @query)
       ORDER BY created_at DESC LIMIT @limit`
    )
    .all({ query: `%${query}%`, limit }) as Record<string, unknown>[];
  return rows.map(parseMemoRow);
}

export interface RankedMemoSearchResult {
  memo: Memo;
  score: number;
  matchedTerms: string[];
  matchedChunk?: string;
  matchedChunkIndex?: number;
  matchedChunkStart?: number;
  vectorSimilarity?: number;
}

export type MemoSearchTermKind = 'exact' | 'entity' | 'semantic';

export interface MemoSearchTerm {
  value: string;
  kind: MemoSearchTermKind;
}

export function searchMemosByTerms(
  query: string,
  terms: MemoSearchTerm[],
  limit: number = 20,
): RankedMemoSearchResult[] {
  const normalizedTerms = [...new Map(
    terms
      .map((term) => ({
        value: term.value.trim(),
        kind: term.kind,
      }))
      .filter((term) => term.value.length >= 2)
      .map((term) => [`${term.kind}:${term.value.toLowerCase()}`, term]),
  ).values()].slice(0, 18);
  if (normalizedTerms.length === 0) return [];

  const searchableFields = [
    'plain_text',
    'raw_content',
    'ai_title',
    'ai_summary',
    'ai_topics',
    'ai_people',
    'ai_projects',
    'original_tags',
  ];
  const params: Record<string, unknown> = {};
  const conditions = normalizedTerms.map((term, index) => {
    params[`term${index}`] = `%${term.value}%`;
    return `(${searchableFields.map((field) => `${field} LIKE @term${index}`).join(' OR ')})`;
  });
  const rows = getDb().prepare(`
    SELECT * FROM memos
    WHERE privacy_level = 'normal'
      AND (${conditions.join(' OR ')})
  `).all(params) as Record<string, unknown>[];

  const normalizedQuery = query.trim().toLowerCase();
  const now = Date.now();
  return rows.map((row) => {
    const memo = parseMemoRow(row);
    const content = `${memo.plain_text} ${memo.raw_content}`.toLowerCase();
    const titleSummary = `${memo.ai_title || ''} ${memo.ai_summary || ''}`.toLowerCase();
    const metadata = [
      ...(memo.ai_topics || []),
      ...(memo.ai_people || []),
      ...(memo.ai_projects || []),
      ...(memo.original_tags || []),
    ].join(' ').toLowerCase();
    const matched = normalizedTerms.filter((term) => {
      const normalized = term.value.toLowerCase();
      return content.includes(normalized)
        || titleSummary.includes(normalized)
        || metadata.includes(normalized);
    });
    const matchedTerms = [...new Set(matched.map((term) => term.value))];
    let score = 0;
    if (normalizedQuery.length >= 2 && content.includes(normalizedQuery)) score += 18;
    for (const term of matched) {
      const normalized = term.value.toLowerCase();
      const fieldWeights = term.kind === 'entity'
        ? { content: 9, title: 12, metadata: 16 }
        : term.kind === 'exact'
          ? { content: 6, title: 8, metadata: 10 }
          : { content: 3, title: 4, metadata: 3 };
      if (content.includes(normalized)) score += fieldWeights.content;
      if (titleSummary.includes(normalized)) score += fieldWeights.title;
      if (metadata.includes(normalized)) score += fieldWeights.metadata;
    }
    const ageDays = Math.max(0, (now - new Date(memo.created_at).getTime()) / 86_400_000);
    score += Math.max(0, 1.2 - Math.log10(ageDays + 1) * 0.35);
    return { memo, score, matchedTerms };
  }).sort((a, b) => (
    b.score - a.score || b.memo.created_at.localeCompare(a.memo.created_at)
  )).slice(0, limit);
}

export function searchMemosByEmbedding(
  queryEmbedding: number[],
  limit: number = 20,
  minimumSimilarity: number = 0.32,
): RankedMemoSearchResult[] {
  if (queryEmbedding.length === 0) return [];
  const queryMagnitude = Math.sqrt(
    queryEmbedding.reduce((sum, value) => sum + value * value, 0),
  );
  if (!Number.isFinite(queryMagnitude) || queryMagnitude === 0) return [];

  const rows = getDb().prepare(`
    SELECT
      m.*,
      c.chunk_index AS matched_chunk_index,
      c.start_offset AS matched_chunk_start,
      c.content AS matched_chunk_content,
      c.embedding AS matched_chunk_embedding
    FROM memo_chunks c
    JOIN memos m ON m.id = c.memo_id
    WHERE m.privacy_level = 'normal'
      AND c.embedding_version LIKE 'memo-chunks-v2:%'
  `).all() as Array<Record<string, unknown> & {
    matched_chunk_index: number;
    matched_chunk_start: number;
    matched_chunk_content: string;
    matched_chunk_embedding: string;
  }>;

  const bestByMemo = new Map<string, RankedMemoSearchResult>();
  for (const row of rows) {
    const memo = parseMemoRow(row);
    try {
      const embedding = JSON.parse(row.matched_chunk_embedding) as number[];
      if (!Array.isArray(embedding) || embedding.length !== queryEmbedding.length) continue;
      let dotProduct = 0;
      let magnitude = 0;
      for (let index = 0; index < embedding.length; index += 1) {
        const value = embedding[index];
        if (!Number.isFinite(value)) {
          magnitude = 0;
          break;
        }
        dotProduct += value * queryEmbedding[index];
        magnitude += value * value;
      }
      if (magnitude === 0) continue;
      const similarity = dotProduct / (queryMagnitude * Math.sqrt(magnitude));
      if (!Number.isFinite(similarity) || similarity < minimumSimilarity) continue;
      const candidate: RankedMemoSearchResult = {
        memo,
        score: 7 + similarity * 18,
        matchedTerms: [],
        matchedChunk: row.matched_chunk_content,
        matchedChunkIndex: row.matched_chunk_index,
        matchedChunkStart: row.matched_chunk_start,
        vectorSimilarity: similarity,
      };
      const existing = bestByMemo.get(memo.id);
      if (!existing || candidate.score > existing.score) {
        bestByMemo.set(memo.id, candidate);
      }
    } catch {
      continue;
    }
  }
  return [...bestByMemo.values()].sort((a, b) => (
    b.score - a.score || b.memo.created_at.localeCompare(a.memo.created_at)
  )).slice(0, limit);
}

export function getRecentActionMemos(
  limit: number = 20,
  maximumAgeDays: number = 400,
): RankedMemoSearchResult[] {
  const cutoff = new Date(Date.now() - maximumAgeDays * 86_400_000).toISOString();
  const rows = getDb().prepare(`
    SELECT * FROM memos
    WHERE privacy_level = 'normal'
      AND created_at >= ?
      AND (ai_actions != '[]' OR ai_key_questions != '[]' OR ai_projects != '[]')
    ORDER BY created_at DESC
    LIMIT ?
  `).all(cutoff, limit) as Record<string, unknown>[];
  const now = Date.now();
  return rows.map((row) => {
    const memo = parseMemoRow(row);
    const ageDays = Math.max(0, (now - new Date(memo.created_at).getTime()) / 86_400_000);
    const matchedTerms = [
      ...(memo.ai_actions.length > 0 ? ['近期行动'] : []),
      ...(memo.ai_key_questions.length > 0 ? ['待解决问题'] : []),
      ...(memo.ai_projects.length > 0 ? memo.ai_projects.slice(0, 2) : []),
    ];
    return {
      memo,
      score: 18 + 12 * Math.exp(-ageDays / 120),
      matchedTerms,
    };
  });
}

export interface MemoChunkInput {
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  content: string;
  embedding: number[];
}

export function replaceMemoChunks(
  memoId: string,
  embeddingVersion: string,
  chunks: MemoChunkInput[],
): void {
  const db = getDb();
  const now = new Date().toISOString();
  const replace = db.transaction(() => {
    db.prepare('DELETE FROM memo_chunks WHERE memo_id = ?').run(memoId);
    const insert = db.prepare(`
      INSERT INTO memo_chunks (
        id, memo_id, chunk_index, start_offset, end_offset, content,
        embedding, embedding_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const chunk of chunks) {
      insert.run(
        `${memoId}:${chunk.chunkIndex}:${embeddingVersion}`,
        memoId,
        chunk.chunkIndex,
        chunk.startOffset,
        chunk.endOffset,
        chunk.content,
        JSON.stringify(chunk.embedding),
        embeddingVersion,
        now,
        now,
      );
    }
  });
  replace();
}

export function getRecentNormalMemos(limit: number = 10): Memo[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM memos WHERE privacy_level = 'normal' ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Record<string, unknown>[];
  return rows.map(parseMemoRow);
}
