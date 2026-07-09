import { NextResponse } from 'next/server';
import { getCurrentUserOrGuest } from '@/lib/auth';
import { getMemos, getMemoByIdForUser } from '@/lib/db/memos';

// GET /api/game/memos — 获取游戏用 Memo 列表
// 支持：默认最近 20 条 + 用户手选（ids 参数）
// 只返回 privacy_level = 'normal' 的 Memo
export async function GET(req: Request) {
  const url = new URL(req.url);
  const idsParam = url.searchParams.get('ids');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50);

  try {
    const user = await getCurrentUserOrGuest();
    // 用户手动选择的 Memo（通过 id 列表指定）
    if (idsParam) {
      const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean).slice(0, 50);
      const memos = ids
        .map((id) => getMemoByIdForUser(id, user.id))
        .filter((m) => m !== null && m.privacy_level === 'normal');
      return NextResponse.json({ memos, total: memos.length, mode: 'selected' });
    }

    // 默认：最近的普通 Memo
    const { memos, total } = getMemos({
      userId: user.id,
      limit,
      offset: 0,
    });
    const normalMemos = memos.filter((m) => m.privacy_level === 'normal');

    return NextResponse.json({ memos: normalMemos, total, mode: 'recent' });
  } catch (error) {
    console.error('[game/memos GET]', error);
    return NextResponse.json({ error: '无法加载 Memo' }, { status: 500 });
  }
}
