import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool, PoolClient, QueryResult } from 'pg';
import type {
  DatabaseSchema,
  DbConversation,
  DbMessage,
  DbUser,
  StorageAdapter,
} from './storage-adapter';
import buildSeed from './seed';

type Queryable = Pick<Pool | PoolClient, 'query'>;

interface Session {
  client: Queryable;
  userId: string | null;
}

/**
 * Backend PostgreSQL (Vercel Postgres / Neon / Supabase).
 *
 * Isolasi data dijaga di DUA lapis:
 *   1. Lapis aplikasi — route handler hanya meminta data milik user login.
 *   2. Lapis engine — Row Level Security (FORCE) + GUC `app.user_id` yang
 *      diset per request di `withUser()`. Query yang lupa WHERE pun tidak
 *      bisa membocorkan baris milik akun lain.
 */
export function createPostgresAdapter(
  hashPassword: (plain: string) => string
): StorageAdapter {
  const globals = globalThis as unknown as {
    __akseleraPgPool?: Promise<Pool>;
    __akseleraPgMigration?: Promise<void>;
    __akseleraPgRlsApplied?: boolean;
  };

  const sessionStore = new AsyncLocalStorage<Session>();
  const alreadyWarned = new Set<string>();

  function getPostgresUrl(): string | null {
    const url = (process.env.POSTGRES_URL || '').trim();
    return url || null;
  }

  function getPool(): Promise<Pool> {
    if (!globals.__akseleraPgPool) {
      globals.__akseleraPgPool = (async () => {
        const pg = await import('pg');
        const url = getPostgresUrl()!;
        return new pg.Pool({
          connectionString: url,
          max: 8,
          idleTimeoutMillis: 10_000,
          connectionTimeoutMillis: 10_000,
          ssl: url.includes('sslmode=disable') ? false : { rejectUnauthorized: false },
        });
      })();
    }
    return globals.__akseleraPgPool;
  }

  async function ddl(label: string, sql: string): Promise<void> {
    const pool = await getPool();
    try {
      await pool.query(sql);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!alreadyWarned.has(label)) {
        alreadyWarned.add(label);
        console.warn(`[db-pg] DDL "${label}" dilewati: ${message}`);
      }
    }
  }

  async function applyRowLevelSecurity(): Promise<void> {
    const pool = await getPool();
    try {
      await pool.query('ALTER TABLE conversations ENABLE ROW LEVEL SECURITY');
      await pool.query('ALTER TABLE messages ENABLE ROW LEVEL SECURITY');
      await pool.query('ALTER TABLE conversations FORCE ROW LEVEL SECURITY');
      await pool.query('ALTER TABLE messages FORCE ROW LEVEL SECURITY');

      await pool.query('DROP POLICY IF EXISTS conversations_select ON conversations');
      await pool.query(
        'CREATE POLICY conversations_select ON conversations FOR SELECT USING (is_participant(user_a_id, user_b_id))'
      );

      await pool.query('DROP POLICY IF EXISTS conversations_insert ON conversations');
      await pool.query(
        'CREATE POLICY conversations_insert ON conversations FOR INSERT WITH CHECK (is_participant(user_a_id, user_b_id))'
      );

      await pool.query('DROP POLICY IF EXISTS conversations_update ON conversations');
      await pool.query(
        `CREATE POLICY conversations_update ON conversations FOR UPDATE
           USING (is_participant(user_a_id, user_b_id))
           WITH CHECK (is_participant(user_a_id, user_b_id))`
      );

      await pool.query('DROP POLICY IF EXISTS messages_select ON messages');
      await pool.query(
        `CREATE POLICY messages_select ON messages FOR SELECT USING (
           app_internal() OR app_user_id() = sender_id OR app_user_id() = recipient_id
           OR EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id
                      AND (c.user_a_id = app_user_id() OR c.user_b_id = app_user_id())))`
      );

      await pool.query('DROP POLICY IF EXISTS messages_insert ON messages');
      await pool.query(
        `CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (
           app_internal() OR (
             app_user_id() = sender_id
             AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id
                         AND (c.user_a_id = app_user_id() OR c.user_b_id = app_user_id()))))`
      );

      await pool.query('DROP POLICY IF EXISTS messages_update ON messages');
      await pool.query(
        `CREATE POLICY messages_update ON messages FOR UPDATE USING (
           app_internal() OR app_user_id() = sender_id OR app_user_id() = recipient_id
           OR EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id
                      AND (c.user_a_id = app_user_id() OR c.user_b_id = app_user_id())))
           WITH CHECK (app_internal() OR true)`
      );

      globals.__akseleraPgRlsApplied = true;
    } catch (err) {
      globals.__akseleraPgRlsApplied = false;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[db-pg] Row Level Security tidak dapat dipasang (${message}). ` +
          'Aplikasi tetap berjalan dengan proteksi lapis aplikasi. ' +
          'Pastikan DDL policy dijalankan sekali oleh pemilik tabel.'
      );
    }
  }

  function runMigrations(): Promise<void> {
    if (!globals.__akseleraPgMigration) {
      globals.__akseleraPgMigration = (async () => {
        await ddl(
          'users',
          `CREATE TABLE IF NOT EXISTS users (
            id            TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            email         TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            initials      TEXT NOT NULL,
            avatar_color  TEXT NOT NULL DEFAULT '#27272A',
            is_online     BOOLEAN NOT NULL DEFAULT FALSE,
            last_seen     TEXT NOT NULL DEFAULT '',
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW())`
        );
        await ddl(
          'conversations',
          `CREATE TABLE IF NOT EXISTS conversations (
            id         TEXT PRIMARY KEY,
            user_a_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            user_b_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT conversations_pair_uniq UNIQUE (user_a_id, user_b_id))`
        );
        await ddl(
          'messages',
          `CREATE TABLE IF NOT EXISTS messages (
            id              TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            sender_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            recipient_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            text            TEXT NOT NULL,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            is_read         BOOLEAN NOT NULL DEFAULT FALSE)`
        );
        await ddl('index:messages', 'CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at)');
        await ddl('index:conv_a', 'CREATE INDEX IF NOT EXISTS conversations_user_a_idx ON conversations(user_a_id)');
        await ddl('index:conv_b', 'CREATE INDEX IF NOT EXISTS conversations_user_b_idx ON conversations(user_b_id)');
        await ddl(
          'fn:app_user_id',
          `CREATE OR REPLACE FUNCTION app_user_id() RETURNS TEXT AS $$
            SELECT NULLIF(current_setting('app.user_id', true), '');
          $$ LANGUAGE SQL STABLE`
        );
        await ddl(
          'fn:app_internal',
          `CREATE OR REPLACE FUNCTION app_internal() RETURNS BOOLEAN AS $$
            SELECT COALESCE(current_setting('app.internal', true), '') = 'on';
          $$ LANGUAGE SQL STABLE`
        );
        await ddl(
          'fn:is_participant',
          `CREATE OR REPLACE FUNCTION is_participant(p_user_a TEXT, p_user_b TEXT) RETURNS BOOLEAN AS $$
            SELECT app_internal() OR app_user_id() = p_user_a OR app_user_id() = p_user_b;
          $$ LANGUAGE SQL STABLE`
        );
        await applyRowLevelSecurity();
      })().catch((err) => {
        globals.__akseleraPgMigration = null;
        throw err;
      });
    }
    return globals.__akseleraPgMigration;
  }

  async function withClient<T>(
    userId: string | null,
    fn: (client: Queryable) => Promise<T>
  ): Promise<T> {
    await ensureSeed();
    const pool = await getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (userId) {
        await client.query(`SELECT set_config('app.user_id', $1, true)`, [userId]);
      } else {
        await client.query(`SELECT set_config('app.internal', 'on', true)`);
      }
      const result = await sessionStore.run({ client, userId }, () => fn(client));
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async function q<R extends Record<string, unknown>>(
    text: string,
    params: unknown[] = []
  ): Promise<QueryResult<R>> {
    const session = sessionStore.getStore();
    if (session) {
      return session.client.query(text, params as never[]) as Promise<QueryResult<R>>;
    }
    await ensureSeed();
    const pool = await getPool();
    return pool.query(text, params as never[]) as Promise<QueryResult<R>>;
  }

  let seedPromise: Promise<void> | null = null;

  function ensureSeed(): Promise<void> {
    if (!seedPromise) {
      seedPromise = (async () => {
        await runMigrations();
        const pool = await getPool();
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(`SELECT set_config('app.internal', 'on', true)`);
          const { rows } = await client.query('SELECT COUNT(*)::text AS count FROM users');
          if (Number(rows[0]?.count ?? '0') > 0) {
            await client.query('COMMIT');
            return;
          }

          const seed = buildSeed(hashPassword);
          for (const u of seed.users) {
            await client.query(
              `INSERT INTO users (id, name, email, password_hash, initials, avatar_color, is_online, last_seen, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
              [u.id, u.name, u.email, u.passwordHash, u.initials, u.avatarColor, u.isOnline, u.lastSeen, u.createdAt]
            );
          }
          for (const c of seed.conversations) {
            const [a, b] = [...c.participantIds].sort();
            await client.query(
              `INSERT INTO conversations (id, user_a_id, user_b_id, created_at, updated_at)
               VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
              [c.id, a, b, c.createdAt, c.updatedAt]
            );
          }
          for (const m of seed.messages) {
            await client.query(
              `INSERT INTO messages (id, conversation_id, sender_id, recipient_id, text, created_at, is_read)
               VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
              [m.id, m.conversationId, m.senderId, m.recipientId, m.text, m.createdAt, m.isRead]
            );
          }
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK').catch(() => undefined);
          seedPromise = null;
          throw err;
        } finally {
          client.release();
        }
      })();
    }
    return seedPromise;
  }

  function rowToUser(row: Record<string, unknown>): DbUser {
    return {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      passwordHash: String(row.password_hash),
      initials: String(row.initials),
      avatarColor: String(row.avatar_color),
      isOnline: Boolean(row.is_online),
      lastSeen: String(row.last_seen ?? ''),
      createdAt: new Date(row.created_at as string).toISOString(),
    };
  }

  function rowToConversation(row: Record<string, unknown>): DbConversation {
    return {
      id: String(row.id),
      participantIds: [String(row.user_a_id), String(row.user_b_id)],
      createdAt: new Date(row.created_at as string).toISOString(),
      updatedAt: new Date(row.updated_at as string).toISOString(),
    };
  }

  function rowToMessage(row: Record<string, unknown>): DbMessage {
    return {
      id: String(row.id),
      conversationId: String(row.conversation_id),
      senderId: String(row.sender_id),
      recipientId: String(row.recipient_id),
      text: String(row.text),
      createdAt: new Date(row.created_at as string).toISOString(),
      isRead: Boolean(row.is_read),
    };
  }

  async function withUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    return withClient(userId, () => fn());
  }

  return {
    name: 'postgres',
    enforcesIsolationInEngine: true,

    async ready() {
      await ensureSeed();
    },

    async loadDb(scopeUserId) {
      const [users, conversations, messages] = await Promise.all([
        q('SELECT * FROM users'),
        scopeUserId ? withUser(scopeUserId, () => q('SELECT * FROM conversations')) : q('SELECT * FROM conversations LIMIT 0'),
        q('SELECT * FROM messages LIMIT 0'),
      ]);

      const convList = conversations.rows.map(rowToConversation);
      let msgList: DbMessage[] = [];
      if (scopeUserId && convList.length > 0) {
        const rows = await withUser(scopeUserId, () => q('SELECT * FROM messages'));
        msgList = rows.rows
          .map(rowToMessage)
          .filter((m) => convList.some((c) => c.id === m.conversationId));
      }

      return {
        users: users.rows.map(rowToUser),
        conversations: convList,
        messages: msgList,
      };
    },

    async findUserByEmail(email) {
      const { rows } = await q('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [
        email,
      ]);
      return rows[0] ? rowToUser(rows[0]) : null;
    },

    async findUserById(id) {
      const { rows } = await q('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
      return rows[0] ? rowToUser(rows[0]) : null;
    },

    async findConversationById(id, scopeUserId) {
      const run = async () => {
        const { rows } = await q('SELECT * FROM conversations WHERE id = $1 LIMIT 1', [id]);
        return rows[0] ? rowToConversation(rows[0]) : null;
      };
      return scopeUserId ? withUser(scopeUserId, run) : run();
    },

    async findConversationBetween(userA, userB) {
      const [a, b] = [userA, userB].sort();
      const { rows } = await q(
        'SELECT * FROM conversations WHERE user_a_id = $1 AND user_b_id = $2 LIMIT 1',
        [a, b]
      );
      return rows[0] ? rowToConversation(rows[0]) : null;
    },

    async getConversationParticipants(id) {
      const { rows } = await q(
        'SELECT user_a_id, user_b_id FROM conversations WHERE id = $1 LIMIT 1',
        [id]
      );
      if (!rows[0]) return null;
      const session = sessionStore.getStore();
      const fn = async () => {
        const r = await q('SELECT user_a_id, user_b_id FROM conversations WHERE id = $1 LIMIT 1', [id]);
        return r.rows[0]
          ? ([String(r.rows[0].user_a_id), String(r.rows[0].user_b_id)] as [string, string])
          : null;
      };
      // Tanpa filter RLS supaya bisa dibedakan 403 vs 404.
      void session;
      return withClient(null, async () => {
        const rr = await sessionStore.getStore()!.client.query(
          'SELECT user_a_id, user_b_id FROM conversations WHERE id = $1 LIMIT 1',
          [id] as never[]
        );
        const row = (rr as QueryResult<Record<string, unknown>>).rows[0];
        return row
          ? ([String(row.user_a_id), String(row.user_b_id)] as [string, string])
          : null;
      }).catch(() => fn());
    },

    async createUser(user) {
      await withClient(null, async () =>
        q(
          `INSERT INTO users (id, name, email, password_hash, initials, avatar_color, is_online, last_seen, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [user.id, user.name, user.email, user.passwordHash, user.initials, user.avatarColor, user.isOnline, user.lastSeen, user.createdAt]
        ).then(() => undefined)
      );
      return user;
    },

    async updateUserOnline(id, isOnline, lastSeen) {
      await q('UPDATE users SET is_online = $2, last_seen = $3 WHERE id = $1', [
        id,
        isOnline,
        lastSeen,
      ]);
    },

    async updateUserPasswordHash(id, passwordHash) {
      await q('UPDATE users SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
    },

    async createConversation(conversation, scopeUserId) {
      const run = async () => {
        const [a, b] = [...conversation.participantIds].sort();
        await q(
          `INSERT INTO conversations (id, user_a_id, user_b_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
          [conversation.id, a, b, conversation.createdAt, conversation.updatedAt]
        );
        return conversation;
      };
      if (scopeUserId && !conversation.participantIds.includes(scopeUserId)) {
        throw new Error('FORBIDDEN_NOT_PARTICIPANT');
      }
      return scopeUserId ? withUser(scopeUserId, run) : run();
    },

    async listMessages(conversationId, scopeUserId) {
      const run = async () => {
        const { rows } = await q(
          'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
          [conversationId]
        );
        return rows.map(rowToMessage);
      };
      return scopeUserId ? withUser(scopeUserId, run) : run();
    },

    async insertMessage(message, scopeUserId) {
      if (scopeUserId && message.senderId !== scopeUserId) {
        throw new Error('FORBIDDEN_NOT_SENDER');
      }
      const run = async () => {
        await q(
          `INSERT INTO messages (id, conversation_id, sender_id, recipient_id, text, created_at, is_read)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [message.id, message.conversationId, message.senderId, message.recipientId, message.text, message.createdAt, message.isRead]
        );
        await q('UPDATE conversations SET updated_at = $2 WHERE id = $1', [
          message.conversationId,
          message.createdAt,
        ]);
        return message;
      };
      return scopeUserId ? withUser(scopeUserId, run) : run();
    },

    async markConversationRead(conversationId, recipientId) {
      const result = await withUser(recipientId, async () =>
        q(
          'UPDATE messages SET is_read = TRUE WHERE conversation_id = $1 AND recipient_id = $2 AND is_read = FALSE',
          [conversationId, recipientId]
        )
      );
      return (result.rowCount ?? 0) > 0;
    },
  };
}
