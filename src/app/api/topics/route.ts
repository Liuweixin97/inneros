import { NextResponse } from 'next/server';
import { getMemosForTopicName, getTopics, rebuildTopicsFromMemos, updateTopic } from '@/lib/db/topics';
import { summarizeTopic } from '@/lib/ai/topic-summarizer';
import { getCurrentUser, getCurrentUserOrGuest } from '@/lib/auth';

async function fillMissingSummaries(userId: string) {
  const topics = getTopics(userId);
  const missing = topics.filter((topic) => !topic.summary).slice(0, 6);

  const promises = missing.map(async (topic) => {
    try {
      const memos = getMemosForTopicName(topic.name, 24, userId);
      if (memos.length === 0) return;
      const summary = await summarizeTopic(topic.name, memos, userId);
      updateTopic(topic.id, summary);
    } catch (error) {
      console.warn(`[Topics API] 生成主题摘要失败: ${topic.name}`, error);
    }
  });

  await Promise.all(promises);
}

export async function GET() {
  try {
    const user = await getCurrentUserOrGuest();
    let topics = getTopics(user.id);
    if (topics.length === 0) topics = rebuildTopicsFromMemos(user.id);
    return NextResponse.json(topics);
  } catch (error) {
    console.error('GET /api/topics error:', error);
    return NextResponse.json(
      { error: '获取主题列表失败' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.isGuest) return NextResponse.json({ error: '游客只读，请登录后操作' }, { status: 403 });
    rebuildTopicsFromMemos(user.id);
    await fillMissingSummaries(user.id);
    return NextResponse.json({ success: true, topics: getTopics(user.id) });
  } catch (error) {
    console.error('POST /api/topics error:', error);
    return NextResponse.json(
      { error: '重新分析主题失败' },
      { status: 500 }
    );
  }
}
