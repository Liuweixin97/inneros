import { NextRequest, NextResponse } from 'next/server';
import { getConversations, createConversation } from '@/lib/db/conversations';
import type { ConversationMode } from '@/types';
import { backfillConversationSummaries, conversationNeedsSummary } from '@/lib/ai/conversation-summarizer';

export async function GET() {
  try {
    let conversations = getConversations();
    const pendingIds = conversations
      .filter((conversation) => (
        conversation.summary_status !== 'generating'
        && conversationNeedsSummary(conversation.message_count, conversation.summarized_message_count)
      ))
      .slice(0, 12)
      .map((conversation) => conversation.id);
    if (pendingIds.length > 0) {
      await backfillConversationSummaries(pendingIds);
      conversations = getConversations();
    }
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

    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      return NextResponse.json(
        { error: '对话标题不能为空' },
        { status: 400 }
      );
    }

    const mode: ConversationMode = 'unified';
    const conversation = createConversation(body.title.trim(), mode);

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('POST /api/conversations error:', error);
    return NextResponse.json(
      { error: '创建对话失败' },
      { status: 500 }
    );
  }
}
