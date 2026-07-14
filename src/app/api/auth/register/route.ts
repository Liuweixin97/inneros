import { NextResponse } from 'next/server';
import { createUser, findUserByUsername, setSessionCookie } from '@/lib/auth';
import { requestClientKey, takeRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const rateLimit = takeRateLimit(`register:${requestClientKey(request)}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: '注册尝试过于频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }
  if (Number(request.headers.get('content-length') || 0) > 16_384) {
    return NextResponse.json({ error: '请求内容过大' }, { status: 413 });
  }
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!name || name.length > 50 || !username || password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: '请填写昵称、账户名，并使用至少 8 位密码' }, { status: 400 });
  }
  if (!/^[a-z0-9_][a-z0-9_-]{2,31}$/.test(username)) {
    return NextResponse.json({ error: '账户名需为 3-32 位小写字母、数字、下划线或短横线' }, { status: 400 });
  }
  if (findUserByUsername(username)) {
    return NextResponse.json({ error: '该账户名已注册' }, { status: 409 });
  }
  if (username === 'guest') {
    return NextResponse.json({ error: '该账户名不可使用' }, { status: 400 });
  }

  try {
    const user = await createUser({ name, username, password });
    await setSessionCookie(user);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) {
      return NextResponse.json({ error: '该账户名已注册' }, { status: 409 });
    }
    throw error;
  }
}
