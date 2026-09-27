import { NextRequest } from 'next/server';
import { getAuthUser } from '../../../lib/auth';
import { addSubscriber, removeSubscriber } from '../../../lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEARTBEAT_MS = 25_000;

export async function GET(req: NextRequest) {
  const currentUser = await getAuthUser(req.headers.get('cookie') ?? null, req.headers.get('authorization'));
  if (!currentUser) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  const userId = currentUser.id;

  let subscriber: {
    userId: string;
    write: (chunk: string) => void;
    close: () => void;
  };

  const stream = new ReadableStream({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          removeSubscriber(subscriber);
        }
      };

      const heartbeat = setInterval(() => {
        write(': keep-alive\n\n');
      }, HEARTBEAT_MS);

      subscriber = { userId, write, close: () => clearInterval(heartbeat) };
      addSubscriber(subscriber);

      write(`data: ${JSON.stringify({ type: 'CONNECTED', payload: { userId } })}\n\n`);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        removeSubscriber(subscriber);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      if (subscriber) removeSubscriber(subscriber);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}