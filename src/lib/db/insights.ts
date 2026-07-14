import { v4 as uuidv4 } from 'uuid';
import type { Insight, InsightType, InsightFeedback } from '@/types';
import { getDb, INSIGHT_JSON_FIELDS, parseJsonFields } from './index';

function parseInsightRow(row: Record<string, unknown>): Insight {
  const parsed = parseJsonFields(row, INSIGHT_JSON_FIELDS) as Record<string, unknown>;
  return {
    ...parsed,
    saved_as_principle: Boolean(parsed.saved_as_principle),
  } as unknown as Insight;
}

export function getInsights(userId?: string): Insight[] {
  const db = getDb();
  const rows = (userId
    ? db.prepare('SELECT * FROM insights WHERE user_id = ? ORDER BY created_at DESC').all(userId)
    : db.prepare('SELECT * FROM insights ORDER BY created_at DESC').all()) as Record<string, unknown>[];
  return rows.map(parseInsightRow);
}

export function getInsightById(id: string, userId?: string): Insight | null {
  const db = getDb();
  const row = (userId
    ? db.prepare('SELECT * FROM insights WHERE id = ? AND user_id = ?').get(id, userId)
    : db.prepare('SELECT * FROM insights WHERE id = ?').get(id)) as Record<string, unknown> | undefined;
  if (!row) return null;
  return parseInsightRow(row);
}

export function createInsight(input: {
  title: string;
  content: string;
  type: InsightType;
  confidence: 'high' | 'medium' | 'low';
  evidence_memo_ids: string[];
  saved_as_principle?: boolean;
  user_id?: string;
}): Insight {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  const saved = input.saved_as_principle ? 1 : 0;
  db.prepare(
    `INSERT INTO insights (id, user_id, title, content, type, confidence, evidence_memo_ids, created_at, saved_as_principle)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, input.user_id || 'liuweixin', input.title, input.content, input.type, input.confidence, JSON.stringify(input.evidence_memo_ids), now, saved);
  return getInsightById(id)!;
}

export function updateInsightFeedback(id: string, feedback: InsightFeedback, userId?: string): Insight | null {
  const db = getDb();
  if (userId) db.prepare('UPDATE insights SET user_feedback = ? WHERE id = ? AND user_id = ?').run(feedback, id, userId);
  else db.prepare('UPDATE insights SET user_feedback = ? WHERE id = ?').run(feedback, id);
  return getInsightById(id, userId);
}

export function updateInsightPrinciple(id: string, saved: boolean, userId?: string): Insight | null {
  const db = getDb();
  if (userId) db.prepare('UPDATE insights SET saved_as_principle = ? WHERE id = ? AND user_id = ?').run(saved ? 1 : 0, id, userId);
  else db.prepare('UPDATE insights SET saved_as_principle = ? WHERE id = ?').run(saved ? 1 : 0, id);
  return getInsightById(id, userId);
}

export function deleteInsight(id: string, userId?: string): boolean {
  const db = getDb();
  const result = userId
    ? db.prepare('DELETE FROM insights WHERE id = ? AND user_id = ?').run(id, userId)
    : db.prepare('DELETE FROM insights WHERE id = ?').run(id);
  return result.changes > 0;
}
