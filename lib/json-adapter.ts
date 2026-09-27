import fs from 'fs';
import path from 'path';
import type {
  DatabaseSchema,
  DbConversation,
  DbMessage,
  DbUser,
  StorageAdapter,
} from './storage-adapter';
import buildSeed from './seed';

/**
 * Backend JSON lokal (development / fallback).
 *
 * Tulis memakai file sementara lalu rename (atomic) supaya file utama tidak
 * pernah处于 dalam keadaan setengah tertulis.
 *
 * Isolasi data di sini berada di level aplikasi karena format JSON tidak
 * punya mekanisme filter. Untuk deployment multi-tenant, gunakan MySQL
 * (filter di level query) atau PostgreSQL (Row Level Security di level engine).
 */
export function createJsonAdapter(
  dbFile: string,
  hashPassword: (plain: string) => string
): StorageAdapter {
  function read(): DatabaseSchema {
    try {
      if (!fs.existsSync(dbFile)) {
        const seed = buildSeed(hashPassword);
        write(seed);
        return seed;
      }
      const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf-8')) as DatabaseSchema;
      return {
        users: parsed.users ?? [],
        conversations: parsed.conversations ?? [],
        messages: parsed.messages ?? [],
      };
    } catch {
      return { users: [], conversations: [], messages: [] };
    }
  }

  function write(db: DatabaseSchema) {
    try {
      fs.mkdirSync(path.dirname(dbFile), { recursive: true });
      const tmp = `${dbFile}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8');
      fs.renameSync(tmp, dbFile);
    } catch (err) {
      console.error('[db-json] gagal menyimpan database:', err);
    }
  }

  return {
    name: 'json',
    enforcesIsolationInEngine: false,

    async ready() {
      read();
    },

    async loadDb(scopeUserId) {
      const db = read();
      if (!scopeUserId) return db;
      return {
        users: db.users,
        conversations: db.conversations.filter((c) =>
          c.participantIds.includes(scopeUserId)
        ),
        messages: db.messages.filter((m) => {
          const conv = db.conversations.find((c) => c.id === m.conversationId);
          return conv ? conv.participantIds.includes(scopeUserId) : false;
        }),
      };
    },

    async findUserByEmail(email) {
      return read().users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
    },

    async findUserById(id) {
      return read().users.find((u) => u.id === id) ?? null;
    },

    async findConversationById(id, scopeUserId) {
      const conv = read().conversations.find((c) => c.id === id);
      if (!conv) return null;
      if (scopeUserId && !conv.participantIds.includes(scopeUserId)) return null;
      return conv;
    },

    async findConversationBetween(userA, userB) {
      return (
        read().conversations.find(
          (c) => c.participantIds.includes(userA) && c.participantIds.includes(userB)
        ) ?? null
      );
    },

    async getConversationParticipants(id) {
      const conv = read().conversations.find((c) => c.id === id);
      return conv ? conv.participantIds : null;
    },

    async createUser(user) {
      const db = read();
      db.users.push(user);
      write(db);
      return user;
    },

    async updateUserOnline(id, isOnline, lastSeen) {
      const db = read();
      const user = db.users.find((u) => u.id === id);
      if (user) {
        user.isOnline = isOnline;
        user.lastSeen = lastSeen;
        write(db);
      }
    },

    async updateUserPasswordHash(id, passwordHash) {
      const db = read();
      const user = db.users.find((u) => u.id === id);
      if (user) {
        user.passwordHash = passwordHash;
        write(db);
      }
    },

    async createConversation(conversation, scopeUserId) {
      if (scopeUserId && !conversation.participantIds.includes(scopeUserId)) {
        throw new Error('FORBIDDEN_NOT_PARTICIPANT');
      }
      const db = read();
      db.conversations.push(conversation);
      write(db);
      return conversation;
    },

    async listMessages(conversationId, scopeUserId) {
      const db = read();
      const conv = db.conversations.find((c) => c.id === conversationId);
      if (!conv) return [];
      if (scopeUserId && !conv.participantIds.includes(scopeUserId)) return [];
      return db.messages
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    },

    async insertMessage(message, scopeUserId) {
      if (scopeUserId && message.senderId !== scopeUserId) {
        throw new Error('FORBIDDEN_NOT_SENDER');
      }
      const db = read();
      db.messages.push(message);
      const conv = db.conversations.find((c) => c.id === message.conversationId);
      if (conv) conv.updatedAt = message.createdAt;
      write(db);
      return message;
    },

    async markConversationRead(conversationId, recipientId) {
      const db = read();
      let updated = false;
      db.messages.forEach((m) => {
        if (m.conversationId === conversationId && m.recipientId === recipientId && !m.isRead) {
          m.isRead = true;
          updated = true;
        }
      });
      if (updated) write(db);
      return updated;
    },
  };
}
