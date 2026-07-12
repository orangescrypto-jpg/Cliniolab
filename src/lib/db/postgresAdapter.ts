/**
 * Postgres adapter implementing the D1Database interface.
 *
 * Used on Vercel (DB_DRIVER=postgres or DATABASE_URL set) so the exact
 * same service-layer code that runs against Cloudflare D1 in production
 * also runs against Supabase/Postgres for testing, with no changes to
 * any file outside src/lib/db/client.ts and this one.
 *
 * D1 uses positional `?` placeholders; Postgres uses `$1, $2, ...`.
 * This adapter rewrites the query string at bind time so service files
 * can keep writing `?` everywhere.
 */

import { Pool, type QueryResult } from 'pg';
import type { D1Database, D1PreparedStatement, D1Result } from '@/lib/db/client';

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. Required when DB_DRIVER=postgres (or on Vercel without DB_DRIVER=d1).'
    );
  }
  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  return pool;
}

function toPositional(query: string): string {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

class PostgresPreparedStatement implements D1PreparedStatement {
  private values: unknown[] = [];

  constructor(private readonly query: string) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this;
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const res = await this.exec();
    const row = res.rows[0];
    if (!row) return null;
    if (colName) return (row as Record<string, unknown>)[colName] as T;
    return row as T;
  }

  async run(): Promise<D1Result> {
    const res = await this.exec();
    return {
      results: res.rows,
      success: true,
      meta: {
        duration: 0,
        changes: res.rowCount ?? 0,
      },
    };
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const res = await this.exec();
    return {
      results: res.rows as T[],
      success: true,
      meta: {
        duration: 0,
        changes: res.rowCount ?? 0,
      },
    };
  }

  private exec(): Promise<QueryResult> {
    return getPool().query(toPositional(this.query), this.values);
  }
}

export function createPostgresD1Adapter(): D1Database {
  return {
    prepare(query: string): D1PreparedStatement {
      return new PostgresPreparedStatement(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        const results: D1Result<T>[] = [];
        for (const stmt of statements) {
          results.push((await stmt.all<T>()) as D1Result<T>);
        }
        await client.query('COMMIT');
        return results;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
