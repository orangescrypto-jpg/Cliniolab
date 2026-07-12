/**
 * D1 client wrapper.
 *
 * This is the ONLY file in the codebase allowed to talk to Cloudflare D1
 * directly. Every service module in src/lib/db/services/* imports `getDb`
 * from here instead of touching the D1 binding itself. This keeps the
 * database swappable and testable, and stops raw queries leaking into
 * components/routes (the exact problem that happened with Firebase calls
 * being scattered across ~128 files previously).
 *
 * On Cloudflare (via @cloudflare/next-on-pages or the Workers runtime),
 * the D1 binding is available on the request context. Locally, wrangler
 * provides a D1 binding through `getRequestContext().env.DB` when using
 * `next dev` with the Cloudflare adapter, or via `wrangler pages dev`.
 */

import { getRequestContext } from '@cloudflare/next-on-pages';

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

/**
 * Returns the D1 binding for the current request.
 * Throws a descriptive error if the binding isn't configured, rather than
 * failing with an opaque "cannot read property of undefined" deep in a
 * service call.
 */
export function getDb(): D1Database {
  const env = getRequestContext().env as { DB?: D1Database };
  if (!env.DB) {
    throw new Error(
      "D1 binding 'DB' is not configured. Add a [[d1_databases]] binding named DB in wrangler.toml."
    );
  }
  return env.DB;
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
