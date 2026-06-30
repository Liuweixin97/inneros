import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/register', '/api/auth/guest'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const hasSession = Boolean(request.cookies.get('inneros_session')?.value);

  if (!isPublic && !hasSession && request.method !== 'GET') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
  }

  if (!isPublic && !hasSession && pathname.startsWith('/api/')) {
    const guestReadable = [
      '/api/memos',
      '/api/stats',
      '/api/topics',
      '/api/insights',
      '/api/conversations',
      '/api/auth/me',
    ].some((path) => pathname === path || pathname.startsWith(`${path}/`));
    if (!guestReadable) return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  if (!isPublic && !hasSession && !pathname.startsWith('/api/')) {
    const url = request.nextUrl.clone();
    if (pathname === '/') return NextResponse.next();
    if (request.nextUrl.searchParams.get('guest') === '1') return NextResponse.next();
    url.pathname = pathname;
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
