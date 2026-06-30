import { NextResponse } from 'next/server';
import { getCurrentUser, setSessionCookie, updateUserPassword, updateUserProfile } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!name || !/^[a-z0-9_-]{3,32}$/.test(username)) {
    return NextResponse.json({ error: '请填写姓名和 3-32 位账户名' }, { status: 400 });
  }
  if (password && password.length < 8) {
    return NextResponse.json({ error: '新密码至少 8 位' }, { status: 400 });
  }

  try {
    const updated = updateUserProfile(user.id, { name, username });
    if (!updated) return NextResponse.json({ error: '账户不存在' }, { status: 404 });
    if (password) await updateUserPassword(user.id, password);
    await setSessionCookie(updated);
    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json({ error: '账户名已存在' }, { status: 409 });
  }
}
