import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '../../../../lib/db';

export async function GET(req: NextRequest) {
  const user = getUserFromToken(req.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Tidak ada token otorisasi yang valid.' }, { status: 401 });
  }

  const { passwordHash, ...safeUser } = user;
  return NextResponse.json({ user: safeUser });
}
