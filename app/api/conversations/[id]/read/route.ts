import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, loadDb, saveDb } from '../../../../../lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getUserFromToken(req.headers.get('authorization'));
  if (!currentUser) {
    return NextResponse.json({ error: 'Tidak ada token otorisasi yang valid.' }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const db = loadDb();
  const conversation = db.conversations.find((c) => c.id === conversationId);

  if (!conversation || !conversation.participantIds.includes(currentUser.id)) {
    return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
  }

  let updated = false;
  db.messages.forEach((m) => {
    if (m.conversationId === conversationId && m.recipientId === currentUser.id && !m.isRead) {
      m.isRead = true;
      updated = true;
    }
  });

  if (updated) {
    saveDb(db);
  }

  return NextResponse.json({ success: true });
}
