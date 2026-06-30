import { NextResponse } from 'next/server';
import { createUser, findUserByEmail, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!name || !email || password.length < 8) {
    return NextResponse.json({ error: '请填写姓名、邮箱，并使用至少 8 位密码' }, { status: 400 });
  }
  if (findUserByEmail(email)) {
    return NextResponse.json({ error: '该邮箱已注册' }, { status: 409 });
  }

  const user = await createUser({ name, email, password });
  await setSessionCookie(user);
  return NextResponse.json({ user }, { status: 201 });
}

