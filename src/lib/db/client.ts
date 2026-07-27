/**
 * Database client wrapper.
 *
 * This is the ONLY file in the codebase allowed to talk to the database
 * directly. Every service module in src/lib/db/services/* imports `getDb`
 * from here instead of touching D1 itself. This keeps the database
 * swappable and testable, and stops raw queries leaking into
 * components/routes.
 *
 * D1 is accessed three ways behind the same D1Database interface:
 *  - OpenNext / Workers binding (Cloudflare Workers production, via
 *    @opennextjs/cloudflare / wrangler.toml [[d1_databases]])
 *  - Pages binding (legacy, via @cloudflare/next-on-pages), kept as a
 *    fallback for any environment still using that adapter
 *  - HTTP API (Vercel testing, via Cloudflare's REST API) — hits the
 *    SAME D1 database as production, just over HTTPS instead of a
 *    binding, since Vercel can't reach Workers bindings directly.
 *
 * Which one is used is controlled by DB_DRIVER ('d1' | 'http').
 * Defaults to 'http' when DB_DRIVER is unset and D1_API_TOKEN is
 * present (typical on Vercel), otherwise 'd1'. Within the 'd1' path,
 * the OpenNext binding is tried first, falling back to the Pages
 * binding if OpenNext's context helper isn't available.
 *
 * Service files never need to know which access method is active.
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

type DbDriver = 'd1' | 'http';

function resolveDriver(): DbDriver {
  const explicit = process.env.DB_DRIVER as DbDriver | undefined;
  if (explicit === 'd1' || explicit === 'http') return explicit;
  return process.env.D1_API_TOKEN ? 'http' : 'd1';
}

// Loaded via indirect eval, not a literal require(...), so Turbopack's
// bundler and the TypeScript checker never try to resolve these modules
// on Vercel, where neither @opennextjs/cloudflare nor
// @cloudflare/next-on-pages is installed (no package, no type
// declarations). Kept synchronous deliberately: getDb() is called from
// ~150 sites across every service file, and making it async would
// require awaiting all of them.

function getOpenNextBindingDb(): D1Database | undefined {
  try {
    // eslint-disable-next-line no-eval
    const dynamicRequire = eval('require') as NodeRequire;
    const { getCloudflareContext } = dynamicRequire('@opennextjs/cloudflare') as {
      getCloudflareContext: () => { env: Record<string, unknown> };
    };
    const env = getCloudflareContext().env as { DB?: D1Database };
    return env.DB;
  } catch {
    return undefined;
  }
}

function getPagesBindingDb(): D1Database | undefined {
  try {
    // eslint-disable-next-line no-eval
    const dynamicRequire = eval('require') as NodeRequire;
    const { getRequestContext } = dynamicRequire('@cloudflare/next-on-pages') as {
      getRequestContext: () => { env: Record<string, unknown> };
    };
    const env = getRequestContext().env as { DB?: D1Database };
    return env.DB;
  } catch {
    return undefined;
  }
}

function getD1BindingDb(): D1Database {
  const db = getOpenNextBindingDb() ?? getPagesBindingDb();
  if (!db) {
    throw new Error(
      "D1 binding 'DB' is not available. Neither @opennextjs/cloudflare nor " +
        '@cloudflare/next-on-pages could resolve it — confirm a [[d1_databases]] ' +
        "binding named DB exists in wrangler.toml, or set DB_DRIVER=http to use " +
        'the D1 HTTP API instead.'
    );
  }
  return db;
}

let d1HttpSingleton: D1Database | undefined;

function getD1HttpDb(): D1Database {
  if (!d1HttpSingleton) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createD1HttpAdapter } = require('@/lib/db/d1HttpAdapter') as typeof import('@/lib/db/d1HttpAdapter');
    d1HttpSingleton = createD1HttpAdapter();
  }
  return d1HttpSingleton;
}

/**
 * Returns the active database, implementing the same D1Database interface
 * regardless of access method. Throws a descriptive error if not configured.
 */
export function getDb(): D1Database {
  return resolveDriver() === 'http' ? getD1HttpDb() : getD1BindingDb();
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
