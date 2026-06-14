import { NextRequest, NextResponse } from 'next/server';
import {
  getMemoryById,
  getMemoryEvidence,
  getMemoryRelations,
} from '@/lib/db/memories';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  const memory = getMemoryById(id);
  if (!memory) return NextResponse.json({ error: '记忆不存在' }, { status: 404 });
  return NextResponse.json({
    memory,
    evidence: getMemoryEvidence(id),
    relations: getMemoryRelations(id),
  });
}
