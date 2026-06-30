import { NextResponse } from 'next/server';
import { findUserByUsername, setSessionCookie, verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || body.email || '');
  const password = String(body.password || '');

  const user = findUserByUsername(username);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: '账户名或密码不正确' }, { status: 401 });
  }

  await setSessionCookie(user);
  return NextResponse.json({ user: { id: user.id, name: user.name, username: user.username } });
}
