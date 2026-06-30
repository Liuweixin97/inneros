import { NextResponse } from 'next/server';
import { deleteConversation, getConversationById } from '@/lib/db/conversations';
import { getCurrentUser } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const conversation = getConversationById(id, user.id);
  if (!conversation) return NextResponse.json({ error: '对话不存在' }, { status: 404 });
  return NextResponse.json(conversation);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const deleted = deleteConversation(id, user.id);
  if (!deleted) return NextResponse.json({ error: '对话不存在' }, { status: 404 });
  return NextResponse.json({ success: true });
}
