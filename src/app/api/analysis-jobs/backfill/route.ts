import { NextRequest, NextResponse } from 'next/server';
import {
  enqueueAnalysisBackfill,
  getAnalysisBackfillStats,
} from '@/lib/db/analysis-jobs';
import { drainBackfillJobs } from '@/lib/ai/job-runner';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET() {
  return NextResponse.json(getAnalysisBackfillStats());
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
  const enqueued = enqueueAnalysisBackfill(
    Math.max(1, Math.min(5000, Number(body.enqueue_limit) || 500)),
  );
  const processed = await drainBackfillJobs({
    extractLimit: Number(body.extract_limit) || 100,
    extractConcurrency: Number(body.extract_concurrency) || 16,
    memoryLimit: Number(body.memory_limit) || 100,
    memoryConcurrency: Number(body.memory_concurrency) || 4,
    embeddingLimit: Number(body.embedding_limit) || 100,
    embeddingConcurrency: Number(body.embedding_concurrency) || 6,
  });
  return NextResponse.json({
    enqueued,
    processed,
    stats: getAnalysisBackfillStats(),
  });
}
