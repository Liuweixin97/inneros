import { v4 as uuidv4 } from 'uuid';
import type { Conversation, ConversationMode, ChatMessage } from '@/types';
import { DEFAULT_OWNER_USER_ID, getDb, MESSAGE_JSON_FIELDS, parseJsonFields } from './index';

// ---- Internal helpers ----

function parseConversationRow(row: Record<string, unknown>): Conversation {
  return row as unknown as Conversation;
}

function parseMessageRow(row: Record<string, unknown>): ChatMessage {
  return parseJsonFields(row, MESSAGE_JSON_FIELDS) as unknown as ChatMessage;
}

// ---- Public API ----

export function getConversations(userId?: string): Conversation[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*, COUNT(m.id) as message_count
       FROM conversations c
       LEFT JOIN messages m ON m.conversation_id = c.id
       ${userId ? 'WHERE c.user_id = @userId' : ''}
       GROUP BY c.id
       ORDER BY c.updated_at DESC`
    )
    .all(userId ? { userId } : {}) as Record<string, unknown>[];
  return rows.map(parseConversationRow);
}

export function getConversationById(
  id: string,
  userId?: string,
): { conversation: Conversation; messages: ChatMessage[] } | null {
  const db = getDb();

  const convRow = db
    .prepare(
      `SELECT c.*, COUNT(m.id) as message_count
       FROM conversations c
       LEFT JOIN messages m ON m.conversation_id = c.id
       WHERE c.id = ? ${userId ? 'AND c.user_id = ?' : ''}
       GROUP BY c.id`
    )
    .get(...(userId ? [id, userId] : [id])) as Record<string, unknown> | undefined;

  if (!convRow) return null;

  const messageRows = db
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(id) as Record<string, unknown>[];

  return {
    conversation: parseConversationRow(convRow),
    messages: messageRows.map(parseMessageRow),
  };
}

export function createConversation(
  title: string,
  mode: ConversationMode = 'unified',
  userId = DEFAULT_OWNER_USER_ID,
): Conversation {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO conversations (id, user_id, title, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, userId, title, mode, now, now);

  return {
    id,
    title,
    summary: null,
    summary_status: 'pending',
    summarized_message_count: 0,
    summary_updated_at: null,
    mode,
    created_at: now,
    updated_at: now,
    message_count: 0,
  };
}

export function markConversationSummaryStatus(
  id: string,
  status: Conversation['summary_status']
): void {
  getDb().prepare('UPDATE conversations SET summary_status = ? WHERE id = ?').run(status, id);
}

export function updateConversationSummary(
  id: string,
  title: string,
  summary: string,
  messageCount: number
): void {
  const now = new Date().toISOString();
  getDb().prepare(`
    UPDATE conversations
    SET title = ?,
        summary = ?,
        summary_status = 'done',
        summarized_message_count = ?,
        summary_updated_at = ?
    WHERE id = ?
  `).run(title, summary, messageCount, now, id);
}

export function addMessage(
  conversationId: string,
  message: Omit<ChatMessage, 'id' | 'created_at' | 'reasoning_content'>
    & { reasoning_content?: string }
): ChatMessage {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  const citationsStr = JSON.stringify(message.citations || []);

  db.prepare(
    `INSERT INTO messages (
      id, conversation_id, role, content, reasoning_content,
      citations, source_type, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    conversationId,
    message.role,
    message.content,
    message.reasoning_content || '',
    citationsStr,
    message.source_type || null,
    now,
  );

  // Update conversation's updated_at
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);

  return {
    id,
    conversation_id: conversationId,
    role: message.role,
    content: message.content,
    reasoning_content: message.reasoning_content || '',
    citations: message.citations || [],
    source_type: message.source_type || null,
    created_at: now,
  };
}

export function deleteConversation(id: string, userId?: string): boolean {
  const db = getDb();
  const result = userId
    ? db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?').run(id, userId)
    : db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  return result.changes > 0;
}
