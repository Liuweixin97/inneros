import { NextResponse } from 'next/server';
import { createUser, findUserByUsername, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!name || !/^[a-z0-9_-]{3,32}$/.test(username) || password.length < 8) {
    return NextResponse.json({ error: '请填写姓名、3-32 位账户名，并使用至少 8 位密码' }, { status: 400 });
  }
  if (findUserByUsername(username)) {
    return NextResponse.json({ error: '该账户名已存在' }, { status: 409 });
  }

  const user = await createUser({ name, username, password });
  await setSessionCookie(user);
  return NextResponse.json({ user }, { status: 201 });
}
