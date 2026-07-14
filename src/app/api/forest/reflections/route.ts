import { NextResponse } from 'next/server';
import { complete } from '@/lib/ai/gateway';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { FOREST_SCENES } from '@/lib/forest/scenes';
import type { ForestNodeId } from '@/lib/forest/types';

interface ReflectionBody {
  nodeId?: string;
  evidenceMemoIds?: unknown;
  question?: unknown;
}

interface ReflectionPayload {
  observation?: unknown;
  basis?: unknown;
  counterpoint?: unknown;
  question?: unknown;
  evidenceMemoIds?: unknown;
}

interface MemoContextRow {
  id: string;
  ai_title: string | null;
  ai_summary: string | null;
  plain_text: string;
  created_at: string;
  ai_topics: string;
  ai_emotions: string;
  ai_people: string;
  ai_projects: string;
  ai_actions: string;
  ai_key_questions: string;
}

const MAX_EVIDENCE = 8;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

function extractJson(value: string): string {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/u);
  if (fenced?.[1]) return fenced[1].trim();
  const object = value.match(/\{[\s\S]*\}/u);
  return object?.[0] ?? value;
}

function isForestNodeId(value: string): value is ForestNodeId {
  return FOREST_SCENES.some((scene) => scene.id === value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as ReflectionBody;
    const nodeId = cleanText(body.nodeId, 80);
    if (!isForestNodeId(nodeId)) {
      return NextResponse.json({ error: '未知的观察地点' }, { status: 400 });
    }

    const requestedIds = Array.isArray(body.evidenceMemoIds)
      ? [...new Set(body.evidenceMemoIds.filter((id): id is string => typeof id === 'string'))]
        .slice(0, MAX_EVIDENCE)
      : [];
    if (requestedIds.length < 2) {
      return NextResponse.json({ error: '至少需要两条原始记录，才能继续整理这条线索' }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const placeholders = requestedIds.map(() => '?').join(', ');
    const rows = getDb().prepare(`
      SELECT id, ai_title, ai_summary, plain_text, created_at,
             ai_topics, ai_emotions, ai_people, ai_projects, ai_actions, ai_key_questions
      FROM memos
      WHERE user_id = ?
        AND privacy_level = 'normal'
        AND id IN (${placeholders})
      ORDER BY created_at ASC
    `).all(user.id, ...requestedIds) as MemoContextRow[];

    if (rows.length < 2) {
      return NextResponse.json({ error: '可用证据不足，或部分记录不属于当前用户' }, { status: 403 });
    }

    const scene = FOREST_SCENES.find((item) => item.id === nodeId)!;
    const context = rows.map((memo, index) => {
      const fields = {
        topics: parseStringArray(memo.ai_topics),
        emotions: parseStringArray(memo.ai_emotions),
        people: parseStringArray(memo.ai_people),
        projects: parseStringArray(memo.ai_projects),
        actions: parseStringArray(memo.ai_actions),
        questions: parseStringArray(memo.ai_key_questions),
      };
      return [
        `记录 ${index + 1}｜ID: ${memo.id}｜日期: ${memo.created_at.slice(0, 10)}`,
        `标题: ${memo.ai_title || '未命名记录'}`,
        `摘要: ${memo.ai_summary || '无'}`,
        `结构化标记: ${JSON.stringify(fields)}`,
        `原文: ${memo.plain_text.slice(0, 1000)}`,
      ].join('\n');
    }).join('\n\n---\n\n');
    const userQuestion = cleanText(body.question, 240);

    const completion = await complete({
      task: 'forest.reflect',
      userId: user.id,
      json: true,
      temperature: 0.35,
      maxTokens: 1000,
      thinking: 'disabled',
      messages: [
        {
          role: 'system',
          content: `你是 InnerOS 的证据整理器，不是人格诊断师，也不是替用户下结论的权威。
当前观察地点：${scene.name}
观察目的：${scene.purpose}

只根据用户明确提供的记录整理一条候选观察。必须：
1. 区分记录中直接出现的内容和你的推断；使用“这些记录里”“可能”“还不足以判断”等范围词。
2. 不推断第三方动机、人格、关系性质，不做医学或心理诊断，不把共现写成因果。
3. 主动寻找一种不同解释、反例或缺失证据；如果没有，明确说“现有片段里还看不到反例”。
4. 只能引用输入中真实存在的 Memo ID。
5. 输出简体中文 JSON，不要 Markdown：
{"observation":"不超过120字","basis":"不超过100字","counterpoint":"不超过100字","question":"一个开放问题，不超过60字","evidenceMemoIds":["真实ID"]}`,
        },
        {
          role: 'user',
          content: `${userQuestion ? `用户想继续看的问题：${userQuestion}\n\n` : ''}以下是本次明确授权的记录：\n\n${context}`,
        },
      ],
    });

    const parsed = JSON.parse(extractJson(completion.content)) as ReflectionPayload;
    const allowedIds = new Set(rows.map((memo) => memo.id));
    const evidenceMemoIds = Array.isArray(parsed.evidenceMemoIds)
      ? [...new Set(parsed.evidenceMemoIds.filter(
        (id): id is string => typeof id === 'string' && allowedIds.has(id),
      ))].slice(0, 5)
      : [];
    const observation = cleanText(parsed.observation, 220);
    const basis = cleanText(parsed.basis, 180);
    const counterpoint = cleanText(parsed.counterpoint, 180);
    const nextQuestion = cleanText(parsed.question, 120);

    if (!observation || !basis || !counterpoint || !nextQuestion || evidenceMemoIds.length === 0) {
      return NextResponse.json({ error: 'AI 没有返回可验证的整理结果' }, { status: 502 });
    }

    return NextResponse.json({
      reflection: {
        observation,
        basis,
        counterpoint,
        question: nextQuestion,
        evidenceMemoIds,
        source: 'ai-inference',
        generatedAt: new Date().toISOString(),
        model: completion.model,
      },
    });
  } catch (error) {
    console.error('[forest/reflections POST]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '暂时无法继续整理这条线索' },
      { status: 500 },
    );
  }
}
