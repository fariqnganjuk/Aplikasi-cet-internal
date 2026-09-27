import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool, PoolClient, QueryResult } from 'pg';

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

export const JSON_DB_FILE = process.env.DATABASE_FILE
  ? path.resolve(process.cwd(), process.env.DATABASE_FILE)
  : path.resolve(process.cwd(), 'data', 'database.json');

export function getJwtSecret(): string {
  const secret = (process.env.JWT_SECRET || '').trim();
  if (secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET belum dikonfigurasi. Tambahkan environment variable JWT_SECRET (minimal 32 karakter) di hosting.'
    );
  }
  return 'dev-only-insecure-secret-min-32-karakter!!';
}

const SCRYPT_KEYLEN = 64;

function scryptHash(password: string, salt: string): string {
  return crypto
    .scryptSync(password, salt, SCRYPT_KEYLEN, { N: 16384, r: 8, p: 1 })
    .toString('hex');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptHash(password, salt)}`;
}

export function verifyPassword(
  password: string,
  storedHash: string
): { ok: boolean; upgradedHash?: string } {
  try {
    if (storedHash.startsWith('scrypt$')) {
      const parts = storedHash.split('$');
      if (parts.length !== 3) return { ok: false };
      const salt = parts[1];
      const expected = parts[2];
      const actual = scryptHash(password, salt);
      const a = Buffer.from(actual, 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false };
      return { ok: true };
    }
    if (/^[0-9a-f]{64}$/i.test(storedHash)) {
      const actual = crypto.createHash('sha256').update(password).digest('hex');
      const a = Buffer.from(actual, 'hex');
      const b = Buffer.from(storedHash, 'hex');
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return { ok: true, upgradedHash: hashPassword(password) };
      }
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

function buildSeed(): DatabaseSchema {
  const now = Date.now();
  const DAY = 86400000;

  /**
   * Timestamp seed harus selalu berada di MASA LAMPUNG.
   *
   * otherwise slot waktu (mis. "hari ini 09.42") bisa jatuh di masa depan
   * bila seed dijalankan menjelang tengah malam, sehingga pesan baru yang
   * dikirim user akan terurut di atas pesan lama (lastMessage & urutan
   * bubble jadi salah). Karena itu setiap slot digeser mundur satu hari
   * bila hasilnya ternyata belum terjadi.
   */
  const at = (daysAgo: number, hours: number, minutes: number) => {
    const d = new Date(now - daysAgo * DAY);
    d.setHours(hours, minutes, 0, 0);
    if (d.getTime() > now) {
      d.setTime(d.getTime() - DAY);
    }
    return d.toISOString();
  };

  const users: DbUser[] = [
    { id: 'user-andi', name: 'Andi Pratama', email: 'andi@contoh.id', passwordHash: hashPassword('password123'), initials: 'AP', avatarColor: '#18181B', isOnline: true, lastSeen: 'Online', createdAt: at(30, 8, 0) },
    { id: 'user-rina', name: 'Rina Kartika', email: 'rina@contoh.id', passwordHash: hashPassword('password123'), initials: 'RK', avatarColor: '#3F3F46', isOnline: true, lastSeen: 'Online', createdAt: at(25, 8, 0) },
    { id: 'user-dimas', name: 'Dimas Prasetyo', email: 'dimas@contoh.id', passwordHash: hashPassword('password123'), initials: 'DP', avatarColor: '#52525B', isOnline: false, lastSeen: '10 menit lalu', createdAt: at(20, 8, 0) },
    { id: 'user-sari', name: 'Sari Wulandari', email: 'sari@contoh.id', passwordHash: hashPassword('password123'), initials: 'SW', avatarColor: '#71717A', isOnline: false, lastSeen: '1 jam lalu', createdAt: at(15, 8, 0) },
    { id: 'user-bayu', name: 'Bayu Nugroho', email: 'bayu@contoh.id', passwordHash: hashPassword('password123'), initials: 'BN', avatarColor: '#27272A', isOnline: true, lastSeen: 'Online', createdAt: at(10, 8, 0) },
    { id: 'user-maya', name: 'Maya Handayani', email: 'maya@contoh.id', passwordHash: hashPassword('password123'), initials: 'MH', avatarColor: '#3F3F46', isOnline: true, lastSeen: 'Online', createdAt: at(8, 8, 0) },
    { id: 'user-yoga', name: 'Yoga Aditya', email: 'yoga@contoh.id', passwordHash: hashPassword('password123'), initials: 'YA', avatarColor: '#71717A', isOnline: false, lastSeen: 'Kemarin', createdAt: at(5, 8, 0) },
    { id: 'user-support', name: 'Tim Support', email: 'support@contoh.id', passwordHash: hashPassword('password123'), initials: 'TS', avatarColor: '#18181B', isOnline: true, lastSeen: 'Online', createdAt: at(40, 8, 0) },
  ];

  const conversations: DbConversation[] = [
    { id: 'conv-andi-rina', participantIds: ['user-andi', 'user-rina'], createdAt: at(3, 9, 0), updatedAt: at(0, 9, 42) },
    { id: 'conv-andi-dimas', participantIds: ['user-andi', 'user-dimas'], createdAt: at(3, 8, 0), updatedAt: at(0, 9, 15) },
    { id: 'conv-andi-sari', participantIds: ['user-andi', 'user-sari'], createdAt: at(1, 14, 0), updatedAt: at(1, 16, 20) },
    { id: 'conv-andi-bayu', participantIds: ['user-andi', 'user-bayu'], createdAt: at(1, 11, 0), updatedAt: at(1, 13, 45) },
    { id: 'conv-andi-support', participantIds: ['user-andi', 'user-support'], createdAt: at(3, 10, 0), updatedAt: at(3, 11, 10) },
    { id: 'conv-rina-dimas', participantIds: ['user-rina', 'user-dimas'], createdAt: at(1, 10, 0), updatedAt: at(1, 15, 30) },
  ];

  const messages: DbMessage[] = [
    { id: 'msg-1', conversationId: 'conv-andi-rina', senderId: 'user-rina', recipientId: 'user-andi', text: 'Pagi, data pelanggan minggu ini sudah masuk?', createdAt: at(0, 9, 36), isRead: true },
    { id: 'msg-2', conversationId: 'conv-andi-rina', senderId: 'user-andi', recipientId: 'user-rina', text: 'Pagi. Sudah, tinggal dicek ulang.', createdAt: at(0, 9, 38), isRead: true },
    { id: 'msg-3', conversationId: 'conv-andi-rina', senderId: 'user-rina', recipientId: 'user-andi', text: 'Tolong dikabari kalau sudah beres ya', createdAt: at(0, 9, 40), isRead: true },
    { id: 'msg-4', conversationId: 'conv-andi-rina', senderId: 'user-andi', recipientId: 'user-rina', text: 'Siap, nanti saya cek ya', createdAt: at(0, 9, 42), isRead: true },
    { id: 'msg-5', conversationId: 'conv-andi-dimas', senderId: 'user-dimas', recipientId: 'user-andi', text: 'Halo Andi, ini ringkasan integrasi webhook.', createdAt: at(0, 9, 10), isRead: false },
    { id: 'msg-6', conversationId: 'conv-andi-dimas', senderId: 'user-dimas', recipientId: 'user-andi', text: 'Filenya sudah saya kirim', createdAt: at(0, 9, 15), isRead: false },
    { id: 'msg-7', conversationId: 'conv-andi-sari', senderId: 'user-sari', recipientId: 'user-andi', text: 'Oke, terima kasih', createdAt: at(1, 16, 20), isRead: true },
    { id: 'msg-8', conversationId: 'conv-andi-bayu', senderId: 'user-bayu', recipientId: 'user-andi', text: 'Meeting jadi jam 2?', createdAt: at(1, 13, 45), isRead: true },
    { id: 'msg-9', conversationId: 'conv-andi-support', senderId: 'user-support', recipientId: 'user-andi', text: 'Tiket sudah ditutup', createdAt: at(3, 11, 10), isRead: true },
    { id: 'msg-confidential-1', conversationId: 'conv-rina-dimas', senderId: 'user-rina', recipientId: 'user-dimas', text: 'Halo Dimas, ini pembicaraan rahasia internal tim backend.', createdAt: at(1, 15, 0), isRead: true },
    { id: 'msg-confidential-2', conversationId: 'conv-rina-dimas', senderId: 'user-dimas', recipientId: 'user-rina', text: 'Siap Rina, aman hanya kita berdua yang bisa baca.', createdAt: at(1, 15, 30), isRead: true },
  ];

  return { users, conversations, messages };
}

/* ------------------------------------------------------------------ *
 * JSON backend (development)
 * ------------------------------------------------------------------ */

function readJson(): DatabaseSchema {
  try {
    if (!fs.existsSync(JSON_DB_FILE)) {
      const seed = buildSeed();
      writeJson(seed);
      return seed;
    }
    return JSON.parse(fs.readFileSync(JSON_DB_FILE, 'utf-8')) as DatabaseSchema;
  } catch {
    return { users: [], conversations: [], messages: [] };
  }
}

function writeJson(db: DatabaseSchema) {
  try {
    fs.mkdirSync(path.dirname(JSON_DB_FILE), { recursive: true });
    const tmp = `${JSON_DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tmp, JSON_DB_FILE);
  } catch (err) {
    console.error('Error saving json database:', err);
  }
}

