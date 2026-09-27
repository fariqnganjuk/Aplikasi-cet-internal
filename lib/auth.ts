import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, findUserById, DbUser } from './db';
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
  return getUserByToken(token);
}

async function getUserByToken(token: string | null | undefined): Promise<DbUser | null> {
  if (!token) return null;
  const userId = verifyToken(token);
  if (!userId) return null;
  return findUserById(userId);
}

export async function getSessionUser(): Promise<DbUser | null> {
  const store = await cookies();
  // Nilai cookie ini sudah berupa token JWT mentah, BUKAN string header
  // "nama=nilai". Karena itu harus diverifikasi langsung, bukan diteruskan
  // ke readTokenFromCookieHeader() yang memformat header cookie.
  return getUserByToken(store.get(AUTH_COOKIE)?.value);
}

/**
 * Guard untuk route handler.
 *
 * Memvalidasi sesi (cookie httpOnly atau Bearer fallback) dan meneruskan
 * user ke handler. Isolasi data di level database diterapkan oleh adapter
 * lewat `scopeUserId` yang dipass tiap handler ke fungsi `db.*`
 * (MySQL: WHERE keanggotaan di query; Postgres: RLS + GUC per request).
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

  return handler(user);
}
