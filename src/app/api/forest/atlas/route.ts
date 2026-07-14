import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { buildForestAtlas } from '@/lib/forest/atlas';
import { FOREST_DAY_OPTIONS, type ForestWindowRequest } from '@/lib/forest/types';

function parseWindow(request: Request): ForestWindowRequest {
  const value = new URL(request.url).searchParams.get('window')
    ?? new URL(request.url).searchParams.get('days')
    ?? 'auto';
  if (value === 'auto') return 'auto';
  const numeric = Number(value);
  return FOREST_DAY_OPTIONS.includes(numeric as (typeof FOREST_DAY_OPTIONS)[number])
    ? numeric as (typeof FOREST_DAY_OPTIONS)[number]
    : 'auto';
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    return NextResponse.json(buildForestAtlas({
      userId: user.id,
      requestedWindow: parseWindow(request),
    }));
  } catch (error) {
    console.error('[forest/atlas GET]', error);
    return NextResponse.json({ error: '无法整理林间线索' }, { status: 500 });
  }
}
