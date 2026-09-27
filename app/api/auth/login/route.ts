import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import {
  findUserByEmail,
  findUserById,
  updateUserOnline,
  updateUserPasswordHash,
  getJwtSecret,
  verifyPassword,
} from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 20;

const globalForLogin = globalThis as unknown as {
  __akseleraLoginAttempts?: Map<string, { count: number; resetAt: number }>;
};
const attempts: Map<string, { count: number; resetAt: number }> =
  globalForLogin.__akseleraLoginAttempts ?? new Map();
if (!globalForLogin.__akseleraLoginAttempts) {
  globalForLogin.__akseleraLoginAttempts = attempts;
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(`login:${ip}`)) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan. Coba lagi dalam 1 menit.' },
        { status: 429 }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
    }

    const user = await findUserByEmail(email.trim());

    const check = user ? verifyPassword(password, user.passwordHash) : { ok: false as const };
    if (!user || !check.ok) {
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    }

    if (check.upgradedHash) {
      await updateUserPasswordHash(user.id, check.upgradedHash);
    }
    await updateUserOnline(user.id, true, 'Online');

    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '7d' });
    const { passwordHash, ...safeUser } = user;

    const res = NextResponse.json({ user: safeUser });
    res.cookies.set('akselera_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}