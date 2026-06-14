import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/index';

export async function POST() {
  try {
    const db = getDb();
    
    // Begin transaction to clear all tables
    const clearData = db.transaction(() => {
      db.prepare('DELETE FROM analysis_jobs').run();
      db.prepare('DELETE FROM llm_runs').run();
      db.prepare('DELETE FROM ai_cache').run();
      db.prepare('DELETE FROM action_feedback').run();
      db.prepare('DELETE FROM memory_relations').run();
      db.prepare('DELETE FROM memory_evidence').run();
      db.prepare('DELETE FROM memory_items').run();
      db.prepare('DELETE FROM messages').run();
      db.prepare('DELETE FROM conversations').run();
      db.prepare('DELETE FROM insights').run();
      db.prepare('DELETE FROM topics').run();
      db.prepare('DELETE FROM memos').run();
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
