import { NextRequest, NextResponse } from 'next/server';
import { drainAnalysisJobs } from '@/lib/ai/job-runner';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { limit?: number; concurrency?: number };
  const limit = Math.max(1, Math.min(100, Number(body.limit) || 20));
  const concurrency = Math.max(1, Math.min(20, Number(body.concurrency) || 4));
  const result = await drainAnalysisJobs(limit, concurrency);
  return NextResponse.json(result);
}
