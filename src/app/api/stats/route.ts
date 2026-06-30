import { NextResponse } from 'next/server';
import { getMemoStats, getRecentMemos } from '@/lib/db/memos';
import { getDb } from '@/lib/db/index';
import { rebuildTopicsFromMemos } from '@/lib/db/topics';
import { getCurrentUserOrGuest } from '@/lib/auth';

export async function GET() {
  try {
    const db = getDb();
    const user = await getCurrentUserOrGuest();
    const stats = getMemoStats(user.id);
    const recentMemos = getRecentMemos(6, user.id);

    let { total_topics } = db
      .prepare('SELECT COUNT(*) as total_topics FROM topics WHERE user_id = ?')
      .get(user.id) as { total_topics: number };

    if (total_topics === 0) {
      total_topics = rebuildTopicsFromMemos(user.id).length;
    }

    const { total_conversations } = db
      .prepare('SELECT COUNT(*) as total_conversations FROM conversations WHERE user_id = ?')
      .get(user.id) as { total_conversations: number };

    const { total_insights } = db
      .prepare('SELECT COUNT(*) as total_insights FROM insights WHERE user_id = ?')
      .get(user.id) as { total_insights: number };

    // Get recent topic names
    const recentTopicRows = db
      .prepare('SELECT name FROM topics WHERE user_id = ? ORDER BY updated_at DESC LIMIT 5')
      .all(user.id) as { name: string }[];

    return NextResponse.json({
      total_memos: stats.total,
      total_topics,
      total_conversations,
      total_insights,
      recent_memos: recentMemos,
      top_tags: stats.topTags,
      recent_topics: recentTopicRows.map((r) => r.name),
      today_memo_count: stats.today,
      this_week_memo_count: stats.thisWeek,
    });
  } catch (error) {
    console.error('GET /api/stats error:', error);
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}
