import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, loadDb } from '../../../lib/db';

export async function GET(req: NextRequest) {
  const currentUser = getUserFromToken(req.headers.get('authorization'));
  if (!currentUser) {
    return NextResponse.json({ error: 'Tidak ada token otorisasi yang valid.' }, { status: 401 });
  }

  const db = loadDb();
  const users = db.users
    .filter((u) => u.id !== currentUser.id)
    .map(({ passwordHash, ...safeUser }) => safeUser);

  return NextResponse.json({ users });
}
