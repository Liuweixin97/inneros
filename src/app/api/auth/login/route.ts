import { NextResponse } from 'next/server';
import { findUserByEmail, setSessionCookie, verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '');
  const password = String(body.password || '');

  const user = findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: '邮箱或密码不正确' }, { status: 401 });
  }

  await setSessionCookie(user);
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
}

