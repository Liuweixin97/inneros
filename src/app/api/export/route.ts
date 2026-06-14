import { NextResponse } from 'next/server';
import { getDb, MEMO_JSON_FIELDS, TOPIC_JSON_FIELDS, MESSAGE_JSON_FIELDS, INSIGHT_JSON_FIELDS, parseJsonFields } from '@/lib/db/index';

export async function GET() {
  try {
    const db = getDb();

    // Export all memos
    const memoRows = db.prepare('SELECT * FROM memos ORDER BY created_at DESC').all() as Record<string, unknown>[];
    const memos = memoRows.map((row) => parseJsonFields(row, MEMO_JSON_FIELDS));

    // Export all topics
    const topicRows = db.prepare('SELECT * FROM topics ORDER BY updated_at DESC').all() as Record<string, unknown>[];
    const topics = topicRows.map((row) => parseJsonFields(row, TOPIC_JSON_FIELDS));

    // Export all conversations with messages
    const convRows = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as Record<string, unknown>[];
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
    const insightRows = db.prepare('SELECT * FROM insights ORDER BY created_at DESC').all() as Record<string, unknown>[];
    const insights = insightRows.map((row) => parseJsonFields(row, INSIGHT_JSON_FIELDS));

    const memories = db.prepare('SELECT * FROM memory_items ORDER BY updated_at DESC').all();
    const memoryEvidence = db.prepare('SELECT * FROM memory_evidence ORDER BY created_at DESC').all();
    const memoryRelations = db.prepare('SELECT * FROM memory_relations ORDER BY created_at DESC').all();

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
