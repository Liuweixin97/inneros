import { NextResponse } from 'next/server';
import { streamText } from '@/lib/ai/gateway';
import { buildCompanionMessages, parseCompanionOutput } from '@/lib/game/companion-prompt';
import { getMemoById } from '@/lib/db/memos';
import { getCompanionSession } from '@/lib/db/game';
import type { DialogueMode, MapLocation } from '@/types';

// POST /api/game/companion — AI 同行者对话（流式响应）
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      message: string;
      sessionId?: string;
      location: MapLocation;
      dialogueMode: DialogueMode;
      authorizedMemoIds?: string[];
      recentUserAction?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    };

    if (!body.message || body.message.trim().length === 0) {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    }

    // 获取授权 Memo
    let authorizedMemoIds = body.authorizedMemoIds ?? [];

    // 如果提供了 sessionId，从会话获取授权 Memo
    if (body.sessionId) {
      const session = getCompanionSession(body.sessionId);
      if (session) {
        authorizedMemoIds = session.authorizedMemoIds;
      }
    }

    // 加载 Memo 内容（最多 5 条，避免 context 过大）
    const authorizedMemos = authorizedMemoIds
      .slice(0, 5)
      .map((id) => getMemoById(id))
      .filter((m) => m !== null && m.privacy_level === 'normal');

    // 构建消息列表
    const messages = buildCompanionMessages(body.message, {
      location: body.location ?? 'fireside',
      dialogueMode: body.dialogueMode ?? 'listen',
      authorizedMemos,
      recentUserAction: body.recentUserAction,
      conversationHistory: body.conversationHistory?.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // 流式响应
    const stream = await streamText({
      task: 'chat.respond',
      messages,
      temperature: 0.7,
      maxTokens: 300, // 控制回复长度
    });

    // 将 ReadableStream<string> 转为 SSE 流
    const encoder = new TextEncoder();
    const responseStream = new ReadableStream({
      async start(controller) {
        const reader = stream.getReader();
        let fullText = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            fullText += value;

            // 发送 SSE chunk
            const chunk = JSON.stringify({ type: 'chunk', content: value });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }

          // 发送完成信号和结构化解析
          const parsed = parseCompanionOutput(fullText);
          const done = JSON.stringify({
            type: 'done',
            text: fullText,
            isInference: parsed.isInference,
            suggestedActions: parsed.suggestedActions,
          });
          controller.enqueue(encoder.encode(`data: ${done}\n\n`));
          controller.close();
        } catch (error) {
          const errMsg = JSON.stringify({ type: 'error', message: '同行者暂时无法说话' });
          controller.enqueue(encoder.encode(`data: ${errMsg}\n\n`));
          controller.close();
          console.error('[game/companion]', error);
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[game/companion POST]', error);
    return NextResponse.json({ error: '同行者暂时无法响应' }, { status: 500 });
  }
}
