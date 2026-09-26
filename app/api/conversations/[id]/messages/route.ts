import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getUserFromToken, loadDb, saveDb, DbMessage } from '../../../../../lib/db';

export async function GET(
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

  if (!conversation) {
    return NextResponse.json({ error: 'Percakapan tidak ditemukan.' }, { status: 404 });
  }

  // ATURAN WAJIB #5: Enforced at API Level
  if (!conversation.participantIds.includes(currentUser.id)) {
    return NextResponse.json(
      {
        error: 'Akses Ditolak: Anda tidak memiliki izin untuk melihat percakapan ini.',
        code: 'FORBIDDEN_CONVERSATION_ACCESS',
      },
      { status: 403 }
    );
  }

  const messages = db.messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return NextResponse.json({ messages });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = getUserFromToken(req.headers.get('authorization'));
  if (!currentUser) {
    return NextResponse.json({ error: 'Tidak ada token otorisasi yang valid.' }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const { text } = await req.json();

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'Isi pesan tidak boleh kosong.' }, { status: 400 });
  }

  const db = loadDb();
  const conversation = db.conversations.find((c) => c.id === conversationId);

  if (!conversation) {
    return NextResponse.json({ error: 'Percakapan tidak ditemukan.' }, { status: 404 });
  }

  if (!conversation.participantIds.includes(currentUser.id)) {
    return NextResponse.json({ error: 'Akses Ditolak: Anda bukan peserta percakapan ini.' }, { status: 403 });
  }

  const recipientId = conversation.participantIds.find((id) => id !== currentUser.id)!;
  const now = new Date().toISOString();

  const newMessage: DbMessage = {
    id: `msg-${crypto.randomUUID()}`,
    conversationId,
    senderId: currentUser.id,
    recipientId,
    text: text.trim(),
    createdAt: now,
    isRead: false,
  };

  db.messages.push(newMessage);
  conversation.updatedAt = now;
  saveDb(db);

  return NextResponse.json({ message: newMessage }, { status: 201 });
}
