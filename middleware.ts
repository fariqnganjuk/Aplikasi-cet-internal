import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE } from './lib/auth-cookie';

const PUBLIC_PATHS = new Set(['/login', '/api/auth/login', '/api/auth/register']);

/**
 * Route guard tingkat HTTP (edge runtime, tanpa verify JWT di sini).
 * Hanya mengecek keberadaan cookie sesi; verifikasi signature JWT dan
 * status user dilakukan di server component / route handler.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/brand') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(req.cookies.get(AUTH_COOKIE)?.value);

  if (!hasSessionCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (pathname === '/login' && hasSessionCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login'],
};
