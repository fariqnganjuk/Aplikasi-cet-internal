import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../lib/auth';
import { loadDb } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withAuth(req, async (currentUser) => {
    const db = await loadDb();
    const users = db.users
      .filter((u) => u.id !== currentUser.id)
      .map(({ passwordHash, ...safeUser }) => safeUser);

    return NextResponse.json({ users });
  });
}