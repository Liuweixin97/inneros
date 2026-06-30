import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getMemos, createMemo } from '@/lib/db/memos';
import { enqueueMemoAnalysis } from '@/lib/db/analysis-jobs';
import { drainAnalysisJobs } from '@/lib/ai/job-runner';
import type { MemoFilters, MemoCreateInput } from '@/types';
import { getCurrentUser, getCurrentUserOrGuest } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user = await getCurrentUserOrGuest();

    const filters: MemoFilters = { userId: user.id };

    const query = searchParams.get('query');
    if (query) filters.query = query;

    const tag = searchParams.get('tag');
    if (tag) filters.tag = tag;

    const category = searchParams.get('category');
    if (category) filters.category = category as MemoFilters['category'];

    const emotion = searchParams.get('emotion');
    if (emotion) filters.emotion = emotion as MemoFilters['emotion'];

    const topic = searchParams.get('topic');
    if (topic) filters.topic = topic;

    const dateFrom = searchParams.get('dateFrom');
    if (dateFrom) filters.dateFrom = dateFrom;

    const dateTo = searchParams.get('dateTo');
    if (dateTo) filters.dateTo = dateTo;

    const analysisStatus = searchParams.get('analysisStatus');
    if (analysisStatus) filters.analysisStatus = analysisStatus as MemoFilters['analysisStatus'];

    const limit = searchParams.get('limit');
    if (limit) filters.limit = parseInt(limit, 10);

    const offset = searchParams.get('offset');
    if (offset) filters.offset = parseInt(offset, 10);

    const result = getMemos(filters);

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/memos error:', error);
    return NextResponse.json(
      { error: '获取笔记列表失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MemoCreateInput;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.isGuest) return NextResponse.json({ error: '游客只读，请登录后操作' }, { status: 403 });

    if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
      return NextResponse.json(
        { error: '笔记内容不能为空' },
        { status: 400 }
      );
    }

    const memo = createMemo({ ...body, user_id: user.id });
    enqueueMemoAnalysis(memo.id);
    after(() => drainAnalysisJobs(5, 2));

    return NextResponse.json(memo, { status: 201 });
  } catch (error) {
    console.error('POST /api/memos error:', error);
    return NextResponse.json(
      { error: '创建笔记失败' },
      { status: 500 }
    );
  }
}
