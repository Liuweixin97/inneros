import { NextRequest, NextResponse } from 'next/server';
import { deleteInsight, getInsightById, updateInsightFeedback, updateInsightPrinciple } from '@/lib/db/insights';
import type { InsightFeedback } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const insight = getInsightById(id);
  if (!insight) return NextResponse.json({ error: '洞察不存在' }, { status: 404 });
  return NextResponse.json(insight);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    let insight = getInsightById(id);
    if (!insight) return NextResponse.json({ error: '洞察不存在' }, { status: 404 });

    if (body.user_feedback) {
      insight = updateInsightFeedback(id, body.user_feedback as InsightFeedback);
    }
    if (typeof body.saved_as_principle === 'boolean') {
      insight = updateInsightPrinciple(id, body.saved_as_principle);
    }

    return NextResponse.json(insight);
  } catch (error) {
    console.error('PATCH /api/insights/[id] error:', error);
    return NextResponse.json({ error: '更新洞察失败' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const deleted = deleteInsight(id);
  if (!deleted) return NextResponse.json({ error: '洞察不存在' }, { status: 404 });
  return NextResponse.json({ success: true });
}
