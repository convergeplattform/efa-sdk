import { Pool } from 'pg';
import { createSqlitePool, SqlitePool } from './dbSqlite';

/**
 * db.ts – Datenbank-Zugriff, treiberunabhängig.
 *
 * `DB_DRIVER` wählt den Stack:
 *   - `postgres` (Default, Standard-Stack mit 3 Containern): echter `pg.Pool`
 *     über `DATABASE_URL`.
 *   - `sqlite` (Single-Container-Stack): In-Process-SQLite über `SQLITE_PATH`.
 *     Der Adapter ist `pg.Pool`-kompatibel, daher bleiben alle Routen und
 *     `@efa-one/sdk/backend/auth` (erwartet einen `pg.Pool`) unverändert.
 *
 * Die App-/Business-Logik importiert ausschließlich `pool` und sieht keinen
 * Unterschied. Schema-Init läuft über `applySchema()` (treiber-aware).
 */

export const DB_DRIVER = (process.env.DB_DRIVER ?? 'postgres').toLowerCase();
export const isSqlite = DB_DRIVER === 'sqlite';

let sqlitePool: SqlitePool | null = null;
let pgPool: Pool | null = null;

if (isSqlite) {
  sqlitePool = createSqlitePool();
} else {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required (DB_DRIVER=postgres)');
  }
  pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  pgPool.on('error', (err) => {
    console.error(
      JSON.stringify({ level: 'error', msg: 'Unexpected DB pool error', err: String(err) }),
    );
  });
}

// Einheitlicher Export. Der SQLite-Adapter ist strukturell `pg.Pool`-kompatibel
// für alles, was die App nutzt (query/end/on) — der Cast macht das explizit.
export const pool: Pool = (sqlitePool ?? pgPool) as unknown as Pool;

/** Schema anwenden — Postgres als einzelnes query(), SQLite als Multi-Statement-exec(). */
export async function applySchema(sql: string): Promise<void> {
  if (sqlitePool) {
    sqlitePool.exec(sql);
    return;
  }
  await pgPool!.query(sql);
}
