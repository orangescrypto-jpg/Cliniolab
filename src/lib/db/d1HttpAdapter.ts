/**
 * Cloudflare D1 HTTP API adapter, implementing the D1Database interface.
 *
 * Used on Vercel (DB_DRIVER=http, or inferred when D1_API_TOKEN is set
 * without DB_DRIVER=binding) so the same service-layer code that runs
 * against the D1 Workers binding in Cloudflare production also runs on
 * Vercel, querying the SAME database over Cloudflare's REST API. No
 * separate Postgres database, no data drift between environments.
 *
 * Docs: https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
 *
 * Note: this REST API sits on the Cloudflare account-wide API rate limit
 * (control plane), not D1's query-plane limits, so it's intended for
 * testing/preview traffic, not production-scale load — which is exactly
 * the Vercel-testing / Cloudflare-production split described.
 */

import type { D1Database, D1PreparedStatement, D1Result } from '@/lib/db/client';

function getConfig() {
  const accountId = process.env.D1_ACCOUNT_ID;
  const databaseId = process.env.D1_DATABASE_ID;
  const apiToken = process.env.D1_API_TOKEN;
  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      'D1_ACCOUNT_ID, D1_DATABASE_ID, and D1_API_TOKEN are required when DB_DRIVER=http.'
    );
  }
  return { accountId, databaseId, apiToken };
}

interface D1ApiQueryResult {
  results: Record<string, unknown>[];
  success: boolean;
  meta: {
    duration: number;
    changes?: number;
    last_row_id?: number;
  };
}

async function runQuery(sql: string, params: unknown[]): Promise<D1ApiQueryResult> {
  const { accountId, databaseId, apiToken } = getConfig();
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });

  const body = await res.json();
  if (!res.ok || !body.success) {
    const message = body.errors?.[0]?.message || `D1 HTTP API request failed (${res.status})`;
    throw new Error(message);
  }

  // The API returns `result` as an array (one entry per statement); a
  // single query via this endpoint always returns exactly one entry.
  return body.result[0] as D1ApiQueryResult;
}

class D1HttpPreparedStatement implements D1PreparedStatement {
  private values: unknown[] = [];

  constructor(private readonly query: string) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this;
  }

  async first<T = unknown>(colName?: string): Promise<T | null> {
    const res = await runQuery(this.query, this.values);
    const row = res.results[0];
    if (!row) return null;
    if (colName) return row[colName] as T;
    return row as T;
  }

  async run(): Promise<D1Result> {
    const res = await runQuery(this.query, this.values);
    return {
      results: res.results,
      success: res.success,
      meta: res.meta,
    };
  }

  async all<T = unknown>(): Promise<D1Result<T>> {
    const res = await runQuery(this.query, this.values);
    return {
      results: res.results as T[],
      success: res.success,
      meta: res.meta,
    };
  }
}

export function createD1HttpAdapter(): D1Database {
  return {
    prepare(query: string): D1PreparedStatement {
      return new D1HttpPreparedStatement(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      // The HTTP API doesn't expose a multi-statement transactional batch
      // endpoint equivalent to the binding's db.batch(), so statements run
      // sequentially. Fine for testing traffic; production still uses the
      // real binding's batch() via Cloudflare Pages.
      const results: D1Result<T>[] = [];
      for (const stmt of statements) {
        results.push((await stmt.all<T>()) as D1Result<T>);
      }
      return results;
    },
  };
}
