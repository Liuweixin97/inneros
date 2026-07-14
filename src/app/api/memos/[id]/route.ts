import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { deleteMemo, getMemoByIdForUser, updateMemo } from '@/lib/db/memos';
import { enqueueMemoAnalysis } from '@/lib/db/analysis-jobs';
import { drainAnalysisJobs } from '@/lib/ai/job-runner';
import type { Memo } from '@/types';
import { getCurrentUser } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const memo = getMemoByIdForUser(id, user.id);
  if (!memo) return NextResponse.json({ error: '笔记不存在' }, { status: 404 });
  return NextResponse.json(memo);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const existing = getMemoByIdForUser(id, user.id);
    if (!existing) return NextResponse.json({ error: '笔记不存在' }, { status: 404 });
    const body = (await request.json()) as Partial<Memo>;
    const contentChanged = typeof body.raw_content === 'string' || typeof body.plain_text === 'string';
    if (contentChanged) {
      body.analysis_status = 'pending';
      body.embedding = null;
    }
    const memo = updateMemo(existing.id, body);
    if (!memo) return NextResponse.json({ error: '笔记不存在' }, { status: 404 });
    if (contentChanged) {
      enqueueMemoAnalysis(memo.id);
      after(() => drainAnalysisJobs(5, 2, user.id));
    }
    return NextResponse.json(memo);
  } catch (error) {
    console.error('PUT /api/memos/[id] error:', error);
    return NextResponse.json({ error: '更新笔记失败' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const existing = getMemoByIdForUser(id, user.id);
  if (!existing) return NextResponse.json({ error: '笔记不存在' }, { status: 404 });
  const deleted = deleteMemo(existing.id);
  if (!deleted) return NextResponse.json({ error: '笔记不存在' }, { status: 404 });
  return NextResponse.json({ success: true });
}
