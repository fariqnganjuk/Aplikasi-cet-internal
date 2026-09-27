import type { DbUser } from './db';

export interface ChatEvent {
  type: 'NEW_MESSAGE' | 'MESSAGES_READ' | 'CONNECTED';
  payload?: unknown;
}

type Subscriber = {
  userId: string;
  write: (chunk: string) => void;
  close: () => void;
};

const globalForEvents = globalThis as unknown as { __akseleraSubs?: Subscriber[] };

const subscribers: Subscriber[] = globalForEvents.__akseleraSubs ?? [];
if (!globalForEvents.__akseleraSubs) {
  globalForEvents.__akseleraSubs = subscribers;
}

export function addSubscriber(sub: Subscriber) {
  subscribers.push(sub);
}

export function removeSubscriber(sub: Subscriber) {
  const idx = subscribers.indexOf(sub);
  if (idx !== -1) subscribers.splice(idx, 1);
}

export function notifyUser(userId: string, event: ChatEvent) {
  const chunk = `data: ${JSON.stringify(event)}\n\n`;
  for (const sub of subscribers) {
    if (sub.userId !== userId) continue;
    try {
      sub.write(chunk);
    } catch {
      removeSubscriber(sub);
    }
  }
}

export function notifyParticipants(participantIds: string[], event: ChatEvent) {
  for (const id of participantIds) {
    notifyUser(id, event);
  }
}

export function isOnlineByDb(db: { users: DbUser[] }, userId: string): boolean {
  return db.users.find((u) => u.id === userId)?.isOnline ?? false;
}
