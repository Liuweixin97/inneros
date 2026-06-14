import { NextResponse } from 'next/server';
import { deleteTopic, getTopicById } from '@/lib/db/topics';
import { getMemos } from '@/lib/db/memos';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const topic = getTopicById(id);
  if (!topic) return NextResponse.json({ error: '主题不存在' }, { status: 404 });
  const { memos } = getMemos({ topic: topic.name, limit: 100 });
  return NextResponse.json({ topic, memos });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = deleteTopic(id);
  if (!deleted) return NextResponse.json({ error: '主题不存在' }, { status: 404 });
  return NextResponse.json({ success: true });
}
