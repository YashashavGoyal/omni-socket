import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { config } from '../config/env';

const connectionString = config.DATABASE_URL;

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let queryClient: ReturnType<typeof postgres> | null = null;
let dbInstance: DrizzleDb | null = null;

const isValidPgUrl =
  typeof connectionString === 'string' &&
  (connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://'));

if (isValidPgUrl) {
  try {
    queryClient = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: connectionString.includes('sslmode=require') ? 'require' : undefined,
    });
    dbInstance = drizzle(queryClient, { schema });
  } catch (err) {
    console.error('[DB] Failed to initialize Postgres connection client:', err);
  }
}

export const db = dbInstance;
export const sqlClient = queryClient;

export async function isDbConnected(): Promise<boolean> {
  if (!queryClient) return false;
  try {
    await queryClient`SELECT 1`;
    return true;
  } catch (err) {
    return false;
  }
}
