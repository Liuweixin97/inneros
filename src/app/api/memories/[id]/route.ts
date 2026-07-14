import { NextRequest, NextResponse } from 'next/server';
import {
  getMemoryById,
  getMemoryEvidence,
  getMemoryRelations,
} from '@/lib/db/memories';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const memory = getMemoryById(id, user.id);
  if (!memory) return NextResponse.json({ error: '记忆不存在' }, { status: 404 });
  return NextResponse.json({
    memory,
    evidence: getMemoryEvidence(id),
    relations: getMemoryRelations(id),
  });
}
