import { NextResponse } from 'next/server';
import { getDb, MEMO_JSON_FIELDS, TOPIC_JSON_FIELDS, MESSAGE_JSON_FIELDS, INSIGHT_JSON_FIELDS, parseJsonFields } from '@/lib/db/index';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.isGuest) return NextResponse.json({ error: '游客只读' }, { status: 403 });
    const db = getDb();

    // Export all memos
    const memoRows = db.prepare('SELECT * FROM memos WHERE user_id = ? ORDER BY created_at DESC').all(user.id) as Record<string, unknown>[];
    const memos = memoRows.map((row) => parseJsonFields(row, MEMO_JSON_FIELDS));

    // Export all topics
    const topicRows = db.prepare('SELECT * FROM topics WHERE user_id = ? ORDER BY updated_at DESC').all(user.id) as Record<string, unknown>[];
    const topics = topicRows.map((row) => parseJsonFields(row, TOPIC_JSON_FIELDS));

    // Export all conversations with messages
    const convRows = db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC').all(user.id) as Record<string, unknown>[];
    const conversations = convRows.map((conv) => {
      const messageRows = db
        .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
        .all(conv.id as string) as Record<string, unknown>[];
      return {
        ...conv,
        messages: messageRows.map((row) => parseJsonFields(row, MESSAGE_JSON_FIELDS)),
      };
    });

    // Export all insights
    const insightRows = db.prepare('SELECT * FROM insights WHERE user_id = ? ORDER BY created_at DESC').all(user.id) as Record<string, unknown>[];
    const insights = insightRows.map((row) => parseJsonFields(row, INSIGHT_JSON_FIELDS));

    const memories = db.prepare('SELECT * FROM memory_items WHERE user_id = ? ORDER BY updated_at DESC').all(user.id);
    const memoryEvidence = db.prepare(`
      SELECT e.*
      FROM memory_evidence e
      JOIN memory_items m ON m.id = e.memory_id
      WHERE m.user_id = ?
      ORDER BY e.created_at DESC
    `).all(user.id);
    const memoryRelations = db.prepare(`
      SELECT r.*
      FROM memory_relations r
      JOIN memory_items m ON m.id = r.source_memory_id
      WHERE m.user_id = ?
      ORDER BY r.created_at DESC
    `).all(user.id);

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      data: {
        memos,
        topics,
        conversations,
        insights,
        memories,
        memory_evidence: memoryEvidence,
        memory_relations: memoryRelations,
      },
    };

    const jsonStr = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonStr, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="inneros-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error('GET /api/export error:', error);
    return NextResponse.json(
      { error: '导出数据失败' },
      { status: 500 }
    );
  }
}
