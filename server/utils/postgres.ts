import postgres from 'postgres';

let sqlInstance: postgres.Sql | null = null;
let initialized = false;
let tableInitialized = false;

export function getSql(): postgres.Sql | null {
  if (initialized) return sqlInstance;
  initialized = true;

  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    console.log('[Postgres] POSTGRES_URL not set, using local file store fallback.');
    return null;
  }

  try {
    sqlInstance = postgres(connectionString, {
      ssl: 'require',
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10
    });
    console.log('[Postgres] Successfully initialized Postgres database connection.');
  } catch (err) {
    console.warn('[Postgres] Initialization failed, using local file store fallback:', (err as Error).message);
    sqlInstance = null;
  }

  return sqlInstance;
}

export async function ensureTablesExist(): Promise<void> {
  const sql = getSql();
  if (!sql || tableInitialized) return;

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS simulations (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        data JSONB NOT NULL
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS daily_history (
        date TEXT PRIMARY KEY,
        rows JSONB NOT NULL
      );
    `;
    tableInitialized = true;
    console.log('[Postgres] Ensured tables simulations & daily_history exist.');
  } catch (err) {
    console.warn('[Postgres] Failed to initialize tables:', (err as Error).message);
  }
}

export function isPostgresAvailable(): boolean {
  return getSql() !== null;
}
