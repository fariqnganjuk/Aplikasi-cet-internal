import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, loadDb, saveDb } from '../../../../lib/db';

export async function POST(req: NextRequest) {
  const user = getUserFromToken(req.headers.get('authorization'));
  if (user) {
    const db = loadDb();
    const u = db.users.find((item) => item.id === user.id);
    if (u) {
      u.isOnline = false;
      u.lastSeen = new Date().toISOString();
      saveDb(db);
    }
  }

  return NextResponse.json({ success: true, message: 'Berhasil keluar.' });
}
