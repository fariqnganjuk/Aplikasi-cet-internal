import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../lib/auth';
import { loadDb } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withAuth(req, async (currentUser) => {
    const db = await loadDb(currentUser.id);
    const accessibleCount = db.conversations.filter((c) =>
      c.participantIds.includes(currentUser.id)
    ).length;

    return NextResponse.json({
      status: 'ACTIVE_SECURITY_ENFORCEMENT',
      rule: 'Fitur Wajib #5: Satu akun hanya bisa membaca percakapan miliknya sendiri di level database & API.',
      accessibleCount,
    });
  });
}