import { chatCompletion } from '@/lib/ai/client';
import {
  getConversationById,
  markConversationSummaryStatus,
  updateConversationSummary,
} from '@/lib/db/conversations';

const SUMMARY_INTERVAL = 4;

type SummaryResult = {
  title: string;
  summary: string;
};

function parseSummary(response: string): SummaryResult {
  const parsed = JSON.parse(response) as Partial<SummaryResult>;
  const title = typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 22) : '';
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 90) : '';
  if (!title || !summary) throw new Error('对话摘要内容为空');
  return { title, summary };
}

export function conversationNeedsSummary(
  messageCount: number,
  summarizedMessageCount: number,
  force = false
): boolean {
  if (messageCount < 2) return false;
  if (force || summarizedMessageCount === 0) return true;
  return messageCount - summarizedMessageCount >= SUMMARY_INTERVAL;
}

export async function summarizeConversation(
  conversationId: string,
  force = false
): Promise<void> {
  const data = getConversationById(conversationId);
  if (!data) return;

  const { conversation, messages } = data;
  if (
    conversation.summary_status === 'generating'
    || !conversationNeedsSummary(messages.length, conversation.summarized_message_count, force)
  ) return;

  markConversationSummaryStatus(conversationId, 'generating');
  try {
    const transcript = messages.slice(-24).map((message, index) => (
      `${index + 1}. ${message.role === 'user' ? '用户' : 'InnerOS'}：${message.content.slice(0, 1200)}`
    )).join('\n\n');

    const response = await chatCompletion([
      {
        role: 'system',
        content: `你是个人对话的档案整理者。你的产物用于对话历史列表，帮助用户以后快速认出这次谈话，而不是评价用户或再次回答问题。

请严格区分：
1. 用户亲自表达的经历、感受、判断和目标。
2. 助手基于记录提出的推断或建议。
3. 双方尚未解决、仍值得继续的问题。

标题要求：
- 8-18 个汉字，直接写这次对话真正讨论的议题。
- 不使用“关于、探讨、分析、对话、请帮我”等空泛开头。
- 不照抄用户的完整首问，不写问号，不使用引号。

摘要要求：
- 30-70 个汉字，一句话。
- 优先写“用户在看清什么，以及谈话推进到了哪里”。
- 只有用户明确认同或亲自表达的内容，才能写成用户结论。
- 助手单方面提出的观点只能写成“谈话提出/正在考虑”，不能冒充用户认识。
- 没有形成结论时，明确保留尚待继续的问题。
- 不写评价、诊断、鼓励或新的建议。

严格返回 JSON：{"title":"短标题","summary":"一句话摘要"}。`,
      },
      {
        role: 'user',
        content: `对话模式：${conversation.mode === 'action' ? '行动' : '回溯'}\n\n${transcript}`,
      },
    ], {
      task: 'conversation.summarize',
      temperature: 0.2,
      max_tokens: 300,
      json: true,
      thinking: 'disabled',
    });

    const result = parseSummary(response);
    updateConversationSummary(conversationId, result.title, result.summary, messages.length);
  } catch (error) {
    markConversationSummaryStatus(conversationId, 'failed');
    console.warn(`[Conversation Summary] 摘要失败 ${conversationId}:`, error);
  }
}

export async function backfillConversationSummaries(ids: string[], concurrency = 4): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, async () => {
    while (index < ids.length) {
      const current = ids[index++];
      await summarizeConversation(current);
    }
  });
  await Promise.all(workers);
}
