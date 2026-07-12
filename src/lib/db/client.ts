/**
 * Database client wrapper.
 *
 * This is the ONLY file in the codebase allowed to talk to the database
 * directly. Every service module in src/lib/db/services/* imports `getDb`
 * from here instead of touching D1 or Postgres itself. This keeps the
 * database swappable and testable, and stops raw queries leaking into
 * components/routes.
 *
 * Two backends are supported behind the same D1Database interface:
 *  - Cloudflare D1 (production, via @cloudflare/next-on-pages bindings)
 *  - Postgres/Supabase (Vercel preview/testing, via the `pg` package)
 *
 * Which one is used is controlled by DB_DRIVER ('d1' | 'postgres').
 * Defaults to 'postgres' when DB_DRIVER is unset and DATABASE_URL is
 * present (typical on Vercel), otherwise 'd1'.
 *
 * Service files never need to know which backend is active.
 */

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    changes?: number;
    last_row_id?: number;
  };
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

type DbDriver = 'd1' | 'postgres';

function resolveDriver(): DbDriver {
  const explicit = process.env.DB_DRIVER as DbDriver | undefined;
  if (explicit === 'd1' || explicit === 'postgres') return explicit;
  return process.env.DATABASE_URL ? 'postgres' : 'd1';
}

function getD1Db(): D1Database {
  // Lazy require (not a top-level import) so @cloudflare/next-on-pages is
  // never pulled into the Vercel/Postgres build path. Kept synchronous
  // deliberately: getDb() is called from ~150 sites across every service
  // file, and making it async would require awaiting all of them.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getRequestContext } = require('@cloudflare/next-on-pages') as typeof import('@cloudflare/next-on-pages');
  const env = getRequestContext().env as { DB?: D1Database };
  if (!env.DB) {
    throw new Error(
      "D1 binding 'DB' is not configured. Add a [[d1_databases]] binding named DB in wrangler.toml."
    );
  }
  return env.DB;
}

let pgDbSingleton: D1Database | undefined;

function getPostgresDb(): D1Database {
  if (!pgDbSingleton) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createPostgresD1Adapter } = require('@/lib/db/postgresAdapter') as typeof import('@/lib/db/postgresAdapter');
    pgDbSingleton = createPostgresD1Adapter();
  }
  return pgDbSingleton;
}

/**
 * Returns the active database, implementing the same D1Database interface
 * regardless of backend. Throws a descriptive error if not configured.
 */
export function getDb(): D1Database {
  return resolveDriver() === 'postgres' ? getPostgresDb() : getD1Db();
}

/**
 * Generates a URL/ID-safe random identifier for new rows.
 * Not a UUID library dependency to keep the service layer dependency-free.
 */
export function generateId(prefix: string): string {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  return `${prefix}_${random}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
