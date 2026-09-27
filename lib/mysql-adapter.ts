import type {
  DatabaseSchema,
  DbConversation,
  DbMessage,
  DbUser,
  StorageAdapter,
} from './storage-adapter';
import buildSeed from './seed';

type Mysql = typeof import('mysql2/promise');
type Pool = Awaited<ReturnType<Mysql['createPool']>>;
type RowPacket = import('mysql2/promise').RowDataPacket;

interface UserRow extends RowPacket {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  initials: string;
  avatar_color: string;
  is_online: number | boolean;
  last_seen: string;
  created_at: Date | string;
}

interface ConversationRow extends RowPacket {
  id: string;
  user_a_id: string;
  user_b_id: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface MessageRow extends RowPacket {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  text: string;
  created_at: Date | string;
  is_read: number | boolean;
}

/**
 * Backend MySQL/MariaDB (Hostinger menyediakan MySQL terkelola).
 *
 * Berbeda dengan PostgreSQL, MySQL tidak memiliki Row Level Security bawaan.
 * Karena itu isolasi data di sini ditegakkan DI DALAM QUERY: setiap
 * pembacaan percakapan/pesan selalu menyertakan kondisi keanggotaan
 * (`user_a_id = ? OR user_b_id = ?`) berdasarkan user yang sedang login.
 * Dengan begitu query tanpa filter participant tidak mungkin mengembalikan
 * data milik akun lain.
 *
 * Konvensi nilai waktu: kolom bertipe DATETIME(3) disimpan dalam UTC
 * (diformat ISO tanpa timezone) agar konsisten antar backend.
 */
export function createMysqlAdapter(
  config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  },
  hashPassword: (plain: string) => string
): StorageAdapter {
  const globals = globalThis as unknown as { __akseleraMysqlPool?: Promise<Pool> };
  const SETUP_LOCK = 'akselera_mysql_setup_done';

  function getPool(): Promise<Pool> {
    if (!globals.__akseleraMysqlPool) {
      globals.__akseleraMysqlPool = (async () => {
        const mysql = await import('mysql2/promise');
        return mysql.createPool({
          ...config,
          waitForConnections: true,
          connectionLimit: 8,
          queueLimit: 0,
          charset: 'utf8mb4',
          timezone: 'Z',
          supportBigNumbers: true,
        });
      })();
    }
    return globals.__akseleraMysqlPool;
  }

  function toIso(value: Date | string): string {
    if (value instanceof Date) return value.toISOString();
    return new Date(`${String(value).replace(' ', 'T')}Z`).toISOString();
  }

  function rowToUser(r: UserRow): DbUser {
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      passwordHash: r.password_hash,
      initials: r.initials,
      avatarColor: r.avatar_color,
      isOnline: Boolean(r.is_online),
      lastSeen: r.last_seen ?? '',
      createdAt: toIso(r.created_at),
    };
  }

  function rowToConversation(r: ConversationRow): DbConversation {
    return {
      id: r.id,
      participantIds: [r.user_a_id, r.user_b_id],
      createdAt: toIso(r.created_at),
      updatedAt: toIso(r.updated_at),
    };
  }

  function rowToMessage(r: MessageRow): DbMessage {
    return {
      id: r.id,
      conversationId: r.conversation_id,
      senderId: r.sender_id,
      recipientId: r.recipient_id,
      text: r.text,
      createdAt: toIso(r.created_at),
      isRead: Boolean(r.is_read),
    };
  }

  /** ISO string -> 'YYYY-MM-DD HH:MM:SS.mmm' (UTC, sesuai kolom DATETIME). */
  function toSqlDateTime(iso: string): string {
    return `${iso.replace('T', ' ').replace('Z', '')}`;
  }

  let setupPromise: Promise<void> | null = null;

  function setup(): Promise<void> {
    if (!setupPromise) {
      setupPromise = (async () => {
        const pool = await getPool();
        await pool.query(`
          CREATE TABLE IF NOT EXISTS app_users (
            id            VARCHAR(191) NOT NULL PRIMARY KEY,
            name          VARCHAR(191) NOT NULL,
            email         VARCHAR(191) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            initials      VARCHAR(8)   NOT NULL,
            avatar_color  VARCHAR(32)  NOT NULL DEFAULT '#27272A',
            is_online     TINYINT(1)   NOT NULL DEFAULT 0,
            last_seen     VARCHAR(64)  NOT NULL DEFAULT '',
            created_at    DATETIME(3)   NOT NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await pool.query(`
          CREATE TABLE IF NOT EXISTS app_conversations (
            id         VARCHAR(191) NOT NULL PRIMARY KEY,
            user_a_id  VARCHAR(191) NOT NULL,
            user_b_id  VARCHAR(191) NOT NULL,
            created_at DATETIME(3)  NOT NULL,
            updated_at DATETIME(3)  NOT NULL,
            UNIQUE KEY conversations_pair_uniq (user_a_id, user_b_id),
            KEY conversations_user_a_idx (user_a_id),
            KEY conversations_user_b_idx (user_b_id),
            CONSTRAINT conversations_a_fk FOREIGN KEY (user_a_id) REFERENCES app_users(id) ON DELETE CASCADE,
            CONSTRAINT conversations_b_fk FOREIGN KEY (user_b_id) REFERENCES app_users(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await pool.query(`
          CREATE TABLE IF NOT EXISTS app_messages (
            id              VARCHAR(191) NOT NULL PRIMARY KEY,
            conversation_id VARCHAR(191) NOT NULL,
            sender_id       VARCHAR(191) NOT NULL,
            recipient_id    VARCHAR(191) NOT NULL,
            text            TEXT          NOT NULL,
            created_at      DATETIME(3)   NOT NULL,
            is_read         TINYINT(1)    NOT NULL DEFAULT 0,
            KEY messages_conversation_idx (conversation_id, created_at),
            CONSTRAINT messages_conv_fk FOREIGN KEY (conversation_id) REFERENCES app_conversations(id) ON DELETE CASCADE,
            CONSTRAINT messages_sender_fk FOREIGN KEY (sender_id) REFERENCES app_users(id) ON DELETE CASCADE,
            CONSTRAINT messages_recipient_fk FOREIGN KEY (recipient_id) REFERENCES app_users(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        const [rows] = await pool.query<{ n: number }[] & [any]>(
'SELECT COUNT(*) AS n FROM app_users'
        );
        const count = Number((Array.isArray(rows) ? rows[0] : rows)?.n ?? 0);
        if (count > 0) return;

        const seed = buildSeed(hashPassword);
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          for (const u of seed.users) {
            await conn.execute(
              `INSERT IGNORE INTO app_users
                 (id, name, email, password_hash, initials, avatar_color, is_online, last_seen, created_at)
                VALUES (?,?,?,?,?,?,?,?,?)`,
              [u.id, u.name, u.email, u.passwordHash, u.initials, u.avatarColor, u.isOnline ? 1 : 0, u.lastSeen, toSqlDateTime(u.createdAt)]
            );
          }
          for (const c of seed.conversations) {
            const [a, b] = [...c.participantIds].sort();
            await conn.execute(
              `INSERT IGNORE INTO app_conversations (id, user_a_id, user_b_id, created_at, updated_at)
               VALUES (?,?,?,?,?)`,
              [c.id, a, b, toSqlDateTime(c.createdAt), toSqlDateTime(c.updatedAt)]
            );
          }
          for (const m of seed.messages) {
            await conn.execute(
              `INSERT IGNORE INTO app_messages
                 (id, conversation_id, sender_id, recipient_id, text, created_at, is_read)
                VALUES (?,?,?,?,?,?,?)`,
              [m.id, m.conversationId, m.senderId, m.recipientId, m.text, toSqlDateTime(m.createdAt), m.isRead ? 1 : 0]
            );
          }
          await conn.commit();
        } catch (err) {
          await conn.rollback();
          throw err;
        } finally {
          conn.release();
        }
      })().catch((err) => {
        setupPromise = null;
        void SETUP_LOCK;
        throw err;
      });
    }
    return setupPromise;
  }

  /** Syarat keanggotaan percakapan untuk user tertentu. */
  function membership(userId: string | null) {
    if (!userId) return { sql: '', params: [] as unknown[] };
    return {
      sql: ' AND (user_a_id = ? OR user_b_id = ?)',
      params: [userId, userId] as unknown[],
    };
  }

  return {
    name: 'mysql',
    enforcesIsolationInEngine: false,

    async ready() {
      await setup();
    },

    async loadDb(scopeUserId): Promise<DatabaseSchema> {
      await setup();
      const pool = await getPool();

      const [users] = await pool.query<UserRow[]>('SELECT * FROM app_users');
      let conversations: ConversationRow[] = [];
      let messages: MessageRow[] = [];

      if (scopeUserId) {
        [conversations] = await pool.query<ConversationRow[]>(
          'SELECT * FROM app_conversations WHERE user_a_id = ? OR user_b_id = ?',
          [scopeUserId, scopeUserId]
        );
        const ids = conversations.map((c) => c.id);
        if (ids.length > 0) {
          const placeholders = ids.map(() => '?').join(',');
          [messages] = await pool.query<MessageRow[]>(
            `SELECT * FROM app_messages WHERE conversation_id IN (${placeholders}) ORDER BY created_at ASC`,
            ids
          );
        }
      }

      return {
        users: users.map(rowToUser),
        conversations: conversations.map(rowToConversation),
        messages: messages.map(rowToMessage),
      };
    },

    async findUserByEmail(email) {
      await setup();
      const pool = await getPool();
      const [rows] = await pool.query<UserRow[]>(
        'SELECT * FROM app_users WHERE LOWER(email) = LOWER(?) LIMIT 1',
        [email]
      );
      return rows[0] ? rowToUser(rows[0]) : null;
    },

    async findUserById(id) {
      await setup();
      const pool = await getPool();
      const [rows] = await pool.query<UserRow[]>('SELECT * FROM app_users WHERE id = ? LIMIT 1', [id]);
      return rows[0] ? rowToUser(rows[0]) : null;
    },

    async findConversationById(id, scopeUserId) {
      await setup();
      const pool = await getPool();
      const m = membership(scopeUserId);
      const [rows] = await pool.query<ConversationRow[]>(
        `SELECT * FROM app_conversations WHERE id = ?${m.sql} LIMIT 1`,
        [id, ...m.params]
      );
      return rows[0] ? rowToConversation(rows[0]) : null;
    },

    async findConversationBetween(userA, userB) {
      await setup();
      const pool = await getPool();
      const [a, b] = [userA, userB].sort();
      const [rows] = await pool.query<ConversationRow[]>(
        'SELECT * FROM app_conversations WHERE user_a_id = ? AND user_b_id = ? LIMIT 1',
        [a, b]
      );
      return rows[0] ? rowToConversation(rows[0]) : null;
    },

    async getConversationParticipants(id) {
      await setup();
      const pool = await getPool();
      const [rows] = await pool.query<ConversationRow[]>(
        'SELECT id, user_a_id, user_b_id, created_at, updated_at FROM app_conversations WHERE id = ? LIMIT 1',
        [id]
      );
      if (!rows[0]) return null;
      return [rows[0].user_a_id, rows[0].user_b_id] as [string, string];
    },

    async createUser(user) {
      await setup();
      const pool = await getPool();
      await pool.execute(
        `INSERT INTO app_users (id, name, email, password_hash, initials, avatar_color, is_online, last_seen, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [user.id, user.name, user.email, user.passwordHash, user.initials, user.avatarColor, user.isOnline ? 1 : 0, user.lastSeen, toSqlDateTime(user.createdAt)]
      );
      return user;
    },

    async updateUserOnline(id, isOnline, lastSeen) {
      await setup();
      const pool = await getPool();
      await pool.execute('UPDATE app_users SET is_online = ?, last_seen = ? WHERE id = ?', [
        isOnline ? 1 : 0,
        lastSeen,
        id,
      ]);
    },

    async updateUserPasswordHash(id, passwordHash) {
      await setup();
      const pool = await getPool();
      await pool.execute('UPDATE app_users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
    },

    async createConversation(conversation, scopeUserId) {
      await setup();
      const pool = await getPool();
      const [a, b] = [...conversation.participantIds].sort();

      // Isolasi: hanya boleh membuat percakapan bila scope user adalah peserta.
      if (scopeUserId && !conversation.participantIds.includes(scopeUserId)) {
        throw new Error('FORBIDDEN_NOT_PARTICIPANT');
      }

      await pool.execute(
        `INSERT IGNORE INTO app_conversations (id, user_a_id, user_b_id, created_at, updated_at)
         VALUES (?,?,?,?,?)`,
        [conversation.id, a, b, toSqlDateTime(conversation.createdAt), toSqlDateTime(conversation.updatedAt)]
      );
      return conversation;
    },

    async listMessages(conversationId, scopeUserId) {
      await setup();
      const pool = await getPool();

      // Isolasi ditegakkan di level query lewat JOIN ke conversations:
      // hanya pesan dari percakapan yang diikuti user aktif yang dikembalikan.
      const sql = scopeUserId
        ? `SELECT msg.* FROM app_messages msg
             JOIN app_conversations c ON c.id = msg.conversation_id
            WHERE msg.conversation_id = ? AND (c.user_a_id = ? OR c.user_b_id = ?)
            ORDER BY msg.created_at ASC`
        : `SELECT * FROM app_messages WHERE conversation_id = ? ORDER BY created_at ASC`;
      const params = scopeUserId ? [conversationId, scopeUserId, scopeUserId] : [conversationId];

      const [rows] = await pool.query<MessageRow[]>(sql, params);
      return rows.map(rowToMessage);
    },

    async insertMessage(message, scopeUserId) {
      await setup();
      const pool = await getPool();
      if (scopeUserId && message.senderId !== scopeUserId) {
        throw new Error('FORBIDDEN_NOT_SENDER');
      }
      await pool.execute(
        `INSERT INTO app_messages (id, conversation_id, sender_id, recipient_id, text, created_at, is_read)
         VALUES (?,?,?,?,?,?,?)`,
        [message.id, message.conversationId, message.senderId, message.recipientId, message.text, toSqlDateTime(message.createdAt), 0]
      );
      await pool.execute('UPDATE app_conversations SET updated_at = ? WHERE id = ?', [
        toSqlDateTime(message.createdAt),
        message.conversationId,
      ]);
      return message;
    },

    async markConversationRead(conversationId, recipientId) {
      await setup();
      const pool = await getPool();
      const [result] = await pool.execute<any>(
        `UPDATE app_messages m
           JOIN app_conversations c ON c.id = m.conversation_id
            SET m.is_read = 1
          WHERE m.conversation_id = ?
            AND m.recipient_id = ?
            AND m.is_read = 0
            AND (c.user_a_id = ? OR c.user_b_id = ?)`,
        [conversationId, recipientId, recipientId, recipientId]
      );
      return Number(result?.affectedRows ?? 0) > 0;
    },
  };
}
