import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/index';

export async function POST() {
  try {
    const db = getDb();

    // Delete all data in the correct order (respecting foreign keys)
    db.exec(`
      DELETE FROM analysis_jobs;
      DELETE FROM llm_runs;
      DELETE FROM ai_cache;
      DELETE FROM action_feedback;
      DELETE FROM memory_relations;
      DELETE FROM memory_evidence;
      DELETE FROM memory_items;
      DELETE FROM messages;
      DELETE FROM conversations;
      DELETE FROM insights;
      DELETE FROM topics;
      DELETE FROM memos;
    `);

    return NextResponse.json({
      success: true,
      message: '所有数据已清除',
    });
  } catch (error) {
    console.error('POST /api/settings/clear-data error:', error);
    return NextResponse.json(
      { error: '清除数据失败' },
      { status: 500 }
    );
  }
}
