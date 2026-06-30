import { NextResponse } from 'next/server';
import {
  getOrCreateWorld,
  updateWorldVisit,
  updateWorldSettings,
  updateWorldSeason,
  getWorldObjects,
  createWorldObject,
  updateWorldObject,
  hideWorldObject,
} from '@/lib/db/game';
import type { WorldObjectType, GameSeason, GameWorldSettings } from '@/types';
import { getCurrentUser, getCurrentUserOrGuest } from '@/lib/auth';
import { getMemoById } from '@/lib/db/memos';

// GET /api/game/world — 获取或初始化世界状态
export async function GET() {
  try {
    const user = await getCurrentUserOrGuest();
    const world = getOrCreateWorld(user.id);
    const objects = getWorldObjects(world.id, user.id);
    return NextResponse.json({ world, objects });
  } catch (error) {
    console.error('[game/world GET]', error);
    return NextResponse.json({ error: '无法加载世界状态' }, { status: 500 });
  }
}

// PATCH /api/game/world — 更新世界状态（位置/设置/季节/物件）
export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    if (user.isGuest) return NextResponse.json({ error: '游客只读，请登录后操作' }, { status: 403 });
    const body = await req.json() as Record<string, unknown>;
    const world = getOrCreateWorld(user.id);

    // 更新玩家位置
    if (typeof body.playerX === 'number' && typeof body.playerY === 'number') {
      updateWorldVisit(world.id, user.id, body.playerX, body.playerY);
    }

    // 更新设置
    if (body.settings && typeof body.settings === 'object') {
      updateWorldSettings(world.id, user.id, body.settings as Partial<GameWorldSettings>);
    }

    // 更新季节
    if (body.season && typeof body.season === 'string') {
      updateWorldSeason(world.id, user.id, body.season as GameSeason);
    }

    // 放置世界物件
    if (body.action === 'place_object' && body.object && typeof body.object === 'object') {
      const obj = body.object as Record<string, unknown>;
      const sourceMemoIds = Array.isArray(obj.sourceMemoIds) ? obj.sourceMemoIds as string[] : [];
      const invalidMemo = sourceMemoIds.some((memoId) => {
        const memo = getMemoById(memoId);
        return !memo || memo.user_id !== user.id || memo.privacy_level !== 'normal';
      });
      if (invalidMemo) {
        return NextResponse.json({ error: '来源记录不存在' }, { status: 404 });
      }
      const newObj = createWorldObject({
        worldId: world.id,
        userId: user.id,
        type: obj.type as WorldObjectType,
        x: obj.x as number,
        y: obj.y as number,
        layer: typeof obj.layer === 'number' ? obj.layer : 1,
        sourceMemoIds,
        sourceSessionId: typeof obj.sourceSessionId === 'string' ? obj.sourceSessionId : undefined,
        userConfirmed: Boolean(obj.userConfirmed),
        annotation: typeof obj.annotation === 'string' ? obj.annotation : undefined,
        metadata: typeof obj.metadata === 'object' && obj.metadata !== null
          ? obj.metadata as Record<string, unknown>
          : {},
      });
      return NextResponse.json({ object: newObj });
    }

    // 更新物件（移动/隐藏/注释）
    if (body.action === 'update_object' && typeof body.objectId === 'string') {
      const updates = body.updates as Record<string, unknown>;
      const updated = updateWorldObject(body.objectId, user.id, {
        ...(typeof updates.x === 'number' ? { x: updates.x } : {}),
        ...(typeof updates.y === 'number' ? { y: updates.y } : {}),
        ...(typeof updates.hidden === 'boolean' ? { hidden: updates.hidden } : {}),
        ...(typeof updates.annotation === 'string' || updates.annotation === null
          ? { annotation: updates.annotation as string | undefined }
          : {}),
        ...(typeof updates.userConfirmed === 'boolean' ? { userConfirmed: updates.userConfirmed } : {}),
      });
      return NextResponse.json({ object: updated });
    }

    // 隐藏物件
    if (body.action === 'hide_object' && typeof body.objectId === 'string') {
      hideWorldObject(body.objectId, user.id);
      return NextResponse.json({ success: true });
    }

    const updated = getOrCreateWorld(user.id);
    const objects = getWorldObjects(updated.id, user.id);
    return NextResponse.json({ world: updated, objects });
  } catch (error) {
    console.error('[game/world PATCH]', error);
    return NextResponse.json({ error: '更新世界状态失败' }, { status: 500 });
  }
}
