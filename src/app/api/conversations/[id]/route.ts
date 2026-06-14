import { NextResponse } from 'next/server';
import { deleteConversation, getConversationById } from '@/lib/db/conversations';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const conversation = getConversationById(id);
  if (!conversation) return NextResponse.json({ error: '对话不存在' }, { status: 404 });
  return NextResponse.json(conversation);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const deleted = deleteConversation(id);
  if (!deleted) return NextResponse.json({ error: '对话不存在' }, { status: 404 });
  return NextResponse.json({ success: true });
}
