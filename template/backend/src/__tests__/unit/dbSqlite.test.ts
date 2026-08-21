import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import fs from 'fs';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqlitePool, type SqlitePool } from '../../dbSqlite';
import { startTestDb, type TestDb } from '../../../test/helpers/sqliteDb';
import { makeAppUser, nextUuid } from '../../../test/factories';

/**
 * `src/dbSqlite.ts` ist das Modul mit der meisten echten Logik im Scaffold: es
 * stellt einen `pg.Pool`-kompatiblen Adapter auf better-sqlite3 bereit, damit
 * dieselben Routen und dasselbe SDK gegen beide Stack-Varianten laufen.
 *
 * Getestet wird gegen eine ECHTE SQLite-Datei (kein Fake) — ein Mock würde nur
 * den Mock prüfen; hier geht es gerade um die Übersetzung zwischen pg-Dialekt
 * und SQLite-Semantik.
 */

let db: TestDb;

beforeAll(async () => {
  db = await startTestDb();
  // Kleine Hilfstabelle für die Wert-Konvertierung (bleibt außerhalb des
  // App-Schemas, damit die Beispieltabellen unverfälscht bleiben).
  db.pool.exec(`CREATE TABLE IF NOT EXISTS t_coerce (k TEXT PRIMARY KEY, v)`);
});

beforeEach(async () => {
  await db.truncateAll();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.stop();
});

describe('createSqlitePool – Platzhalter-Übersetzung $n → ?', () => {
  it('bindet Parameter in der Reihenfolge ihres Auftretens im SQL, nicht nach Nummer', async () => {
    // Arrange – $2 steht VOR $1: der Adapter muss die Werte umsortieren.
    await db.pool.query(`INSERT INTO app_users (converge_id, name) VALUES ($1, $2)`, ['c-1', 'Anna']);

    // Act
    const { rows } = await db.pool.query<{ name: string }>(
      `SELECT name FROM app_users WHERE name = $2 AND converge_id = $1`,
      ['c-1', 'Anna'],
    );

    // Assert
    expect(rows).toEqual([{ name: 'Anna' }]);
  });

  it('bindet einen mehrfach verwendeten Platzhalter mehrfach', async () => {
    // Arrange
    await db.pool.query(`INSERT INTO app_users (converge_id, name) VALUES ($1, $1)`, ['zwilling']);

    // Act
    const { rows } = await db.pool.query<{ converge_id: string; name: string }>(
      `SELECT converge_id, name FROM app_users`,
    );

    // Assert
    expect(rows).toEqual([{ converge_id: 'zwilling', name: 'zwilling' }]);
  });

  it('kommt ohne params-Argument aus (Default: leere Liste)', async () => {
    // Act
    const { rows } = await db.pool.query<{ eins: number }>(`SELECT 1 AS eins`);

    // Assert
    expect(rows).toEqual([{ eins: 1 }]);
  });

  it('lässt zweistellige Platzhalter ($10) korrekt auf den zehnten Wert zeigen', async () => {
    // Arrange – zehn Werte, nur der zehnte wird selektiert.
    const params = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'zehnter'];

    // Act
    const { rows } = await db.pool.query<{ wert: string }>(`SELECT $10 AS wert`, params);

    // Assert
    expect(rows).toEqual([{ wert: 'zehnter' }]);
  });
});

