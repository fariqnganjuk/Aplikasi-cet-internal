import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  findUserByEmail,
  createUser,
  getJwtSecret,
  hashPassword,
  DbUser,
} from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nama, email, dan password wajib diisi.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar. Silakan gunakan email lain.' },
        { status: 400 }
      );
    }

    const parts = name.trim().split(/\s+/);
    const initials =
      parts.length > 1
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : parts[0].substring(0, 2).toUpperCase();

    const newUser: DbUser = {
      id: `user-${crypto.randomUUID()}`,
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      initials,
      avatarColor: '#27272A',
      isOnline: true,
      lastSeen: 'Online',
      createdAt: new Date().toISOString(),
    };

    await createUser(newUser);

    const token = jwt.sign({ userId: newUser.id }, getJwtSecret(), { expiresIn: '7d' });
    const { passwordHash, ...safeUser } = newUser;

    const res = NextResponse.json({ user: safeUser }, { status: 201 });
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