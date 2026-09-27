import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, findUserById, withUser, DbUser } from './db';
import { AUTH_COOKIE } from './auth-cookie';

export function readTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (rawKey === AUTH_COOKIE) return decodeURIComponent(rawValue.join('='));
  }
  return null;
}

/**
 * Resolusi user dari httpOnly cookie (utama) atau Bearer header (fallback).
 * Token tidak pernah disimpan di localStorage sehingga tidak bisa dibaca
 * oleh JavaScript halaman (mitigasi pencurian token via XSS).
 */
export async function getAuthUser(
  cookieHeader: string | null,
  authorizationHeader: string | null
): Promise<DbUser | null> {
  const bearer = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice(7)
    : null;
  const token = readTokenFromCookieHeader(cookieHeader) ?? bearer;
  const userId = verifyToken(token);
  if (!userId) return null;
  return findUserById(userId);
}

export async function getSessionUser(): Promise<DbUser | null> {
  const store = await cookies();
  return getAuthUser(store.get(AUTH_COOKIE)?.value ?? null, null);
}

/**
 * Guard untuk route handler.
 *
 * Selain memvalidasi sesi, seluruh body handler dieksekusi di dalam
 * `withUser(user.id, ...)` sehingga GUC `app.user_id` terpasang pada
 * koneksi database dan Row Level Security Postgres memfilter baris
 * milik akun lain (Fitur Wajib #5, lapis database).
 */
export async function withAuth(
  req: NextRequest,
  handler: (user: DbUser) => Promise<NextResponse>
): Promise<NextResponse> {
  const user = await getAuthUser(
    req.headers.get('cookie') ?? null,
    req.headers.get('authorization')
  );

  if (!user) {
    return NextResponse.json(
      { error: 'Tidak ada token otorisasi yang valid.' },
      { status: 401 }
    );
  }

  return withUser(user.id, () => handler(user));
}
