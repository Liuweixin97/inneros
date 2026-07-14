import { NextRequest, NextResponse } from 'next/server';
import { getMemories } from '@/lib/db/memories';
import type { MemoryStatus, MemoryType } from '@/types';
import { getCurrentUser } from '@/lib/auth';

const MEMORY_TYPES: MemoryType[] = [
  'event', 'person', 'project', 'goal', 'state',
  'belief', 'pattern', 'preference', 'constraint',
];
const MEMORY_STATUSES: MemoryStatus[] = ['active', 'dormant', 'resolved', 'superseded'];

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const type = params.get('type');
  const status = params.get('status');
  const limit = Math.max(1, Math.min(200, Number(params.get('limit')) || 50));
  const offset = Math.max(0, Number(params.get('offset')) || 0);
  const result = getMemories({
    type: MEMORY_TYPES.includes(type as MemoryType) ? type as MemoryType : undefined,
    status: MEMORY_STATUSES.includes(status as MemoryStatus) ? status as MemoryStatus : undefined,
    query: params.get('query') || undefined,
    userId: user.id,
    limit,
    offset,
  });
  return NextResponse.json(result);
}
