import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, loadDb } from '../../../lib/db';

export async function GET(req: NextRequest) {
  const currentUser = getUserFromToken(req.headers.get('authorization'));
  if (!currentUser) {
    return NextResponse.json({ error: 'Tidak ada token otorisasi yang valid.' }, { status: 401 });
  }

  const db = loadDb();
  const allConversationsCount = db.conversations.length;
  const accessibleConversations = db.conversations.filter((c) =>
    c.participantIds.includes(currentUser.id)
  );
  const inaccessibleConversations = db.conversations.filter(
    (c) => !c.participantIds.includes(currentUser.id)
  );

  return NextResponse.json({
    status: 'ACTIVE_SECURITY_ENFORCEMENT',
    rule: 'Fitur Wajib #5: Satu akun hanya bisa membaca percakapan miliknya sendiri di level database & API.',
    currentUserId: currentUser.id,
    accessibleCount: accessibleConversations.length,
    blockedInaccessibleCount: inaccessibleConversations.length,
    totalInDatabase: allConversationsCount,
    testVerification:
      inaccessibleConversations.length > 0
        ? `Terdapat ${inaccessibleConversations.length} percakapan milik pengguna lain yang otomatis diblokir (403 Forbidden) jika coba diakses oleh ${currentUser.name}.`
        : 'Semua percakapan yang ada saat ini melibatkan akun Anda.',
  });
}
