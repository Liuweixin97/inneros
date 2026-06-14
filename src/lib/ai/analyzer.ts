// ============================================================
// InnerOS - Memo Auto-Analyzer
// ============================================================

import { chatCompletion } from '@/lib/ai/client';
import { ANALYZE_MEMO_PROMPT } from '@/lib/ai/prompts';
import { isConcreteAction, sanitizeTopics } from '@/lib/ai/taxonomy';
import type { MemoCategory, EmotionType } from '@/types';

// --- Types ---

export interface AnalysisResult {
  title: string;
  summary: string;
  category: MemoCategory;
  topics: string[];
  emotions: EmotionType[];
  people: string[];
  projects: string[];
  actions: string[];
  key_questions: string[];
}

const VALID_CATEGORIES: MemoCategory[] = [
  '方法论', '感受', '观察', '项目', '日记', '摘录', '任务', '资料',
];

const VALID_EMOTIONS: EmotionType[] = [
  '平静', '有力量', '焦虑', '低落', '迷茫', '被认可', '愤怒', '喜悦',
];

// --- Helpers ---

/**
 * 从 AI 响应中提取 JSON（支持代码块包裹和裸 JSON）
 */
function extractJSON(text: string): string {
  // 尝试匹配 ```json ... ``` 代码块
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 尝试匹配裸 JSON 对象
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].trim();
  }

  return text.trim();
}

/**
 * 校验并清洗分析结果
 */
function validateAnalysisResult(raw: Record<string, unknown>): AnalysisResult {
  const title = typeof raw.title === 'string' ? raw.title.slice(0, 24) : '无标题';
  const summary = typeof raw.summary === 'string' ? raw.summary.slice(0, 80) : '';

  const category =
    typeof raw.category === 'string' && VALID_CATEGORIES.includes(raw.category as MemoCategory)
      ? (raw.category as MemoCategory)
      : '日记';

  const topics = Array.isArray(raw.topics)
    ? sanitizeTopics(raw.topics.filter((t): t is string => typeof t === 'string'))
    : [];

  const emotions = Array.isArray(raw.emotions)
    ? [...new Set(raw.emotions.filter(
        (e): e is EmotionType =>
          typeof e === 'string' && VALID_EMOTIONS.includes(e as EmotionType)
      ))].slice(0, 2)
    : [];

  const people = Array.isArray(raw.people)
    ? raw.people.filter((p): p is string => typeof p === 'string').slice(0, 10)
    : [];

  const projects = Array.isArray(raw.projects)
    ? raw.projects.filter((p): p is string => typeof p === 'string').slice(0, 10)
    : [];

  const actions = Array.isArray(raw.actions)
    ? [...new Set(raw.actions
        .filter((a): a is string => typeof a === 'string')
        .map((action) => action.trim())
        .filter(isConcreteAction))]
        .slice(0, 3)
    : [];

  const key_questions = Array.isArray(raw.key_questions)
    ? [...new Set(raw.key_questions
        .filter((q): q is string => typeof q === 'string')
        .map((question) => question.trim())
        .filter((question) => question.length >= 3 && question.length <= 100))]
        .slice(0, 3)
    : [];

  return {
    title,
    summary,
    category,
    topics,
    emotions,
    people,
    projects,
    actions,
    key_questions,
  };
}

// --- Public API ---

/**
 * 分析单条 Memo 内容，返回结构化结果
 */
export async function analyzeMemo(content: string): Promise<AnalysisResult> {
  if (!content.trim()) {
    throw new Error('Memo 内容为空，无法分析');
  }

  let topicVocabulary: string[] = [];
  try {
    const { getDb } = await import('@/lib/db');
    topicVocabulary = (getDb().prepare(
      'SELECT name FROM topics WHERE memo_count >= 2 ORDER BY memo_count DESC, last_seen_at DESC LIMIT 60',
    ).all() as { name: string }[]).map((row) => row.name);
  } catch {
    // Topic reuse is an optimization; analysis remains available without it.
  }

  const messages = [
    { role: 'system', content: ANALYZE_MEMO_PROMPT },
    {
      role: 'user',
      content: `${topicVocabulary.length > 0
        ? `可优先复用的已有主题词：${topicVocabulary.join('、')}\n\n`
        : ''}<memo_data>\n${content}\n</memo_data>`,
    },
  ];

  const response = await chatCompletion(messages, {
    task: 'memo.extract',
    temperature: 0.3, // 结构化任务用低温度
    max_tokens: 1024,
    json: true,
    thinking: 'disabled',
  });

  const jsonStr = extractJSON(response);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error('[Analyzer] JSON 解析失败:', response.slice(0, 300));
    throw new Error('AI 返回的分析结果格式无效');
  }

  return validateAnalysisResult(parsed);
}

/**
 * 批量分析 Memo 并更新数据库
 *
 * 逐条调用 AI，每条之间有短暂延迟以避免触发限流。
 * 失败的 Memo 会被标记为 'failed' 状态，不会中断整个批次。
 */
export async function analyzeMemos(
  memos: { id: string; content: string }[],
  concurrency = 10,
): Promise<{ success: string[]; failed: string[] }> {
  // 动态导入 DB 函数（服务端模块）
  const { getMemoById, updateMemo } = await import('@/lib/db/memos');

  const analyzeOne = async (memo: { id: string; content: string }) => {
    try {
      // 标记为分析中
      await updateMemo(memo.id, { analysis_status: 'analyzing' });

      const result = await analyzeMemo(memo.content);

      // 更新 DB
      await updateMemo(memo.id, {
        ai_title: result.title,
        ai_summary: result.summary,
        ai_category: result.category,
        ai_topics: result.topics,
        ai_emotions: result.emotions,
        ai_people: result.people,
        ai_projects: result.projects,
        ai_actions: result.actions,
        ai_key_questions: result.key_questions,
        analysis_status: 'done',
      });

      return { id: memo.id, success: true };
    } catch (error) {
      console.error(`[Analyzer] Memo ${memo.id} 分析失败:`, error);

      try {
        // 检查 memo 是否存在后再标记为失败
        const existing = await getMemoById(memo.id);
        if (existing) {
          await updateMemo(memo.id, { analysis_status: 'failed' });
        }
      } catch {
        // 忽略 DB 更新错误
      }

      return { id: memo.id, success: false };
    }
  };

  const results: Array<{ id: string; success: boolean }> = [];
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, memos.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < memos.length) {
      const memo = memos[cursor];
      cursor += 1;
      results.push(await analyzeOne(memo));
    }
  });
  await Promise.all(workers);

  const success: string[] = [];
  const failed: string[] = [];

  for (const res of results) {
    if (res.success) {
      success.push(res.id);
    } else {
      failed.push(res.id);
    }
  }

  return { success, failed };
}
