import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import path from 'path';
import type {
  DatabaseSchema,
  DbConversation,
  DbMessage,
  DbUser,
  StorageAdapter,
} from './storage-adapter';

/* ------------------------------------------------------------------ *
 * Auth / Crypto (berlaku untuk semua backend)
 * ------------------------------------------------------------------ */

export { type DbUser, type DbMessage, type DbConversation, type DatabaseSchema } from './storage-adapter';

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
      const [, salt, expected] = parts;
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

export function verifyToken(token: string | undefined | null): string | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    return decoded.userId ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Backend detection & lazy init
 * ------------------------------------------------------------------ */

function detectBackend(): 'mysql' | 'postgres' | 'json' {
  const mysqlEnv = (process.env.MYSQL_URL || process.env.MYSQL_HOST || process.env.DATABASE_URL || '').trim();
  const pgEnv = (process.env.POSTGRES_URL || '').trim();

  // Jika kedua env di-set, prioritaskan MySQL (Hostinger).
  if (mysqlEnv) return 'mysql';
  if (pgEnv) return 'postgres';
  return 'json';
}

const globals = globalThis as unknown as { __akseleraAdapter?: Promise<StorageAdapter> };

async function getAdapter(): Promise<StorageAdapter> {
  if (!globals.__akseleraAdapter) {
    globals.__akseleraAdapter = (async () => {
      const backend = detectBackend();
      const hashFn = hashPassword;

      if (backend === 'mysql') {
        const { createMysqlAdapter } = await import('./mysql-adapter');

        // Parse DATABASE_URL (mysql://user:pass@host:port/db) atau env individual.
        const urlEnv = (process.env.MYSQL_URL || process.env.DATABASE_URL || '').trim();
        if (urlEnv.startsWith('mysql')) {
          try {
            const url = new URL(urlEnv);
            return createMysqlAdapter(
              {
                host: url.hostname || 'localhost',
                port: Number(url.port) || 3306,
                user: url.username || 'root',
                password: url.password || '',
                database: url.pathname.slice(1) || 'akselera_chat',
              },
              hashFn
            );
          } catch (err) {
            console.error('[db] Gagal parse DATABASE_URL sebagai MySQL, fallback JSON:', err);
          }
        }

        // Fallback ke env individual.
        return createMysqlAdapter(
          {
            host: process.env.MYSQL_HOST || 'localhost',
            port: Number(process.env.MYSQL_PORT) || 3306,
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || '',
            database: process.env.MYSQL_DATABASE || 'akselera_chat',
          },
          hashFn
        );
      }

      if (backend === 'postgres') {
        const { createPostgresAdapter } = await import('./postgres-adapter');
        return createPostgresAdapter(hashFn);
      }

      const { createJsonAdapter } = await import('./json-adapter');
      const dbFile = process.env.DATABASE_FILE
        ? path.resolve(process.cwd(), process.env.DATABASE_FILE)
        : path.resolve(process.cwd(), 'data', 'database.json');
      return createJsonAdapter(dbFile, hashFn);
    })();
  }
  return globals.__akseleraAdapter;
}

/* ------------------------------------------------------------------ *
 * Backend info (untuk log & diagnostic)
 * ------------------------------------------------------------------ */

export function usesMysql(): boolean { return detectBackend() === 'mysql'; }
export function usesPostgres(): boolean { return detectBackend() === 'postgres'; }
export function isRlsApplied(): boolean { return false; }
export async function ensureDatabaseReady(): Promise<void> { await (await getAdapter()).ready(); }
export async function getBackendName(): Promise<string> { return (await getAdapter()).name; }

/* ------------------------------------------------------------------ *
 * Public API — delegasi ke adapter aktif
 * ------------------------------------------------------------------ */

export async function loadDb(scopeUserId: string | null = null): Promise<DatabaseSchema> {
  return (await getAdapter()).loadDb(scopeUserId);
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  return (await getAdapter()).findUserByEmail(email);
}

export async function findUserById(id: string): Promise<DbUser | null> {
  return (await getAdapter()).findUserById(id);
}

export async function findConversationById(
  id: string,
  scopeUserId: string | null = null
): Promise<DbConversation | null> {
  return (await getAdapter()).findConversationById(id, scopeUserId);
}

export async function findConversationBetween(
  userA: string,
  userB: string
): Promise<DbConversation | null> {
  return (await getAdapter()).findConversationBetween(userA, userB);
}

export async function getConversationParticipants(id: string): Promise<[string, string] | null> {
  return (await getAdapter()).getConversationParticipants(id);
}

export async function createUser(user: DbUser): Promise<DbUser> {
  return (await getAdapter()).createUser(user);
}

export async function updateUserOnline(
  id: string,
  isOnline: boolean,
  lastSeen: string
): Promise<void> {
  return (await getAdapter()).updateUserOnline(id, isOnline, lastSeen);
}

export async function updateUserPasswordHash(
  id: string,
  passwordHash: string
): Promise<void> {
  return (await getAdapter()).updateUserPasswordHash(id, passwordHash);
}

export async function createConversation(
  conversation: DbConversation,
  scopeUserId: string | null = null
): Promise<DbConversation> {
  return (await getAdapter()).createConversation(conversation, scopeUserId);
}

export async function listMessages(
  conversationId: string,
  scopeUserId: string | null = null
): Promise<DbMessage[]> {
  return (await getAdapter()).listMessages(conversationId, scopeUserId);
}

export async function insertMessage(
  message: DbMessage,
  scopeUserId: string | null = null
): Promise<DbMessage> {
  return (await getAdapter()).insertMessage(message, scopeUserId);
}

export async function markConversationRead(
  conversationId: string,
  recipientId: string
): Promise<boolean> {
  return (await getAdapter()).markConversationRead(conversationId, recipientId);
}
