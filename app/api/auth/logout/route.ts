import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';
import { updateUserOnline } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getAuthUser(
    req.headers.get('cookie') ?? null,
    req.headers.get('authorization')
  );

  if (user) {
    await updateUserOnline(user.id, false, new Date().toISOString());
  }

  const res = NextResponse.json({ success: true, message: 'Berhasil keluar.' });
  res.cookies.set('akselera_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}