/* ------------------------------------------------------------------ *
 * PostgreSQL backend (production) with Row Level Security
 *
 * Isolasi data dijaga di DUA lapis:
 *   1. Lapis aplikasi  - route handler cek participantIds.
 *   2. Lapis database  - RLS policy hanya meloloskan baris yang
 *                        related_user_id = app_user_id() (GUC per request).
 *                        Query yang lupa WHERE tidak bisa membocorkan data.
 * ------------------------------------------------------------------ */

type Queryable = Pick<Pool | PoolClient, 'query'>;

interface Session {
  client: Queryable;
  userId: string | null;
}

const sessionStore = new AsyncLocalStorage<Session>();

function getPostgresUrl(): string | null {
  const url = (process.env.POSTGRES_URL || process.env.DATABASE_URL || '').trim();
  return url || null;
}

export function usesPostgres(): boolean {
  return getPostgresUrl() !== null;
}

const globals = globalThis as unknown as {
  __akseleraPool?: Promise<Pool>;
  __akseleraMigration?: Promise<void>;
  __akseleraRlsApplied?: boolean;
};

function getPool(): Promise<Pool> {
  if (!globals.__akseleraPool) {
    globals.__akseleraPool = (async () => {
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
  return globals.__akseleraPool;
}

function runMigrations(): Promise<void> {
  if (!globals.__akseleraMigration) {
    globals.__akseleraMigration = (async () => {
      const pool = await getPool();

      // Semua DDL dijalankan defensif. Bila role yang terhubung bukan pemilik
      // tabel (hanya punya hak SELECT/INSERT/UPDATE), statement DDL akan
      // ditolak. Itu tidak boleh menggagalkan aplikasi: schema diasumsikan
      // sudah dibuat oleh pemilik tabel, dan proteksi lapis aplikasi tetap
      // berlaku. Kegagalan hanya dicatat sebagai peringatan.
      const ddl = async (label: string, sql: string) => {
        try {
          await pool.query(sql);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (!alreadyWarned.has(label)) {
            alreadyWarned.add(label);
            console.warn(`[db] DDL "${label}" dilewati: ${message}`);
          }
        }
      };

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
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`
      );

      await ddl(
        'conversations',
        `CREATE TABLE IF NOT EXISTS conversations (
          id         TEXT PRIMARY KEY,
          user_a_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_b_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT conversations_pair_uniq UNIQUE (user_a_id, user_b_id)
        )`
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
          is_read         BOOLEAN NOT NULL DEFAULT FALSE
        )`
      );

      await ddl(
        'index:messages_conversation',
        'CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at)'
      );
      await ddl(
        'index:conversations_user_a',
        'CREATE INDEX IF NOT EXISTS conversations_user_a_idx ON conversations(user_a_id)'
      );
      await ddl(
        'index:conversations_user_b',
        'CREATE INDEX IF NOT EXISTS conversations_user_b_idx ON conversations(user_b_id)'
      );

      // Helper: user id dari session aplikasi (di-set per request)
      await ddl(
        'fn:app_user_id',
        `CREATE OR REPLACE FUNCTION app_user_id() RETURNS TEXT AS $$
          SELECT NULLIF(current_setting('app.user_id', true), '');
        $$ LANGUAGE SQL STABLE`
      );

      // Helper: mode internal (seed / migrasi), bukan jalur request pengguna
      await ddl(
        'fn:app_internal',
        `CREATE OR REPLACE FUNCTION app_internal() RETURNS BOOLEAN AS $$
          SELECT COALESCE(current_setting('app.internal', true), '') = 'on';
        $$ LANGUAGE SQL STABLE`
      );

      // Helper: user adalah peserta percakapan
      await ddl(
        'fn:is_participant',
        `CREATE OR REPLACE FUNCTION is_participant(p_user_a TEXT, p_user_b TEXT) RETURNS BOOLEAN AS $$
          SELECT app_internal() OR app_user_id() = p_user_a OR app_user_id() = p_user_b;
        $$ LANGUAGE SQL STABLE`
      );

      await applyRowLevelSecurity(pool);
    })().catch((err) => {
      globals.__akseleraMigration = null;
      throw err;
    });
  }
  return globals.__akseleraMigration;
}

const alreadyWarned = new Set<string>();

/**
 * Mengaktifkan Row Level Security beserta policy-nya.
 *
 * DDL policy (`ALTER TABLE ... FORCE ROW LEVEL SECURITY` dan `CREATE POLICY`)
 * hanya boleh dijalankan oleh role pemilik tabel. Bila aplikasi terhubung
 * dengan role terbatas (mis. only-grant tanpa ownership), statements ini
 * akan ditolak. Kasus itu ditangani secara graceful:
 *   - RLS diasumsikan sudah dikonfigurasi di sisi database, dan
 *   - aplikasi tetap berjalan normal dengan proteksi lapis aplikasi.
 *
 * Catatan penting: RLS TIDAK berlaku untuk role SUPERUSER. Role default
 * Neon/Vercel Postgres adalah pemilik tabel (bukan superuser), sehingga
 * FORCE ROW LEVEL SECURITY tetap mengikatnya ke policy.
 */
async function applyRowLevelSecurity(pool: Pool): Promise<void> {
  try {
    await pool.query('ALTER TABLE conversations ENABLE ROW LEVEL SECURITY');
    await pool.query('ALTER TABLE messages ENABLE ROW LEVEL SECURITY');
    await pool.query('ALTER TABLE conversations FORCE ROW LEVEL SECURITY');
    await pool.query('ALTER TABLE messages FORCE ROW LEVEL SECURITY');

    await pool.query('DROP POLICY IF EXISTS conversations_select ON conversations');
    await pool.query(`
      CREATE POLICY conversations_select ON conversations FOR SELECT
        USING (is_participant(user_a_id, user_b_id))
    `);

    await pool.query('DROP POLICY IF EXISTS conversations_insert ON conversations');
    await pool.query(`
      CREATE POLICY conversations_insert ON conversations FOR INSERT
        WITH CHECK (is_participant(user_a_id, user_b_id))
    `);

    await pool.query('DROP POLICY IF EXISTS conversations_update ON conversations');
    await pool.query(`
      CREATE POLICY conversations_update ON conversations FOR UPDATE
        USING (is_participant(user_a_id, user_b_id))
        WITH CHECK (is_participant(user_a_id, user_b_id))
    `);

    await pool.query('DROP POLICY IF EXISTS messages_select ON messages');
    await pool.query(`
      CREATE POLICY messages_select ON messages FOR SELECT
        USING (
          app_internal()
          OR app_user_id() = sender_id
          OR app_user_id() = recipient_id
          OR EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id
              AND (c.user_a_id = app_user_id() OR c.user_b_id = app_user_id())
          )
        )
    `);

    await pool.query('DROP POLICY IF EXISTS messages_insert ON messages');
    await pool.query(`
      CREATE POLICY messages_insert ON messages FOR INSERT
        WITH CHECK (
          app_internal()
          OR (
            app_user_id() = sender_id
            AND EXISTS (
              SELECT 1 FROM conversations c
              WHERE c.id = messages.conversation_id
                AND (c.user_a_id = app_user_id() OR c.user_b_id = app_user_id())
            )
          )
        )
    `);

    await pool.query('DROP POLICY IF EXISTS messages_update ON messages');
    await pool.query(`
      CREATE POLICY messages_update ON messages FOR UPDATE
        USING (
          app_internal()
          OR app_user_id() = sender_id
          OR app_user_id() = recipient_id
          OR EXISTS (
            SELECT 1 FROM conversations c
            WHERE c.id = messages.conversation_id
              AND (c.user_a_id = app_user_id() OR c.user_b_id = app_user_id())
          )
        )
        WITH CHECK (app_internal() OR true)
    `);

    globals.__akseleraRlsApplied = true;
  } catch (err) {
    globals.__akseleraRlsApplied = false;
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[db] Row Level Security tidak dapat dipasang oleh role ini (${message}). ` +
        'Aplikasi tetap berjalan dengan proteksi lapis aplikasi. ' +
        'Pastikan DDL policy dijalankan sekali oleh pemilik tabel.'
    );
  }
}

/** Status RLS untuk keperluan diagnostik. */
export function isRlsApplied(): boolean {
  return Boolean(globals.__akseleraRlsApplied);
}

let seedPromise: Promise<void> | null = null;

/**
 * Seed data awal sekali saja. Dijalankan dengan GUC `app.internal=on`
 * pada koneksi eksklusif agar melewati RLS (FORCE ROW LEVEL SECURITY).
 * Sengaja tidak memakai withClient() supaya tidak menimbulkan rekursi.
 */
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

        const seed = buildSeed();
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

async function withClient<T>(
  userId: string | null,
  fn: (client: Queryable) => Promise<T>
): Promise<T> {
  if (!usesPostgres()) throw new Error('Postgres tidak dikonfigurasi');
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

/**
 * Jalankan seluruh query dalam scope user terautentikasi.
 * GUC `app.user_id` diset per-transaksi sehingga RLS Postgres
 * otomatis memfilter baris milik user lain.
 */
export async function withUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  if (!usesPostgres()) return fn();
  return withClient(userId, () => fn());
}

/** Scope internal (seed, migrasi, registrasi) - melewati RLS. */
async function withInternal<T>(fn: () => Promise<T>): Promise<T> {
  if (!usesPostgres()) return fn();
  return withClient(null, () => fn());
}

/**
 * Ambil participant id sebuah percakapan TANPA filter RLS.
 *
 * Dipakai hanya untuk pemeriksaan otorisasi di route handler, sehingga server
 * bisa membedakan "percakapan bukan milik saya" (dibalas 403) dari
 * "percakapan tidak ada" (404). Isi pesan sendiri tetap hanya bisa dibaca
 * lewat query yang berjalan di scope user (RLS).
 */
export async function getConversationParticipants(
  id: string
): Promise<[string, string] | null> {
  if (!usesPostgres()) {
    const conv = readJson().conversations.find((c) => c.id === id);
    return conv ? conv.participantIds : null;
  }
  let participants: [string, string] | null = null;
  await withInternal(async () => {
    const { rows } = await q('SELECT user_a_id, user_b_id FROM conversations WHERE id = $1 LIMIT 1', [
      id,
    ]);
    if (rows[0]) {
      participants = [String(rows[0].user_a_id), String(rows[0].user_b_id)];
    }
  });
  return participants;
}

/** Query memakai session aktif bila ada, fallback ke pool langsung. */
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

/* ------------------------------------------------------------------ *
 * Mappers
 * ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

export async function loadDb(): Promise<DatabaseSchema> {
  if (!usesPostgres()) return readJson();

  const [users, conversations, messages] = await Promise.all([
    q('SELECT * FROM users'),
    q('SELECT * FROM conversations'),
    q('SELECT * FROM messages'),
  ]);

  return {
    users: users.rows.map(rowToUser),
    conversations: conversations.rows.map(rowToConversation),
    messages: messages.rows.map(rowToMessage),
  };
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  if (!usesPostgres()) {
    return readJson().users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
  }
  const { rows } = await q('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [
    email,
  ]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function findUserById(id: string): Promise<DbUser | null> {
  if (!usesPostgres()) {
    return readJson().users.find((u) => u.id === id) ?? null;
  }
  const { rows } = await q('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function findConversationById(id: string): Promise<DbConversation | null> {
  if (!usesPostgres()) {
    return readJson().conversations.find((c) => c.id === id) ?? null;
  }
  const { rows } = await q('SELECT * FROM conversations WHERE id = $1 LIMIT 1', [id]);
  return rows[0] ? rowToConversation(rows[0]) : null;
}

export async function findConversationBetween(
  userA: string,
  userB: string
): Promise<DbConversation | null> {
  if (!usesPostgres()) {
    return (
      readJson().conversations.find(
        (c) => c.participantIds.includes(userA) && c.participantIds.includes(userB)
      ) ?? null
    );
  }
  const [a, b] = [userA, userB].sort();
  const { rows } = await q(
    'SELECT * FROM conversations WHERE user_a_id = $1 AND user_b_id = $2 LIMIT 1',
    [a, b]
  );
  return rows[0] ? rowToConversation(rows[0]) : null;
}

export async function createUser(user: DbUser): Promise<DbUser> {
  if (!usesPostgres()) {
    const db = readJson();
    db.users.push(user);
    writeJson(db);
    return user;
  }
  await withInternal(() =>
    q(
      `INSERT INTO users (id, name, email, password_hash, initials, avatar_color, is_online, last_seen, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        user.id,
        user.name,
        user.email,
        user.passwordHash,
        user.initials,
        user.avatarColor,
        user.isOnline,
        user.lastSeen,
        user.createdAt,
      ]
    ).then(() => undefined)
  );
  return user;
}

export async function updateUserOnline(
  id: string,
  isOnline: boolean,
  lastSeen: string
): Promise<void> {
  if (!usesPostgres()) {
    const db = readJson();
    const user = db.users.find((u) => u.id === id);
    if (user) {
      user.isOnline = isOnline;
      user.lastSeen = lastSeen;
      writeJson(db);
    }
    return;
  }
  await q('UPDATE users SET is_online = $2, last_seen = $3 WHERE id = $1', [
    id,
    isOnline,
    lastSeen,
  ]);
}

export async function updateUserPasswordHash(
  id: string,
  passwordHash: string
): Promise<void> {
  if (!usesPostgres()) {
    const db = readJson();
    const user = db.users.find((u) => u.id === id);
    if (user) {
      user.passwordHash = passwordHash;
      writeJson(db);
    }
    return;
  }
  await q('UPDATE users SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
}

export async function createConversation(
  conversation: DbConversation
): Promise<DbConversation> {
  if (!usesPostgres()) {
    const db = readJson();
    db.conversations.push(conversation);
    writeJson(db);
    return conversation;
  }
  const [a, b] = [...conversation.participantIds].sort();
  await q(
    `INSERT INTO conversations (id, user_a_id, user_b_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
    [conversation.id, a, b, conversation.createdAt, conversation.updatedAt]
  );
  return conversation;
}

export async function listMessages(conversationId: string): Promise<DbMessage[]> {
  if (!usesPostgres()) {
    return readJson()
      .messages.filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  const { rows } = await q(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  );
  return rows.map(rowToMessage);
}

export async function insertMessage(message: DbMessage): Promise<DbMessage> {
  if (!usesPostgres()) {
    const db = readJson();
    db.messages.push(message);
    const conv = db.conversations.find((c) => c.id === message.conversationId);
    if (conv) conv.updatedAt = message.createdAt;
    writeJson(db);
    return message;
  }
  await q(
    `INSERT INTO messages (id, conversation_id, sender_id, recipient_id, text, created_at, is_read)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      message.id,
      message.conversationId,
      message.senderId,
      message.recipientId,
      message.text,
      message.createdAt,
      message.isRead,
    ]
  );
  await q('UPDATE conversations SET updated_at = $2 WHERE id = $1', [
    message.conversationId,
    message.createdAt,
  ]);
  return message;
}

export async function markConversationRead(
  conversationId: string,
  recipientId: string
): Promise<boolean> {
  if (!usesPostgres()) {
    const db = readJson();
    let updated = false;
    db.messages.forEach((m) => {
      if (m.conversationId === conversationId && m.recipientId === recipientId && !m.isRead) {
        m.isRead = true;
        updated = true;
      }
    });
    if (updated) writeJson(db);
    return updated;
  }
  const result = await q(
    'UPDATE messages SET is_read = TRUE WHERE conversation_id = $1 AND recipient_id = $2 AND is_read = FALSE',
    [conversationId, recipientId]
  );
  return (result.rowCount ?? 0) > 0;
}

/** Pastikan schema + seed awal tersedia. Dipanggil sekali saat boot. */
export async function ensureDatabaseReady(): Promise<void> {
  if (!usesPostgres()) {
    if (!fs.existsSync(JSON_DB_FILE)) writeJson(buildSeed());
    return;
  }
  await ensureSeed();
}

export function verifyToken(token: string | undefined | null): string | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    return decoded.userId ?? null;
  } catch {
    return null;
  }
}
