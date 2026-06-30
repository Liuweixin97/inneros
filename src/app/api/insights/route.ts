import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/ai/client';
import { INSIGHT_PROMPT } from '@/lib/ai/prompts';
import { createInsight, getInsights } from '@/lib/db/insights';
import type { InsightType } from '@/types';
import { getCurrentUser, getCurrentUserOrGuest } from '@/lib/auth';

const VALID_TYPES: InsightType[] = ['recurring_question', 'methodology', 'emotion_cycle', 'strength', 'risk_pattern', 'growth_evidence'];

type GeneratedInsight = {
  title?: string;
  content?: string;
  type?: string;
  confidence?: string;
  evidence_memo_ids?: string[];
  counter_evidence_memo_ids?: string[];
};

function extractJSON(text: string) {
  const block = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (block) return block[1].trim();
  const object = text.match(/\{[\s\S]*\}/);
  return object ? object[0] : text;
}

export async function GET() {
  try {
    const user = await getCurrentUserOrGuest();
    return NextResponse.json(getInsights(user.id));
  } catch (error) {
    console.error('GET /api/insights error:', error);
    return NextResponse.json({ error: '获取洞察列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: {
      timeRange?: '7d' | '30d' | 'all';
      topicNames?: string[];
      tags?: string[];
      userGuidance?: string;
      title?: string;
      content?: string;
      saved_as_principle?: boolean;
    } = {};
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.isGuest) return NextResponse.json({ error: '游客只读，请登录后操作' }, { status: 403 });

    try {
      body = await request.json();
    } catch {
      // Empty or invalid JSON is fine
    }

    // 1. Check if this is a manual principle creation request
    if (body.title && body.content && body.saved_as_principle) {
      const created = createInsight({
        title: body.title,
        content: body.content,
        type: 'methodology', // Default type for manual principles
        confidence: 'high',
        evidence_memo_ids: [],
        saved_as_principle: true,
        user_id: user.id,
      });
      return NextResponse.json({ success: true, insight: created }, { status: 201 });
    }

    // 2. Otherwise, perform dynamic insight generation from memos
    const { getMemos } = await import('@/lib/db/memos');
    
    let dateFrom: string | undefined = undefined;
    if (body.timeRange === '7d') {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      dateFrom = date.toISOString();
    } else if (body.timeRange === '30d' || !body.timeRange) {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      dateFrom = date.toISOString();
    } // 'all' means dateFrom is undefined

    // Fetch matching memos with the date constraint
    const { memos: filteredMemos } = getMemos({
      dateFrom,
      limit: 100, // retrieve more so we can filter by tags/topics
      userId: user.id,
    });

    let resultMemos = filteredMemos.filter((memo) => memo.privacy_level === 'normal');

    // Filter by tags
    if (body.tags && body.tags.length > 0) {
      resultMemos = resultMemos.filter((memo) =>
        memo.original_tags.some((t) => body.tags?.includes(t))
      );
    }

    // Filter by topic names
    if (body.topicNames && body.topicNames.length > 0) {
      resultMemos = resultMemos.filter((memo) =>
        memo.ai_topics?.some((t) => body.topicNames?.includes(t))
      );
    }

    // Slice to maximum 30 memos
    resultMemos = resultMemos.slice(0, 30);

    if (resultMemos.length === 0) {
      return NextResponse.json({ error: '没有符合筛选条件的笔记来生成洞察' }, { status: 400 });
    }

    const context = resultMemos.map((memo, index) => `--- 笔记 ${index + 1} (ID: ${memo.id}, 日期: ${memo.created_at.slice(0, 10)}) ---
标题: ${memo.ai_title || memo.plain_text.slice(0, 30)}
摘要: ${memo.ai_summary || '未分析'}
分类: ${memo.ai_category || '未分类'}
主题: ${memo.ai_topics.join(', ') || '无'}
情绪: ${memo.ai_emotions.join(', ') || '无'}
行动项: ${memo.ai_actions.join('；') || '无'}
关键问题: ${memo.ai_key_questions.join('；') || '无'}
内容: ${memo.plain_text.slice(0, 1200)}${memo.plain_text.length > 1200 ? '...' : ''}`).join('\n\n');

    let userPrompt = `请基于以下 ${resultMemos.length} 条笔记生成洞察：\n\n${context}`;
    if (body.userGuidance?.trim()) {
      userPrompt += `\n\n特别分析要求：${body.userGuidance.trim()}`;
    }

    const response = await chatCompletion([
      { role: 'system', content: INSIGHT_PROMPT },
      { role: 'user', content: userPrompt }
    ], {
      task: 'insight.generate',
      temperature: 0.5,
      max_tokens: 4096,
      json: true,
      thinking: 'disabled',
    });

    const parsed = JSON.parse(extractJSON(response)) as { insights?: GeneratedInsight[] };
    const allowedMemoIds = new Set(resultMemos.map((memo) => memo.id));
    const seen = new Set<string>();
    const validInsights = (Array.isArray(parsed.insights) ? parsed.insights : []).flatMap((item) => {
      const title = typeof item.title === 'string' ? item.title.trim().slice(0, 80) : '';
      const content = typeof item.content === 'string' ? item.content.trim().slice(0, 1000) : '';
      const type = VALID_TYPES.includes(item.type as InsightType)
        ? item.type as InsightType
        : null;
      const evidenceIds = [...new Set(
        Array.isArray(item.evidence_memo_ids)
          ? item.evidence_memo_ids.filter((id) => allowedMemoIds.has(id))
          : [],
      )];
      if (!title || !content || !type || evidenceIds.length < 2) return [];
      const signature = `${type}:${title.toLowerCase().replace(/\s+/g, '')}`;
      if (seen.has(signature)) return [];
      seen.add(signature);
      return [{
        title,
        content,
        type,
        confidence: item.confidence === 'high' ? 'high' as const : 'medium' as const,
        evidence_memo_ids: evidenceIds,
      }];
    }).slice(0, 6);
    if (validInsights.length === 0) return NextResponse.json({ error: 'AI 没有返回可用洞察' }, { status: 502 });

    const created = validInsights.map((item) => createInsight({ ...item, user_id: user.id }));

    return NextResponse.json({ success: true, insights: created }, { status: 201 });
  } catch (error) {
    console.error('POST /api/insights error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '生成洞察失败' }, { status: 500 });
  }
}
