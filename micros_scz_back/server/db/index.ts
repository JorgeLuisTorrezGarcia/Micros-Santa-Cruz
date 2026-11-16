import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.ts';

let poolInstance: Pool | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

/**
 * Lazily initializes the PostgreSQL connection pool only when DATABASE_URL is configured.
 * Supports external managed Postgres providers (Supabase, Neon) with SSL enabled by default.
 */
export function getDb(): NodePgDatabase<typeof schema> | null {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (dbInstance) {
    return dbInstance;
  }

  const connectionString = process.env.DATABASE_URL!.trim();
  const sslDisabled = process.env.DATABASE_SSL === 'false';

  poolInstance = new Pool({
    connectionString,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  poolInstance.on('error', (err) => {
    console.error('[PostgreSQL Pool] Unexpected idle client error:', err.message);
  });

  dbInstance = drizzle(poolInstance, { schema });
  return dbInstance;
}

export async function checkDatabaseHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      connected: false,
    };
  }

  const db = getDb();
  if (!db || !poolInstance) {
    return {
      configured: false,
      connected: false,
    };
  }

  const start = Date.now();
  try {
    await poolInstance.query('SELECT 1');
    return {
      configured: true,
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch (err: unknown) {
    return {
      configured: true,
      connected: false,
      error: err instanceof Error ? err.message : 'Error de conexión PostgreSQL',
    };
  }
}
