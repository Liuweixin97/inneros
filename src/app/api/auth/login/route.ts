import { NextResponse } from 'next/server';
import { findUserByUsername, setSessionCookie, verifyPassword } from '@/lib/auth';
import { requestClientKey, takeRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const clientKey = requestClientKey(request);
  const rateLimit = takeRateLimit(`login:${clientKey}`, { limit: 10, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: '登录尝试过于频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }
  if (Number(request.headers.get('content-length') || 0) > 16_384) {
    return NextResponse.json({ error: '请求内容过大' }, { status: 413 });
  }
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || '');
  const password = String(body.password || '');

  if (username.length > 32 || password.length > 128) {
    return NextResponse.json({ error: '账户名或密码不正确' }, { status: 401 });
  }

  const user = findUserByUsername(username);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return NextResponse.json({ error: '账户名或密码不正确' }, { status: 401 });
  }

  await setSessionCookie(user);
  return NextResponse.json({ user: { id: user.id, name: user.name, username: user.username } });
}
