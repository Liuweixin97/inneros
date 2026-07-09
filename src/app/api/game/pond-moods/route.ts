import { NextResponse } from 'next/server';
import { getCurrentUserOrGuest } from '@/lib/auth';
import { createPondEntry, getOrCreateWorld, getPondEntries } from '@/lib/db/game';

function cleanContent(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 2000) : '';
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUserOrGuest();
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 30), 1), 100);
    const entries = getPondEntries(user.id, limit);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error('[game/pond-moods GET]', error);
    return NextResponse.json({ error: '无法加载静水记录' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserOrGuest();
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const content = cleanContent(body.content);
    if (!content) {
      return NextResponse.json({ error: '内容不能为空' }, { status: 400 });
    }

    const world = getOrCreateWorld(user.id);
    const entry = createPondEntry({
      worldId: world.id,
      userId: user.id,
      content,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error('[game/pond-moods POST]', error);
    return NextResponse.json({ error: '保存静水记录失败' }, { status: 500 });
  }
}
