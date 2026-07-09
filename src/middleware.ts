import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/register'];
const GUEST_ACCOUNT_API_PATHS = [
  '/api/auth/me',
  '/api/memos',
  '/api/stats',
  '/api/topics',
  '/api/insights',
  '/api/conversations',
  '/api/game',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isGuestAccountApi = GUEST_ACCOUNT_API_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const hasSession = Boolean(request.cookies.get('inneros_session')?.value);

  if (!isPublic && !hasSession && pathname.startsWith('/api/') && !isGuestAccountApi) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  if (!isPublic && !hasSession && !pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (pathname === '/login' && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
