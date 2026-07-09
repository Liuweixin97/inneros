import { NextResponse } from 'next/server';
import { getCurrentUserOrGuest } from '@/lib/auth';
import { streamText } from '@/lib/ai/gateway';
import { buildCompanionMessages, parseCompanionOutput } from '@/lib/game/companion-prompt';
import { getMemoByIdForUser } from '@/lib/db/memos';
import {
  createCompanionSession,
  getCompanionSessionForWorld,
  getOrCreateWorld,
  updateSessionAuthorizedMemos,
  updateSessionDialogueMode,
} from '@/lib/db/game';
import type { DialogueMode, MapLocation, Memo } from '@/types';

// POST /api/game/companion — AI 同行者对话（流式响应）
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      message: string;
      worldId?: string;
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

    const user = await getCurrentUserOrGuest();
    const world = getOrCreateWorld(user.id);

    // 获取授权 Memo，并将本次明确授权写回会话。
    const requestedMemoIds = [...new Set(body.authorizedMemoIds ?? [])]
      .filter((id): id is string => typeof id === 'string')
      .slice(0, 3);
    if (requestedMemoIds.length < 1 || requestedMemoIds.length > 3) {
      return NextResponse.json({ error: '请先选择 1-3 段本次愿意带入的记忆' }, { status: 400 });
    }
    const authorizedMemos = requestedMemoIds
      .map((id) => getMemoByIdForUser(id, user.id))
      .filter((m): m is Memo => m !== null && m.privacy_level === 'normal');
    if (authorizedMemos.length !== requestedMemoIds.length) {
      return NextResponse.json({ error: '本次授权的记忆不存在或无权访问' }, { status: 403 });
    }
    const authorizedMemoIds = authorizedMemos.map((memo) => memo.id);
    let session = body.sessionId ? getCompanionSessionForWorld(body.sessionId, world.id) : null;

    if (!session) {
      session = createCompanionSession({
        worldId: world.id,
        companionType: 'llm',
        dialogueMode: body.dialogueMode ?? 'listen',
        authorizedMemoIds,
      });
    } else {
      updateSessionDialogueMode(session.id, body.dialogueMode ?? session.dialogueMode);
      updateSessionAuthorizedMemos(session.id, authorizedMemoIds);
    }

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
      maxTokens: 400, // 控制回复长度，organize 模式需要更多空间
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
            sessionId: session.id,
            sourceMemoIds: authorizedMemos.map((memo) => memo.id),
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
