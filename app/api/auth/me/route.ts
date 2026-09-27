import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(
    req.headers.get('cookie') ?? null,
    req.headers.get('authorization')
  );

  if (!user) {
    return NextResponse.json({ error: 'Tidak ada token otorisasi yang valid.' }, { status: 401 });
  }

  const { passwordHash, ...safeUser } = user;
  return NextResponse.json({ user: safeUser });
}