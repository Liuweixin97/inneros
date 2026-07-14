import { NextRequest, NextResponse } from 'next/server';
import { deleteInsight, getInsightById, updateInsightFeedback, updateInsightPrinciple } from '@/lib/db/insights';
import type { InsightFeedback } from '@/types';
import { getCurrentUser } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const insight = getInsightById(id, user.id);
  if (!insight) return NextResponse.json({ error: '洞察不存在' }, { status: 404 });
  return NextResponse.json(insight);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const body = await request.json();
    let insight = getInsightById(id, user.id);
    if (!insight) return NextResponse.json({ error: '洞察不存在' }, { status: 404 });

    if (body.user_feedback) {
      const feedback = body.user_feedback as InsightFeedback;
      if (!['accurate', 'somewhat', 'inaccurate', 'hidden'].includes(feedback)) {
        return NextResponse.json({ error: '无效的反馈类型' }, { status: 400 });
      }
      insight = updateInsightFeedback(id, feedback, user.id);
    }
    if (typeof body.saved_as_principle === 'boolean') {
      insight = updateInsightPrinciple(id, body.saved_as_principle, user.id);
    }

    return NextResponse.json(insight);
  } catch (error) {
    console.error('PATCH /api/insights/[id] error:', error);
    return NextResponse.json({ error: '更新洞察失败' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const deleted = deleteInsight(id, user.id);
  if (!deleted) return NextResponse.json({ error: '洞察不存在' }, { status: 404 });
  return NextResponse.json({ success: true });
}
