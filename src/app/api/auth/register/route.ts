import { NextResponse } from 'next/server';
import { createUser, findUserByUsername, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!name || !username || password.length < 8) {
    return NextResponse.json({ error: '请填写昵称、账户名，并使用至少 8 位密码' }, { status: 400 });
  }
  if (!/^[a-z0-9_][a-z0-9_-]{2,31}$/.test(username)) {
    return NextResponse.json({ error: '账户名需为 3-32 位小写字母、数字、下划线或短横线' }, { status: 400 });
  }
  if (findUserByUsername(username)) {
    return NextResponse.json({ error: '该账户名已注册' }, { status: 409 });
  }

  const user = await createUser({ name, username, password });
  await setSessionCookie(user);
  return NextResponse.json({ user }, { status: 201 });
}
