import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../../lib/auth';
import { getConversationParticipants, markConversationRead } from '../../../../../lib/db';
import { notifyParticipants } from '../../../../../lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async (currentUser) => {
    const { id: conversationId } = await params;
    const participants = await getConversationParticipants(conversationId);

    if (!participants || !participants.includes(currentUser.id)) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const updated = await markConversationRead(conversationId, currentUser.id);

    if (updated) {
      notifyParticipants(participants, {
        type: 'MESSAGES_READ',
        payload: { conversationId, readBy: currentUser.id },
      });
    }

    return NextResponse.json({ success: true });
  });
}