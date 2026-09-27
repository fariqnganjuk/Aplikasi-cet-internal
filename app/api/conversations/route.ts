import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withAuth } from '../../../lib/auth';
import {
  loadDb,
  findUserById,
  findConversationBetween,
  createConversation,
  DbConversation,
} from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return withAuth(req, async (currentUser) => {
    const db = await loadDb(currentUser.id);

    // Lapis aplikasi: hanya percakapan milik user yang login.
    // Lapis database: RLS Postgres sudah memfilter sebelum sampai di sini.
    const userConversations = db.conversations.filter((c) =>
      c.participantIds.includes(currentUser.id)
    );

    const enriched = userConversations.map((c) => {
      const otherUserId = c.participantIds.find((id) => id !== currentUser.id)!;
      const otherUserRaw = db.users.find((u) => u.id === otherUserId);
      const otherUser = otherUserRaw
        ? {
            id: otherUserRaw.id,
            name: otherUserRaw.name,
            email: otherUserRaw.email,
            initials: otherUserRaw.initials,
            avatarColor: otherUserRaw.avatarColor,
            isOnline: otherUserRaw.isOnline,
            lastSeen: otherUserRaw.lastSeen,
          }
        : {
            id: otherUserId,
            name: 'Pengguna',
            email: '',
            initials: '?',
            isOnline: false,
          };

      const messages = db.messages
        .filter((m) => m.conversationId === c.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : undefined;

      const unreadCount = messages.filter(
        (m) => m.recipientId === currentUser.id && !m.isRead
      ).length;

      return {
        id: c.id,
        participantIds: c.participantIds,
        otherUser,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              senderId: lastMessage.senderId,
              text: lastMessage.text,
              createdAt: lastMessage.createdAt,
              isRead: lastMessage.isRead,
            }
          : undefined,
        unreadCount,
        updatedAt: c.updatedAt,
      };
    });

    enriched.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json({ conversations: enriched });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (currentUser) => {
    const { recipientId } = await req.json();

    if (!recipientId) {
      return NextResponse.json({ error: 'ID penerima wajib disediakan.' }, { status: 400 });
    }

    if (recipientId === currentUser.id) {
      return NextResponse.json(
        { error: 'Tidak dapat memulai percakapan dengan akun sendiri.' },
        { status: 400 }
      );
    }

    // Fitur Wajib #2: chat baru hanya dengan pengguna terdaftar.
    const recipient = await findUserById(recipientId);
    if (!recipient) {
      return NextResponse.json({ error: 'Pengguna tujuan tidak ditemukan.' }, { status: 404 });
    }

    const existing = await findConversationBetween(currentUser.id, recipientId);
    if (existing) {
      return NextResponse.json({ conversationId: existing.id });
    }

    const now = new Date().toISOString();
    const conversation: DbConversation = {
      id: `conv-${crypto.randomUUID()}`,
      participantIds: [currentUser.id, recipientId],
      createdAt: now,
      updatedAt: now,
    };
    await createConversation(conversation, currentUser.id);

    return NextResponse.json({ conversationId: conversation.id });
  });
}