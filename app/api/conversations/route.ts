import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getUserFromToken, loadDb, saveDb, DbConversation } from '../../../lib/db';

export async function GET(req: NextRequest) {
  const currentUser = getUserFromToken(req.headers.get('authorization'));
  if (!currentUser) {
    return NextResponse.json({ error: 'Tidak ada token otorisasi yang valid.' }, { status: 401 });
  }

  const db = loadDb();
  // Fitur Wajib #5: Filter STRICTLY only conversations where currentUser.id is participant
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

    const messages = db.messages.filter((m) => m.conversationId === c.id);
    messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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
}

export async function POST(req: NextRequest) {
  const currentUser = getUserFromToken(req.headers.get('authorization'));
  if (!currentUser) {
    return NextResponse.json({ error: 'Tidak ada token otorisasi yang valid.' }, { status: 401 });
  }

  const { recipientId } = await req.json();
  if (!recipientId) {
    return NextResponse.json({ error: 'ID penerima wajib disediakan.' }, { status: 400 });
  }

  if (recipientId === currentUser.id) {
    return NextResponse.json({ error: 'Tidak dapat memulai percakapan dengan akun sendiri.' }, { status: 400 });
  }

  const db = loadDb();
  let conversation = db.conversations.find((c) =>
    c.participantIds.includes(currentUser.id) && c.participantIds.includes(recipientId)
  );

  if (!conversation) {
    conversation = {
      id: `conv-${crypto.randomUUID()}`,
      participantIds: [currentUser.id, recipientId],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.conversations.push(conversation);
    saveDb(db);
  }

  return NextResponse.json({ conversationId: conversation.id });
}
