import { NextRequest, NextResponse } from 'next/server';
import {
  applyMemoryRebuild,
  getLatestMemoryRebuildRun,
  getMemoryRebuildRun,
  previewMemoryRebuild,
  rollbackMemoryRebuild,
} from '@/lib/db/memory-rebuilds';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const run = id ? getMemoryRebuildRun(id) : getLatestMemoryRebuildRun();
  return NextResponse.json(run ?? { status: 'none' }, { status: run ? 200 : 404 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as {
      action?: 'preview' | 'apply' | 'rollback';
      id?: string;
      limit?: number;
      concurrency?: number;
    };
    if (body.action === 'apply') {
      if (!body.id) return NextResponse.json({ error: '缺少重建任务 ID' }, { status: 400 });
      return NextResponse.json(applyMemoryRebuild(body.id));
    }
    if (body.action === 'rollback') {
      if (!body.id) return NextResponse.json({ error: '缺少重建任务 ID' }, { status: 400 });
      return NextResponse.json(rollbackMemoryRebuild(body.id));
    }
    return NextResponse.json(await previewMemoryRebuild({
      limit: body.limit,
      concurrency: body.concurrency,
    }));
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : '记忆重建失败',
    }, { status: 500 });
  }
}
