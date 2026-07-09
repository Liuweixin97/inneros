import { NextResponse } from 'next/server';
import { getCurrentUserOrGuest } from '@/lib/auth';
import { createWeeklyReview, getOrCreateWorld, getWeeklyReviews } from '@/lib/db/game';

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUserOrGuest();
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 12), 1), 52);
    const reviews = getWeeklyReviews(user.id, limit);
    return NextResponse.json({ reviews });
  } catch (error) {
    console.error('[game/weekly-review GET]', error);
    return NextResponse.json({ error: '无法加载周回看' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserOrGuest();
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const gains = cleanText(body.gains, 4000);
    const struggles = cleanText(body.struggles, 4000);
    const nextFocus = cleanText(body.next_focus ?? body.nextFocus, 4000);

    if (!gains && !struggles && !nextFocus) {
      return NextResponse.json({ error: '至少写下一项回看' }, { status: 400 });
    }

    const world = getOrCreateWorld(user.id);
    const review = createWeeklyReview({
      worldId: world.id,
      userId: user.id,
      gains,
      struggles,
      nextFocus,
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error('[game/weekly-review POST]', error);
    return NextResponse.json({ error: '保存周回看失败' }, { status: 500 });
  }
}