describe('createSqlitePool – pg-kompatible Ergebnisform', () => {
  it('liefert bei SELECT die Zeilen und rowCount = Anzahl der Zeilen', async () => {
    // Arrange
    await db.pool.query(`INSERT INTO app_users (converge_id, name) VALUES ($1, $2), ($3, $4)`, [
      'c-1',
      'Anna',
      'c-2',
      'Bert',
    ]);

    // Act
    const result = await db.pool.query<{ name: string }>(`SELECT name FROM app_users ORDER BY name`);

    // Assert
    expect(result.rows.map((r) => r.name)).toEqual(['Anna', 'Bert']);
    expect(result.rowCount).toBe(2);
  });

  it('liefert bei SELECT ohne Treffer leere Zeilen und rowCount 0', async () => {
    // Act
    const result = await db.pool.query(`SELECT name FROM app_users WHERE converge_id = $1`, ['fehlt']);

    // Assert
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
  });

  it('liefert bei INSERT ohne RETURNING keine Zeilen, aber rowCount = geschriebene Zeilen', async () => {
    // Act
    const result = await db.pool.query(`INSERT INTO app_users (converge_id, name) VALUES ($1, $2)`, [
      'c-1',
      'Anna',
    ]);

    // Assert
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(1);
  });

  it('liefert bei UPDATE über mehrere Zeilen rowCount = geänderte Zeilen', async () => {
    // Arrange
    await db.pool.query(`INSERT INTO app_users (converge_id, name) VALUES ($1, $2), ($3, $4)`, [
      'c-1',
      'Anna',
      'c-2',
      'Bert',
    ]);

    // Act
    const result = await db.pool.query(`UPDATE app_users SET email = $1`, ['neu@example.com']);

    // Assert
    expect(result.rowCount).toBe(2);
  });

  it('liefert bei INSERT … RETURNING die erzeugte Zeile (Reader-Pfad)', async () => {
    // Act
    const result = await db.pool.query<{ id: string }>(
      `INSERT INTO app_users (converge_id, name) VALUES ($1, $2) RETURNING id`,
      ['c-1', 'Anna'],
    );

    // Assert
    expect(result.rowCount).toBe(1);
    expect(result.rows[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('unterstützt ON CONFLICT … DO UPDATE … EXCLUDED … RETURNING (Upsert des SDK-Exchange)', async () => {
    // Arrange – erster Durchlauf legt an.
    const first = await db.pool.query<{ id: string }>(
      `INSERT INTO app_users (converge_id, email, name, last_seen_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (converge_id) DO UPDATE
         SET last_seen_at = NOW(), email = EXCLUDED.email, name = EXCLUDED.name
       RETURNING id`,
      ['c-1', 'alt@example.com', 'Alt'],
    );

    // Act – zweiter Durchlauf aktualisiert dieselbe Zeile.
    const second = await db.pool.query<{ id: string }>(
      `INSERT INTO app_users (converge_id, email, name, last_seen_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (converge_id) DO UPDATE
         SET last_seen_at = NOW(), email = EXCLUDED.email, name = EXCLUDED.name
       RETURNING id`,
      ['c-1', 'neu@example.com', 'Neu'],
    );

    // Assert – gleiche id, aktualisierte Felder, keine zweite Zeile.
    expect(second.rows[0].id).toBe(first.rows[0].id);
    const { rows } = await db.pool.query<{ email: string; name: string }>(
      `SELECT email, name FROM app_users`,
    );
    expect(rows).toEqual([{ email: 'neu@example.com', name: 'Neu' }]);
  });
});

describe('createSqlitePool – Wert-Konvertierung (pg akzeptiert mehr Typen als SQLite)', () => {
  it('schreibt true als 1 und false als 0', async () => {
    // Act
    await db.pool.query(`INSERT INTO t_coerce (k, v) VALUES ($1, $2), ($3, $4)`, [
      'ja',
      true,
      'nein',
      false,
    ]);

    // Assert
    const { rows } = await db.pool.query<{ k: string; v: number }>(`SELECT k, v FROM t_coerce ORDER BY k`);
    expect(rows).toEqual([
      { k: 'ja', v: 1 },
      { k: 'nein', v: 0 },
    ]);
  });

  it('schreibt ein Date als ISO-8601-String', async () => {
    // Arrange
    const date = new Date('2026-01-15T08:30:00.000Z');

    // Act
    await db.pool.query(`INSERT INTO t_coerce (k, v) VALUES ($1, $2)`, ['datum', date]);

    // Assert
    const { rows } = await db.pool.query<{ v: string }>(`SELECT v FROM t_coerce WHERE k = $1`, ['datum']);
    expect(rows[0].v).toBe('2026-01-15T08:30:00.000Z');
  });

  it('schreibt undefined als NULL (better-sqlite3 würde undefined ablehnen)', async () => {
    // Act
    await db.pool.query(`INSERT INTO t_coerce (k, v) VALUES ($1, $2)`, ['leer', undefined]);

    // Assert
    const { rows } = await db.pool.query<{ v: unknown }>(`SELECT v FROM t_coerce WHERE k = $1`, ['leer']);
    expect(rows[0].v).toBeNull();
  });

  it('schreibt null als NULL', async () => {
    // Act
    await db.pool.query(`INSERT INTO t_coerce (k, v) VALUES ($1, $2)`, ['null', null]);

    // Assert
    const { rows } = await db.pool.query<{ v: unknown }>(`SELECT v FROM t_coerce WHERE k = $1`, ['null']);
    expect(rows[0].v).toBeNull();
  });

  it('reicht Zahlen unverändert durch', async () => {
    // Act
    await db.pool.query(`INSERT INTO t_coerce (k, v) VALUES ($1, $2)`, ['zahl', 42]);

    // Assert
    const { rows } = await db.pool.query<{ v: number }>(`SELECT v FROM t_coerce WHERE k = $1`, ['zahl']);
    expect(rows[0].v).toBe(42);
  });
});

describe('createSqlitePool – nachgebildete PostgreSQL-Funktionen', () => {
  it('NOW() liefert einen ISO-8601-Zeitstempel', async () => {
    // Act
    const { rows } = await db.pool.query<{ jetzt: string }>(`SELECT NOW() AS jetzt`);

    // Assert – Form prüfen, nicht den Wert (keine echte Uhr im Assert).
    expect(rows[0].jetzt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('gen_random_uuid() liefert eine UUID der Version 4', async () => {
    // Act
    const { rows } = await db.pool.query<{ id: string }>(`SELECT gen_random_uuid() AS id`);

    // Assert
    expect(rows[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('createSqlitePool – exec(), end() und pg-Pool-Kompatibilität', () => {
  it('führt mit exec() mehrere Statements in einem Aufruf aus (Schema-Init)', async () => {
    // Act
    db.pool.exec(`
      CREATE TABLE IF NOT EXISTS t_exec_a (id INTEGER PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS t_exec_b (id INTEGER PRIMARY KEY);
    `);

    // Assert
    const { rows } = await db.pool.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 't_exec_%' ORDER BY name`,
    );
    expect(rows.map((r) => r.name)).toEqual(['t_exec_a', 't_exec_b']);

    // Aufräumen, damit truncateAll() der anderen Tests nichts Fremdes findet.
    db.pool.exec('DROP TABLE t_exec_a; DROP TABLE t_exec_b;');
  });

  it('schließt die Datenbank mit end(), danach schlägt jede Query fehl', async () => {
    // Arrange – eigene Instanz, damit die geteilte Test-DB offen bleibt.
    const eigene = await startTestDb();

    // Act
    await eigene.pool.end();

    // Assert
    await expect(eigene.pool.query('SELECT 1')).rejects.toThrow();
    rmSync(eigene.file, { force: true });
  });

  it('akzeptiert on() als No-Op, damit pg-Aufrufer wie index.ts unverändert laufen', () => {
    // Act + Assert – pg.Pool kennt 'error'-Events, SQLite in-process nicht.
    expect(() => db.pool.on('error', () => undefined)).not.toThrow();
  });
});

describe('createSqlitePool – Initialisierung über SQLITE_PATH', () => {
  it('legt das Datenverzeichnis der SQLITE_PATH-Datei rekursiv an', async () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'efa-tpl-mkdir-'));
    const file = join(root, 'tief', 'verschachtelt', 'app.db');
    const vorher = process.env.SQLITE_PATH;
    process.env.SQLITE_PATH = file;

    // Act
    const pool = createSqlitePool();

    // Assert
    expect(existsSync(file)).toBe(true);

    await pool.end();
    if (vorher === undefined) delete process.env.SQLITE_PATH;
    else process.env.SQLITE_PATH = vorher;
    rmSync(root, { recursive: true, force: true });
  });

  it('leitet ohne SQLITE_PATH den Container-Standardpfad /app/data/app.db ab', async () => {
    // Arrange – mkdirSync stillgelegt, damit der Test auf keinem Rechner ein
    // echtes /app/data anlegt.
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    const vorher = process.env.SQLITE_PATH;
    delete process.env.SQLITE_PATH;

    // Act – das anschließende Öffnen scheitert erwartungsgemäß (das Verzeichnis
    // gibt es nur im Container); geprüft wird allein die Pfad-Ableitung.
    let pool: SqlitePool | null = null;
    try {
      pool = createSqlitePool();
    } catch {
      /* Öffnen ist hier nicht Gegenstand des Tests. */
    } finally {
      await pool?.end();
      if (vorher === undefined) delete process.env.SQLITE_PATH;
      else process.env.SQLITE_PATH = vorher;
    }

    // Assert
    expect(mkdirSpy).toHaveBeenCalledWith('/app/data', { recursive: true });
  });

  it('aktiviert PRAGMA foreign_keys, sodass ein ungültiger owner_id-Verweis scheitert', async () => {
    // Arrange
    const fremd = nextUuid();

    // Act + Assert
    await expect(
      db.pool.query(`INSERT INTO example_items (owner_id, title) VALUES ($1, $2)`, [fremd, 'Titel']),
    ).rejects.toThrow(/FOREIGN KEY/i);
  });

  it('aktiviert das WAL-Journal wie in Produktion', async () => {
    // Act
    const { rows } = await db.pool.query<{ journal_mode: string }>(`PRAGMA journal_mode`);

    // Assert
    expect(rows[0].journal_mode).toBe('wal');
  });

  it('schreibt einen gültigen owner_id-Verweis auf einen existierenden app_user', async () => {
    // Arrange
    const user = makeAppUser({ converge_id: 'c-owner', name: 'Owner' });
    const inserted = await db.pool.query<{ id: string }>(
      `INSERT INTO app_users (converge_id, name) VALUES ($1, $2) RETURNING id`,
      [user.converge_id, user.name],
    );

    // Act
    const result = await db.pool.query(`INSERT INTO example_items (owner_id, title) VALUES ($1, $2)`, [
      inserted.rows[0].id,
      'Mein Eintrag',
    ]);

    // Assert
    expect(result.rowCount).toBe(1);
  });
});
