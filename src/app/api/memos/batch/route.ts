import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createMemosBatch } from '@/lib/db/memos';
import { enqueueMemoAnalysis } from '@/lib/db/analysis-jobs';
import { drainAnalysisJobs } from '@/lib/ai/job-runner';
import type { MemoCreateInput } from '@/types';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const body = (await request.json()) as { memos: MemoCreateInput[] };

    if (!body.memos || !Array.isArray(body.memos)) {
      return NextResponse.json(
        { error: 'Invalid request body, memos array is required' },
        { status: 400 }
      );
    }

    if (body.memos.length === 0) {
      return NextResponse.json(
        { error: 'Memos array cannot be empty' },
        { status: 400 }
      );
    }
    if (body.memos.length > 1_000) {
      return NextResponse.json({ error: '单次最多导入 1000 条笔记' }, { status: 413 });
    }
    if (body.memos.some((memo) => typeof memo.content !== 'string' || memo.content.length > 100_000)) {
      return NextResponse.json({ error: '导入内容格式错误或单条超过 10 万字符' }, { status: 400 });
    }

    const inputs = body.memos.map((memo) => ({ ...memo, user_id: user.id }));
    const { createdMemos, skippedCount } = createMemosBatch(inputs);
    for (const memo of createdMemos) {
      enqueueMemoAnalysis(memo.id);
    }
    if (createdMemos.length > 0) {
      after(() => drainAnalysisJobs(createdMemos.length * 2, 4, user.id));
    }

    return NextResponse.json({
      success: true,
      count: createdMemos.length,
      skippedCount,
      total: body.memos.length,
      memos: createdMemos,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/memos/batch error:', error);
    return NextResponse.json(
      { error: '批量创建笔记失败' },
      { status: 500 }
    );
  }
}
