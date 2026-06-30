import { NextResponse } from 'next/server';
import { deleteTopic, getTopicById } from '@/lib/db/topics';
import { getMemos } from '@/lib/db/memos';
import { getCurrentUser } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const topic = getTopicById(id, user.id);
  if (!topic) return NextResponse.json({ error: '主题不存在' }, { status: 404 });
  const { memos } = getMemos({ topic: topic.name, limit: 100, userId: user.id });
  return NextResponse.json({ topic, memos });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const topic = getTopicById(id, user.id);
  if (!topic) return NextResponse.json({ error: '主题不存在' }, { status: 404 });
  const deleted = deleteTopic(id);
  if (!deleted) return NextResponse.json({ error: '主题不存在' }, { status: 404 });
  return NextResponse.json({ success: true });
}
