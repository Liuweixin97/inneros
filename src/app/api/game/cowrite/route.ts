import { NextResponse } from 'next/server';
import {
  createCompanionSession,
  createSharedDraft,
  getCompanionSession,
  getOrCreateWorld,
  getSharedDraft,
  updateSharedDraft,
} from '@/lib/db/game';
import { getCurrentUser } from '@/lib/auth';
import { getMemoById } from '@/lib/db/memos';
import type { SharedMemoryDraft } from '@/types';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.isGuest) return NextResponse.json({ error: '游客只读，请登录后操作' }, { status: 403 });
    const body = await req.json() as { memoId?: string };
    if (body.memoId) {
      const memo = getMemoById(body.memoId);
      if (!memo || memo.user_id !== user.id || memo.privacy_level !== 'normal') {
        return NextResponse.json({ error: '来源记录不存在' }, { status: 404 });
      }
    }
    const world = getOrCreateWorld(user.id);
    const session = createCompanionSession({
      worldId: world.id,
      userId: user.id,
      companionType: 'human_local',
      authorizedMemoIds: body.memoId ? [body.memoId] : [],
    });
    const draft = createSharedDraft({ userId: user.id, sessionId: session.id, memoId: body.memoId });
    return NextResponse.json({ session, draft }, { status: 201 });
  } catch (error) {
    console.error('[game/cowrite POST]', error);
    return NextResponse.json({ error: '无法开始这次共写' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.isGuest) return NextResponse.json({ error: '游客只读，请登录后操作' }, { status: 403 });
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
    if (!getCompanionSession(body.sessionId, user.id)) {
      return NextResponse.json({ error: '共写会话不存在' }, { status: 404 });
    }
    const existing = getSharedDraft(body.draftId, user.id);
    if (!existing || existing.sessionId !== body.sessionId) {
      return NextResponse.json({ error: '共写草稿不存在' }, { status: 404 });
    }
    const draft = updateSharedDraft(body.draftId, user.id, body.updates);
    return NextResponse.json({ draft });
  } catch (error) {
    console.error('[game/cowrite PATCH]', error);
    return NextResponse.json({ error: '保存共写草稿失败' }, { status: 500 });
  }
}
