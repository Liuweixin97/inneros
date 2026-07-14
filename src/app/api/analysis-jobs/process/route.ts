import { NextRequest, NextResponse } from 'next/server';
import { drainAnalysisJobs } from '@/lib/ai/job-runner';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { limit?: number; concurrency?: number };
  const limit = Math.max(1, Math.min(100, Number(body.limit) || 20));
  const concurrency = Math.max(1, Math.min(8, Number(body.concurrency) || 4));
  const result = await drainAnalysisJobs(limit, concurrency, user.id);
  return NextResponse.json(result);
}
