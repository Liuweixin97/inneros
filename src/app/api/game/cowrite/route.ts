import { NextResponse } from 'next/server';
import {
  createCompanionSession,
  createSharedDraft,
  getCompanionSession,
  getOrCreateWorld,
  getSharedDraft,
  updateSharedDraft,
} from '@/lib/db/game';
import type { SharedMemoryDraft } from '@/types';

export async function POST(req: Request) {
  try {
    const body = await req.json() as { memoId?: string };
    const world = getOrCreateWorld();
    const session = createCompanionSession({
      worldId: world.id,
      companionType: 'human_local',
      authorizedMemoIds: body.memoId ? [body.memoId] : [],
    });
    const draft = createSharedDraft({ sessionId: session.id, memoId: body.memoId });
    return NextResponse.json({ session, draft }, { status: 201 });
  } catch (error) {
    console.error('[game/cowrite POST]', error);
    return NextResponse.json({ error: '无法开始这次共写' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json() as {
      draftId?: string;
      sessionId?: string;
      updates?: Partial<Pick<
        SharedMemoryDraft,
        'playerOneText' | 'playerTwoText' | 'jointText' | 'saveDecision'
      >>;
    };
    if (!body.draftId || !body.sessionId || !body.updates) {
      return NextResponse.json({ error: '缺少共写草稿信息' }, { status: 400 });
    }
    if (!getCompanionSession(body.sessionId)) {
      return NextResponse.json({ error: '共写会话不存在' }, { status: 404 });
    }
    const existing = getSharedDraft(body.draftId);
    if (!existing || existing.sessionId !== body.sessionId) {
      return NextResponse.json({ error: '共写草稿不存在' }, { status: 404 });
    }
    const draft = updateSharedDraft(body.draftId, body.updates);
    return NextResponse.json({ draft });
  } catch (error) {
    console.error('[game/cowrite PATCH]', error);
    return NextResponse.json({ error: '保存共写草稿失败' }, { status: 500 });
  }
}
