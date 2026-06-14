import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createMemosBatch } from '@/lib/db/memos';
import { enqueueMemoAnalysis } from '@/lib/db/analysis-jobs';
import { drainAnalysisJobs } from '@/lib/ai/job-runner';
import type { MemoCreateInput } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
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

    const createdMemos = createMemosBatch(body.memos);
    for (const memo of createdMemos) {
      enqueueMemoAnalysis(memo.id);
    }
    after(() => drainAnalysisJobs(createdMemos.length * 2, 10));

    return NextResponse.json({
      success: true,
      count: createdMemos.length,
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
