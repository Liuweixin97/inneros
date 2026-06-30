import { v4 as uuidv4 } from 'uuid';
import type { Topic } from '@/types';
import { DEFAULT_OWNER_USER_ID, getDb, TOPIC_JSON_FIELDS, parseJsonFields, stringifyJsonFields } from './index';

function parseTopicRow(row: Record<string, unknown>): Topic {
  return parseJsonFields(row, TOPIC_JSON_FIELDS) as unknown as Topic;
}

export function getTopics(userId?: string): Topic[] {
  const db = getDb();
  const rows = (userId
    ? db.prepare('SELECT * FROM topics WHERE user_id = ? ORDER BY last_seen_at DESC').all(userId)
    : db.prepare('SELECT * FROM topics ORDER BY last_seen_at DESC').all()) as Record<string, unknown>[];
  return rows.map(parseTopicRow);
}

export function getTopicById(id: string, userId?: string): Topic | null {
  const db = getDb();
  const row = (userId
    ? db.prepare('SELECT * FROM topics WHERE id = ? AND user_id = ?').get(id, userId)
    : db.prepare('SELECT * FROM topics WHERE id = ?').get(id)) as Record<string, unknown> | undefined;
  if (!row) return null;
  return parseTopicRow(row);
}

export function getTopicByName(name: string): Topic | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM topics WHERE name = ?').get(name) as Record<string, unknown> | undefined;
  if (!row) return null;
  return parseTopicRow(row);
}

export function updateTopic(id: string, updates: Partial<Topic>): Topic | null {
  const db = getDb();
  const existing = getTopicById(id);
  if (!existing) return null;

  const safeUpdates: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
  delete safeUpdates.id;
  delete safeUpdates.created_at;

  const dbUpdates = stringifyJsonFields(safeUpdates, TOPIC_JSON_FIELDS);
  const setClauses = Object.keys(dbUpdates).map((key) => `${key} = @${key}`);
  db.prepare(`UPDATE topics SET ${setClauses.join(', ')} WHERE id = @id`).run({ ...dbUpdates, id });

  return getTopicById(id);
}

export function upsertTopic(name: string): Topic {
  const db = getDb();
  const existing = getTopicByName(name);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare('UPDATE topics SET memo_count = memo_count + 1, last_seen_at = ?, updated_at = ? WHERE id = ?').run(now, now, existing.id);
    return getTopicById(existing.id)!;
  }
  const id = uuidv4();
  db.prepare(`INSERT INTO topics (id, name, memo_count, first_seen_at, last_seen_at, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?, ?)`).run(id, name, now, now, now, now);
  return getTopicById(id)!;
}

export function rebuildTopicsFromMemos(userId?: string): Topic[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, created_at, ai_topics
    FROM memos
    WHERE ai_topics IS NOT NULL
      AND analysis_status = 'done'
      AND privacy_level = 'normal'
      ${userId ? 'AND user_id = @userId' : ''}
  `).all(userId ? { userId } : {}) as { id: string; created_at: string; ai_topics: string }[];
  const now = new Date().toISOString();
  const topicMap = new Map<string, { count: number; first: string; last: string }>();

  rows.forEach((row) => {
    let topics: string[] = [];
    try { topics = JSON.parse(row.ai_topics); } catch { topics = []; }
    topics.filter(Boolean).forEach((name) => {
      const current = topicMap.get(name);
      if (!current) topicMap.set(name, { count: 1, first: row.created_at, last: row.created_at });
      else topicMap.set(name, { count: current.count + 1, first: row.created_at < current.first ? row.created_at : current.first, last: row.created_at > current.last ? row.created_at : current.last });
    });
  });

  const transaction = db.transaction(() => {
    if (userId) db.prepare('DELETE FROM topics WHERE user_id = ?').run(userId);
    else db.prepare('DELETE FROM topics').run();
    const insert = db.prepare(`INSERT INTO topics (id, user_id, name, memo_count, first_seen_at, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const [name, meta] of topicMap.entries()) {
      insert.run(uuidv4(), userId || DEFAULT_OWNER_USER_ID, name, meta.count, meta.first, meta.last, now, now);
    }
  });
  transaction();
  return getTopics(userId);
}

export function getMemosForTopicName(name: string, limit: number = 30) {
  const rows = getDb()
    .prepare(
      `SELECT id, plain_text, created_at, ai_title, ai_summary, ai_topics, ai_emotions, ai_people, ai_projects, ai_actions, ai_key_questions
       FROM memos
       WHERE ai_topics LIKE @topic
         AND analysis_status = 'done'
         AND privacy_level = 'normal'
       ORDER BY created_at DESC
       LIMIT @limit`
    )
    .all({ topic: `%"${name}"%`, limit }) as Array<{
      id: string;
      plain_text: string;
      created_at: string;
      ai_title: string | null;
      ai_summary: string | null;
      ai_topics: string;
      ai_emotions: string;
      ai_people: string;
      ai_projects: string;
      ai_actions: string;
      ai_key_questions: string;
    }>;

  return rows.map((row) => parseJsonFields(row, ['ai_topics', 'ai_emotions', 'ai_people', 'ai_projects', 'ai_actions', 'ai_key_questions']));
}

export function deleteTopic(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM topics WHERE id = ?').run(id);
  return result.changes > 0;
}
