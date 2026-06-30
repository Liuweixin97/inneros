// ============================================================
// InnerOS - Chat API (Streaming SSE)
// ============================================================

import { NextRequest } from 'next/server';
import { generateRAGResponse } from '@/lib/ai/rag';
import { normalizeKnowledgeReferences } from '@/lib/ai/memo-references';
import type { ConversationMode } from '@/types';
import { getCurrentUser } from '@/lib/auth';

interface ChatRequestBody {
  message: string;
  conversation_id?: string;
  mode?: ConversationMode;
  memo_id?: string;
  thinking?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: '未登录' }, { status: 401 });
    if (user.isGuest) return Response.json({ error: '游客只读，请登录后使用 AI 对话' }, { status: 403 });
    const body: ChatRequestBody = await request.json();

    // --- Validate request ---
    if (!body.message?.trim()) {
      return Response.json(
        { error: '消息内容不能为空' },
        { status: 400 }
      );
    }

    // --- Dynamic import of DB functions (server-side only) ---
    const {
      createConversation,
      getConversationById,
      addMessage,
    } = await import('@/lib/db/conversations');

    // --- Conversation handling ---
    let conversationId = body.conversation_id;

    if (conversationId) {
      // Verify conversation exists
      const existing = getConversationById(conversationId, user.id);
      if (!existing) {
        return Response.json(
          { error: '对话不存在' },
          { status: 404 }
        );
      }
    } else {
      // Create new conversation
      const newConv = createConversation(
        body.message.slice(0, 50),
        'unified',
        user.id,
      );
      conversationId = newConv.id;
    }

    // --- Save user message ---
    addMessage(conversationId, {
      conversation_id: conversationId,
      role: 'user',
      content: body.message,
      citations: [],
      source_type: null,
      reasoning_content: '',
    });

    // --- Build conversation history from existing messages ---
    const convData = getConversationById(conversationId, user.id);
    const previousMessages = convData?.messages || [];
    // Use last 20 messages as history (excluding the latest user message we just added)
    const history = previousMessages
      .slice(0, -1) // exclude the message we just saved
      .slice(-20)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    // --- Generate RAG response ---
    const { stream: aiStream, citations, recentBaselineDays } = await generateRAGResponse(
      body.message,
      history,
      'unified',
      body.memo_id,
      body.thinking ? 'enabled' : 'disabled',
      user.id,
    );

    // --- Build SSE stream ---
    let fullContent = '';
    let fullReasoning = '';
    const finalConversationId = conversationId;

    const sseStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let streamClosed = false;

        // Helper to send SSE event
        const sendEvent = (data: Record<string, unknown>) => {
          if (streamClosed) return;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          // 1. Send citations first
          sendEvent({
            type: 'citation',
            citations: citations,
          });

          // 2. Stream content chunks
          const reader = aiStream.getReader();

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            if (value.type === 'reasoning') {
              fullReasoning += value.content;
              sendEvent({ type: 'reasoning', content: value.content });
            } else {
              fullContent += value.content;
              sendEvent({ type: 'content', content: value.content });
            }
          }

          const normalizedReferences = normalizeKnowledgeReferences(
            fullContent,
            citations.map((citation) => (
              `${citation.reference_type || 'memo'}:${citation.reference_id || citation.memo_id}`
            )),
          );
          fullContent = normalizedReferences.content;
          const finalCitations = citations.filter((citation) => (
            normalizedReferences.referencedKeys.includes(
              `${citation.reference_type || 'memo'}:${citation.reference_id || citation.memo_id}`,
            )
          ));
          sendEvent({
            type: 'replace',
            content: fullContent,
            citations: finalCitations,
          });

          // 3. Save assistant message to DB
          let assistantMessageId = '';
          try {
            const savedMsg = addMessage(finalConversationId, {
              conversation_id: finalConversationId,
              role: 'assistant',
              content: fullContent,
              reasoning_content: fullReasoning,
              citations: finalCitations,
              source_type: finalCitations.length > 0 ? 'from_notes' : 'suggestion',
            });
            assistantMessageId = savedMsg.id;
            const { summarizeConversation } = await import('@/lib/ai/conversation-summarizer');
            await summarizeConversation(finalConversationId);
          } catch (dbError) {
            console.error('[Chat API] 保存助手消息失败:', dbError);
          }

          // 4. Send done event
          sendEvent({
            type: 'done',
            conversation_id: finalConversationId,
            message_id: assistantMessageId,
            recent_baseline_days: recentBaselineDays,
          });
        } catch (error) {
          console.error('[Chat API] 流式响应错误:', error);
          try {
            sendEvent({
              type: 'error',
              error: '生成回答时发生错误，请重试',
            });
          } catch {
            streamClosed = true;
          }
        } finally {
          if (!streamClosed) {
            streamClosed = true;
            try {
              controller.close();
            } catch {
              // The client may have disconnected while the model was streaming.
            }
          }
        }
      },
    });

    // --- Return SSE response ---
    return new Response(sseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[Chat API] 请求处理失败:', error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : '处理请求时发生未知错误',
      },
      { status: 500 }
    );
  }
}
