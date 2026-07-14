import 'server-only';

import { getDb } from './index';

export function clearUserData(userId: string): void {
  const db = getDb();
  const clear = db.transaction(() => {
    db.prepare('DELETE FROM forest_profiles WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM analysis_jobs WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM llm_runs WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM ai_cache WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM action_feedback WHERE user_id = ?').run(userId);
    db.prepare(`
      DELETE FROM memory_relations
      WHERE source_memory_id IN (SELECT id FROM memory_items WHERE user_id = ?)
         OR target_memory_id IN (SELECT id FROM memory_items WHERE user_id = ?)
    `).run(userId, userId);
    db.prepare(`
      DELETE FROM memory_evidence
      WHERE memory_id IN (SELECT id FROM memory_items WHERE user_id = ?)
         OR memo_id IN (SELECT id FROM memos WHERE user_id = ?)
    `).run(userId, userId);
    db.prepare('DELETE FROM memory_items WHERE user_id = ?').run(userId);
    db.prepare(`
      DELETE FROM messages
      WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)
    `).run(userId);
    db.prepare('DELETE FROM conversations WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM insights WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM topics WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM memo_chunks WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM memos WHERE user_id = ?').run(userId);
  });
  clear();
}
