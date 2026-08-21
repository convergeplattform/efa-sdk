import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { seedDefaults } from '../../db/seed';

/**
 * `initDb()` wählt anhand des Treibers das passende Schema-File. Ein Vertauschen
 * fiele erst beim Deploy auf (Postgres-SQL gegen SQLite = Syntaxfehler beim
 * Start), deshalb wird hier geprüft, dass wirklich der jeweils richtige DIALEKT
 * an `applySchema()` geht — gegen die echten Schema-Dateien, nicht gegen einen
 * fs-Mock.
 */

let applySchemaMock: ReturnType<typeof vi.fn>;

async function loadInit(isSqlite: boolean) {
  vi.resetModules();
  vi.doMock('../../db', () => ({ applySchema: applySchemaMock, isSqlite }));
  return import('../../db/init');
}

beforeEach(() => {
  applySchemaMock = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.doUnmock('../../db');
  vi.restoreAllMocks();
});

describe('initDb – Schema-Auswahl pro Treiber', () => {
  it('spielt im Postgres-Stack schema.sql (PostgreSQL-Dialekt) ein', async () => {
    // Arrange
    const { initDb } = await loadInit(false);

    // Act
    await initDb();

    // Assert – UUID-Spalten mit gen_random_uuid() gibt es nur im Postgres-DDL.
    // Geprüft wird die Spaltendefinition, nicht der Kommentartext (den SQLite-DDL
    // erwähnt gen_random_uuid() in einem Kommentar).
    const sql = applySchemaMock.mock.calls[0][0] as string;
    expect(applySchemaMock).toHaveBeenCalledOnce();
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS app_users');
    expect(sql).toContain('UUID PRIMARY KEY DEFAULT gen_random_uuid()');
  });

  it('spielt im SQLite-Stack schema.sqlite.sql (SQLite-Dialekt) ein', async () => {
    // Arrange
    const { initDb } = await loadInit(true);

    // Act
    await initDb();

    // Assert – TEXT-IDs mit randomblob()-Default gibt es nur im SQLite-DDL.
    const sql = applySchemaMock.mock.calls[0][0] as string;
    expect(applySchemaMock).toHaveBeenCalledOnce();
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS app_users');
    expect(sql).toContain('randomblob');
    expect(sql).toContain('CURRENT_TIMESTAMP');
    expect(sql).not.toContain('UUID PRIMARY KEY DEFAULT gen_random_uuid()');
  });

  it('protokolliert den verwendeten Treiber strukturiert', async () => {
    // Arrange
    const logSpy = vi.spyOn(console, 'log');
    const { initDb } = await loadInit(true);

    // Act
    await initDb();

    // Assert
    expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toMatchObject({
      level: 'info',
      msg: 'Database schema initialized',
      driver: 'sqlite',
    });
  });
});

describe('seedDefaults – Platzhalter für App-Startdaten', () => {
  it('läuft ohne Fehler durch (Template legt bewusst nichts an)', async () => {
    // Act + Assert
    await expect(seedDefaults()).resolves.toBeUndefined();
  });
});
