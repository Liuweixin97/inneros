import { chatCompletion } from '@/lib/ai/client';
import { TOPIC_SUMMARY_PROMPT } from '@/lib/ai/prompts';
import type { Topic } from '@/types';

interface TopicSummaryResult {
  description: string | null;
  summary: string | null;
  key_questions: string[];
  stable_insights: string[];
  related_people: string[];
  related_projects: string[];
  status: Topic['status'];
}

const VALID_STATUS: Topic['status'][] = ['active', 'dormant', 'resolved'];

function extractJSON(text: string): string {
  const block = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (block) return block[1].trim();
  const object = text.match(/\{[\s\S]*\}/);
  return object ? object[0].trim() : text.trim();
}

function toStringArray(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, limit)
    : [];
}

function validateTopicSummary(raw: Record<string, unknown>): TopicSummaryResult {
  const status = typeof raw.status === 'string' && VALID_STATUS.includes(raw.status as Topic['status'])
    ? raw.status as Topic['status']
    : 'active';

  return {
    description: typeof raw.description === 'string' ? raw.description.slice(0, 80) : null,
    summary: typeof raw.summary === 'string' ? raw.summary.slice(0, 260) : null,
    key_questions: toStringArray(raw.key_questions, 6),
    stable_insights: toStringArray(raw.stable_insights, 6),
    related_people: toStringArray(raw.related_people, 8),
    related_projects: toStringArray(raw.related_projects, 8),
    status,
  };
}

export async function summarizeTopic(
  topicName: string,
  memos: Array<Record<string, unknown>>
): Promise<TopicSummaryResult> {
  if (memos.length === 0) {
    return {
      description: null,
      summary: null,
      key_questions: [],
      stable_insights: [],
      related_people: [],
      related_projects: [],
      status: 'active',
    };
  }

  const context = memos.map((memo, index) => {
    const topics = Array.isArray(memo.ai_topics) ? memo.ai_topics.join(', ') : '';
    const emotions = Array.isArray(memo.ai_emotions) ? memo.ai_emotions.join(', ') : '';
    const actions = Array.isArray(memo.ai_actions) ? memo.ai_actions.join('；') : '';
    const questions = Array.isArray(memo.ai_key_questions) ? memo.ai_key_questions.join('；') : '';
    const people = Array.isArray(memo.ai_people) ? memo.ai_people.join(', ') : '';
    const projects = Array.isArray(memo.ai_projects) ? memo.ai_projects.join(', ') : '';
    const plainText = typeof memo.plain_text === 'string' ? memo.plain_text : '';

    return `--- 笔记 ${index + 1} ---
日期: ${String(memo.created_at || '').slice(0, 10)}
标题: ${memo.ai_title || plainText.slice(0, 30)}
摘要: ${memo.ai_summary || '无'}
主题: ${topics || '无'}
情绪: ${emotions || '无'}
人物: ${people || '无'}
项目: ${projects || '无'}
行动项: ${actions || '无'}
关键问题: ${questions || '无'}
原文: ${plainText.slice(0, 900)}${plainText.length > 900 ? '...' : ''}`;
  }).join('\n\n');

  const response = await chatCompletion([
    { role: 'system', content: TOPIC_SUMMARY_PROMPT },
    {
      role: 'user',
      content: `当前日期：${new Date().toISOString().slice(0, 10)}
主题名称：${topicName}

<memo_data>
${context}
</memo_data>`,
    },
  ], {
    task: 'topic.summarize',
    temperature: 0.4,
    max_tokens: 1200,
    json: true,
    thinking: 'disabled',
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(extractJSON(response));
  } catch {
    throw new Error('AI 返回的主题摘要格式无效');
  }

  return validateTopicSummary(parsed);
}
