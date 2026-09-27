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

/**
 * Kontrak backend storage.
 *
 * Setiap adapter (JSON lokal, MySQL, PostgreSQL) mengimplementasi fungsi yang
 * sama sehingga layer aplikasi tidak perlu tahu backend apa yang aktif.
 *
 * Catatan keamanan: `scopeUserId` adalah identitas akun yang sedang login.
 * Adapter WAJIB memfilter data percakapan/pesan berdasarkan nilai ini di
 * level query, bukan hanya di memori aplikasi. Ini yang membuat isolasi data
 * (Fitur Wajib #5) tetap berlaku walau ada query yang lupa WHERE.
 */
export interface StorageAdapter {
  readonly name: 'json' | 'mysql' | 'postgres';

  loadDb(scopeUserId: string | null): Promise<DatabaseSchema>;
  findUserByEmail(email: string): Promise<DbUser | null>;
  findUserById(id: string): Promise<DbUser | null>;
  findConversationById(id: string, scopeUserId: string | null): Promise<DbConversation | null>;
  findConversationBetween(userA: string, userB: string): Promise<DbConversation | null>;
  getConversationParticipants(id: string): Promise<[string, string] | null>;

  createUser(user: DbUser): Promise<DbUser>;
  updateUserOnline(id: string, isOnline: boolean, lastSeen: string): Promise<void>;
  updateUserPasswordHash(id: string, passwordHash: string): Promise<void>;
  createConversation(conversation: DbConversation, scopeUserId: string | null): Promise<DbConversation>;

  listMessages(conversationId: string, scopeUserId: string | null): Promise<DbMessage[]>;
  insertMessage(message: DbMessage, scopeUserId: string | null): Promise<DbMessage>;
  markConversationRead(conversationId: string, recipientId: string): Promise<boolean>;

  /**>true bila backend menerapkan Row Level Security di level engine. */
  readonly enforcesIsolationInEngine: boolean;

  ready(): Promise<void>;
}
