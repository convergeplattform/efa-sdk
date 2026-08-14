import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * dbSqlite.ts – SQLite-Adapter für den Single-Container-Stack.
 *
 * Stellt ein `pg.Pool`-kompatibles `query()` bereit, sodass die App-Routen und
 * `@efa-one/sdk/backend/auth` (das einen `pg.Pool` erwartet) unverändert
 * funktionieren. Der Adapter wird in `db.ts` per `as unknown as Pool` typisiert
 * und nur geladen, wenn `DB_DRIVER=sqlite` gesetzt ist.
 *
 * Was übersetzt wird, damit das Standard-Schema (PostgreSQL-SQL) läuft:
 *  - Positions-Platzhalter `$1, $2, …`  →  `?` (in Reihenfolge des Auftretens)
 *  - `NOW()`             → registrierte SQL-Funktion (ISO-Timestamp)
 *  - `gen_random_uuid()` → registrierte SQL-Funktion (UUID v4)
 *  - `ON CONFLICT … DO UPDATE … EXCLUDED.col … RETURNING …` läuft nativ
 *    (SQLite ≥ 3.35, in better-sqlite3 enthalten).
 *
 * Grenzen (bewusst): keine pg-Array-/JSONB-Parameter. Wer im SQLite-Stack
 * strukturierte Werte speichert, serialisiert sie selbst als TEXT (JSON.stringify).
 */

export interface QueryResult<R = unknown> {
  rows: R[];
  rowCount: number;
}

export interface SqlitePool {
  query<R = unknown>(text: string, params?: unknown[]): Promise<QueryResult<R>>;
  /** Multi-Statement-Ausführung (Schema-Init). */
  exec(sql: string): void;
  end(): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): void;
}

/** `$1, $2, …` → `?` und Parameter in Auftrittsreihenfolge umsortieren. */
function translatePlaceholders(text: string, params: unknown[]): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const sql = text.replace(/\$(\d+)/g, (_match, n: string) => {
    values.push(params[Number(n) - 1]);
    return '?';
  });
  return { sql, values };
}

/** pg akzeptiert Typen, die better-sqlite3 ablehnt — hier angleichen. */
function coerce(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function createSqlitePool(): SqlitePool {
  const file = process.env.SQLITE_PATH ?? '/app/data/app.db';
  fs.mkdirSync(path.dirname(file), { recursive: true });

  // Lazy require: better-sqlite3 ist eine optionalDependency und ein Native-Modul.
  // Der Postgres-Stack lädt diese Datei nie, also darf der require nicht beim
  // Modul-Load passieren.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database: typeof import('better-sqlite3') = require('better-sqlite3');
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // PostgreSQL-Funktionen, die im Standard-Schema-SQL vorkommen (case-insensitive).
  db.function('now', () => new Date().toISOString());
  db.function('gen_random_uuid', () => crypto.randomUUID());

  return {
    async query<R = unknown>(text: string, params: unknown[] = []): Promise<QueryResult<R>> {
      const { sql, values } = translatePlaceholders(text, params);
      const bound = values.map(coerce);
      const stmt = db.prepare(sql);
      if (stmt.reader) {
        const rows = stmt.all(...bound) as R[];
        return { rows, rowCount: rows.length };
      }
      const info = stmt.run(...bound);
      return { rows: [], rowCount: info.changes };
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    async end(): Promise<void> {
      db.close();
    },
    on(): void {
      // pg.Pool kennt 'error'-Events; SQLite-In-Process braucht das nicht.
    },
  };
}
