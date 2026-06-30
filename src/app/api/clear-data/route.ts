import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/index';
import { getCurrentUser } from '@/lib/auth';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.isGuest) return NextResponse.json({ error: '游客只读' }, { status: 403 });
    const db = getDb();
    
    // Begin transaction to clear all tables
    const clearData = db.transaction(() => {
      db.prepare('DELETE FROM analysis_jobs WHERE user_id = ?').run(user.id);
      db.prepare('DELETE FROM llm_runs WHERE user_id = ?').run(user.id);
      db.prepare('DELETE FROM ai_cache WHERE user_id = ? OR cache_key LIKE ?').run(user.id, `%:${user.id}`);
      db.prepare(`
        DELETE FROM action_feedback
        WHERE user_id = ?
          OR source_memo_id IN (SELECT id FROM memos WHERE user_id = ?)
      `).run(user.id, user.id);
      db.prepare(`
        DELETE FROM memory_relations
        WHERE source_memory_id IN (SELECT id FROM memory_items WHERE user_id = ?)
           OR target_memory_id IN (SELECT id FROM memory_items WHERE user_id = ?)
      `).run(user.id, user.id);
      db.prepare(`
        DELETE FROM memory_evidence
        WHERE memory_id IN (SELECT id FROM memory_items WHERE user_id = ?)
           OR memo_id IN (SELECT id FROM memos WHERE user_id = ?)
      `).run(user.id, user.id);
      db.prepare('DELETE FROM memory_items WHERE user_id = ?').run(user.id);
      db.prepare(`
        DELETE FROM messages
        WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)
      `).run(user.id);
      db.prepare('DELETE FROM conversations WHERE user_id = ?').run(user.id);
      db.prepare('DELETE FROM insights WHERE user_id = ?').run(user.id);
      db.prepare('DELETE FROM topics WHERE user_id = ?').run(user.id);
      db.prepare('DELETE FROM memo_chunks WHERE user_id = ? OR memo_id IN (SELECT id FROM memos WHERE user_id = ?)').run(user.id, user.id);
      db.prepare('DELETE FROM memos WHERE user_id = ?').run(user.id);
    });
    
    clearData();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/clear-data error:', error);
    return NextResponse.json(
      { error: '清除数据失败' },
      { status: 500 }
    );
  }
}
