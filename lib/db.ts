import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'akselera-tech-super-secure-internal-chat-secret-2026';
export const DB_FILE = path.resolve(process.cwd(), 'data', 'database.json');

export interface DbUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  initials: string;
  avatarColor: string;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
}

export interface DbMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
  createdAt: string;
  isRead: boolean;
}

export interface DbConversation {
  id: string;
  participantIds: [string, string];
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseSchema {
  users: DbUser[];
  conversations: DbConversation[];
  messages: DbMessage[];
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function loadDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      throw new Error('Database file does not exist');
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data) as DatabaseSchema;
  } catch {
    return {
      users: [],
      conversations: [],
      messages: [],
    };
  }
}

export function saveDb(db: DatabaseSchema) {
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

export function getUserFromToken(authHeader: string | null | undefined): DbUser | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const db = loadDb();
    const user = db.users.find((u) => u.id === decoded.userId);
    return user || null;
  } catch {
    return null;
  }
}
