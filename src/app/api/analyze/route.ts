import { NextRequest } from 'next/server';
import { enqueueMemoAnalysis, getAnalysisJob } from '@/lib/db/analysis-jobs';
import { drainAnalysisJobs } from '@/lib/ai/job-runner';
import { getMemoById, getMemoByIdForUser } from '@/lib/db/memos';
import { getCurrentUser } from '@/lib/auth';

interface AnalyzeRequestBody {
  memo_id?: string;
  memo_ids?: string[];
}

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ error: '未登录' }, { status: 401 });
    const body = await request.json() as AnalyzeRequestBody;
    const ids = body.memo_id
      ? [body.memo_id]
      : Array.isArray(body.memo_ids) ? body.memo_ids : [];

    if (ids.length === 0) {
      return Response.json({ error: '请提供 memo_id 或 memo_ids' }, { status: 400 });
    }
    if (ids.length > 50) {
      return Response.json({ error: '单次最多分析 50 条笔记' }, { status: 400 });
    }

    const notFound: string[] = [];
    const jobs = ids.flatMap((id) => {
      const memo = getMemoByIdForUser(id, user.id);
      if (!memo) {
        notFound.push(id);
        return [];
      }
      const force = memo.analysis_status === 'done';
      return [enqueueMemoAnalysis(memo.id, force)];
    });

    if (jobs.length === 0) {
      return Response.json({ error: '未找到任何笔记', not_found: notFound }, { status: 404 });
    }

    await drainAnalysisJobs(Math.max(10, jobs.length), 4, user.id);
    const updatedJobs = jobs.map((job) => getAnalysisJob(job.id));
    const succeededIds = updatedJobs
      .filter((job) => job?.status === 'succeeded')
      .map((job) => job!.entity_id);
    const failedIds = updatedJobs
      .filter((job) => job?.status === 'failed' || job?.status === 'dead')
      .map((job) => job!.entity_id);
    const updatedMemos = succeededIds.map((id) => getMemoById(id)).filter(Boolean);

    if (ids.length === 1) {
      const memo = getMemoByIdForUser(ids[0], user.id);
      const job = updatedJobs[0];
      if (!job || job.status !== 'succeeded') {
        return Response.json({
          error: job?.last_error || '分析任务尚未完成',
          job,
          memo,
        }, { status: 500 });
      }
      return Response.json({
        success: true,
        job,
        memo,
        ...(notFound.length > 0 ? { not_found: notFound } : {}),
      });
    }

    return Response.json({
      success: true,
      total: ids.length,
      analyzed: succeededIds.length,
      failed: failedIds.length,
      memos: updatedMemos,
      failed_ids: failedIds,
      jobs: updatedJobs,
      ...(notFound.length > 0 ? { not_found: notFound } : {}),
    });
  } catch (error) {
    console.error('[Analyze API] 请求处理失败:', error);
    return Response.json({
      error: error instanceof Error ? error.message : '分析笔记时发生未知错误',
    }, { status: 500 });
  }
}
