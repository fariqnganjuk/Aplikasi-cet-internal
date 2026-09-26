import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { loadDb, saveDb, hashPassword, JWT_SECRET } from '../../../../lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
    }

    const db = loadDb();
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

    if (!user || user.passwordHash !== hashPassword(password)) {
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    }

    user.isOnline = true;
    user.lastSeen = 'Online';
    saveDb(db);

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const { passwordHash, ...safeUser } = user;

    return NextResponse.json({ token, user: safeUser });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan' }, { status: 500 });
  }
}
