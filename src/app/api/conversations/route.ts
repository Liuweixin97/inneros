import { NextRequest, NextResponse } from 'next/server';
import { getConversations, createConversation } from '@/lib/db/conversations';
import type { ConversationMode } from '@/types';
import { getCurrentUser, getCurrentUserOrGuest } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUserOrGuest();
    const conversations = getConversations(user.id);
    return NextResponse.json(conversations);
  } catch (error) {
    console.error('GET /api/conversations error:', error);
    return NextResponse.json(
      { error: '获取对话列表失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      return NextResponse.json(
        { error: '对话标题不能为空' },
        { status: 400 }
      );
    }

    const mode: ConversationMode = 'unified';
    const conversation = createConversation(body.title.trim(), mode, user.id);

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('POST /api/conversations error:', error);
    return NextResponse.json(
      { error: '创建对话失败' },
      { status: 500 }
    );
  }
}
