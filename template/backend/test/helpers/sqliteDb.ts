import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqlitePool, type SqlitePool } from '../../src/dbSqlite';

/**
 * SQLite-Test-DB (Single-Container-Stack).
 *
 * Gegenstück zum `pgContainer`-Helper des Standard-Stacks (TESTING.md →
 * „Stack-Varianten"): gleiche API `startTestDb()` / `truncateAll()` / `stop()`,
 * nur ohne Testcontainers — eine echte SQLite-Datei in einem Temp-Verzeichnis.
 *
 * Bewusst wird die PRODUKTIVE Factory `createSqlitePool()` benutzt (nicht ein
 * eigener `new Database(...)`): so laufen die Tests durch denselben
 * `pg.Pool`-kompatiblen Adapter wie die App — inklusive Platzhalter-Übersetzung
 * `$1 → ?`, `NOW()`/`gen_random_uuid()` und der `rows`/`rowCount`-Form.
 *
 * Weil die Datei auf der Platte liegt (statt `:memory:`), verhält sie sich wie in
 * Produktion (WAL-Journal, `PRAGMA foreign_keys`), und `SQLITE_PATH` deckt
 * zusätzlich das Anlegen des Datenverzeichnisses mit ab.
 *
 * Muster:
 *   let db: TestDb;
 *   beforeAll(async () => { db = await startTestDb(); });
 *   beforeEach(async () => { await db.truncateAll(); });
 *   afterAll(async () => { await db.stop(); });
 */

const DEFAULT_SCHEMA_PATH = join(__dirname, '..', '..', 'src', 'db', 'schema.sqlite.sql');

export interface TestDb {
  /** `pg.Pool`-kompatibler Adapter — direkt in `vi.mock('../../db')` einsetzbar. */
  pool: SqlitePool;
  /** Pfad der SQLite-Datei (Temp-Verzeichnis). */
  file: string;
  /** Leert alle Tabellen des Schemas (schnelles Reset zwischen Tests). */
  truncateAll(): Promise<void>;
  /** Schließt die DB und entfernt das Temp-Verzeichnis. In `afterAll` aufrufen. */
  stop(): Promise<void>;
}

/** Startet die Test-DB und spielt das SQLite-Schema ein. In `beforeAll` aufrufen. */
export async function startTestDb(schemaPath: string = DEFAULT_SCHEMA_PATH): Promise<TestDb> {
  const dir = mkdtempSync(join(tmpdir(), 'efa-tpl-sqlite-'));
  const file = join(dir, 'data', 'app.db');

  // createSqlitePool() liest SQLITE_PATH beim Aufruf und legt das Verzeichnis an.
  const previousPath = process.env.SQLITE_PATH;
  process.env.SQLITE_PATH = file;
  let pool: SqlitePool;
  try {
    pool = createSqlitePool();
  } finally {
    if (previousPath === undefined) delete process.env.SQLITE_PATH;
    else process.env.SQLITE_PATH = previousPath;
  }

  pool.exec(readFileSync(schemaPath, 'utf8'));

  async function truncateAll(): Promise<void> {
    // Tabellenliste aus dem Katalog statt fest verdrahtet: so bleibt der Helper
    // gültig, wenn die App eigene Tabellen ins Schema aufnimmt.
    const { rows } = await pool.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
    );
    // Foreign Keys kurz aus, damit die Löschreihenfolge egal ist.
    pool.exec('PRAGMA foreign_keys = OFF');
    for (const row of rows) {
      pool.exec(`DELETE FROM "${row.name}"`);
    }
    pool.exec('PRAGMA foreign_keys = ON');
  }

  async function stop(): Promise<void> {
    await pool.end();
    rmSync(dir, { recursive: true, force: true });
  }

  return { pool, file, truncateAll, stop };
}
