import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withAuth } from '../../../../../lib/auth';
import {
  getConversationParticipants,
  insertMessage,
  listMessages,
  DbMessage,
} from '../../../../../lib/db';
import { notifyParticipants } from '../../../../../lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_TEXT_LENGTH = 4000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (currentUser) => {
    const { id: conversationId } = await params;

    // Cek keanggotaan tanpa RLS supaya bisa dibalas 403 (bukan 404).
    const participants = await getConversationParticipants(conversationId);

    if (!participants) {
      return NextResponse.json({ error: 'Percakapan tidak ditemukan.' }, { status: 404 });
    }

    // Aturan Wajib #5, lapis aplikasi.
    if (!participants.includes(currentUser.id)) {
      return NextResponse.json(
        {
          error: 'Akses Ditolak: Anda tidak memiliki izin untuk melihat percakapan ini.',
          code: 'FORBIDDEN_CONVERSATION_ACCESS',
        },
        { status: 403 }
      );
    }

    // Lapis database: query berjalan di scope user sehingga isolasi
    // selalu diberlakukan (MySQL: WHERE user_a_id=?, MySQL/Postgres: RLS/WHERE).
    const messages = await listMessages(conversationId, currentUser.id);
    return NextResponse.json({ messages });
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (currentUser) => {
    const { id: conversationId } = await params;
    const { text } = await req.json();

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Isi pesan tidak boleh kosong.' }, { status: 400 });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Pesan maksimal ${MAX_TEXT_LENGTH} karakter.` },
        { status: 400 }
      );
    }

    const participants = await getConversationParticipants(conversationId);

    if (!participants) {
      return NextResponse.json({ error: 'Percakapan tidak ditemukan.' }, { status: 404 });
    }

    if (!participants.includes(currentUser.id)) {
      return NextResponse.json(
        { error: 'Akses Ditolak: Anda bukan peserta percakapan ini.' },
        { status: 403 }
      );
    }

    const recipientId = participants.find((id) => id !== currentUser.id)!;
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

    await insertMessage(newMessage, currentUser.id);

    notifyParticipants(participants, {
      type: 'NEW_MESSAGE',
      payload: { conversationId, message: newMessage },
    });

    return NextResponse.json({ message: newMessage }, { status: 201 });
  });
}