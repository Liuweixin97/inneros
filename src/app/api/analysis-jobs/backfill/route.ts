import { NextRequest, NextResponse } from 'next/server';
import {
  enqueueAnalysisBackfill,
  getAnalysisBackfillStats,
} from '@/lib/db/analysis-jobs';
import { drainBackfillJobs } from '@/lib/ai/job-runner';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (user.isGuest) return NextResponse.json({ error: '游客只读' }, { status: 403 });
  return NextResponse.json(getAnalysisBackfillStats(user.id));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as {
    enqueue_limit?: number;
    extract_limit?: number;
    extract_concurrency?: number;
    memory_limit?: number;
    memory_concurrency?: number;
    embedding_limit?: number;
    embedding_concurrency?: number;
  };
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (user.isGuest) return NextResponse.json({ error: '游客只读' }, { status: 403 });
  const enqueued = enqueueAnalysisBackfill(
    Math.max(1, Math.min(5000, Number(body.enqueue_limit) || 500)),
    user.id,
  );
  const processed = await drainBackfillJobs({
    extractLimit: Number(body.extract_limit) || 50,
    extractConcurrency: Number(body.extract_concurrency) || 4,
    memoryLimit: Number(body.memory_limit) || 50,
    memoryConcurrency: Number(body.memory_concurrency) || 2,
    embeddingLimit: Number(body.embedding_limit) || 50,
    embeddingConcurrency: Number(body.embedding_concurrency) || 3,
  }, user.id);
  return NextResponse.json({
    enqueued,
    processed,
    stats: getAnalysisBackfillStats(user.id),
  });
}
