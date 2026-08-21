import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * `src/db.ts` entscheidet beim MODUL-IMPORT, welcher Treiber läuft
 * (`DB_DRIVER=postgres|sqlite`) — deshalb wird hier pro Fall `vi.resetModules()`
 * plus dynamischer Import verwendet. Ein normaler Top-Level-Import würde die
 * Entscheidung einfrieren und alle weiteren Fälle unprüfbar machen.
 *
 * `pg` und `./dbSqlite` sind gemockt: getestet wird die Treiberwahl, nicht die
 * darunterliegenden Bibliotheken (die haben eigene Tests bzw. dbSqlite.test.ts).
 */

interface FakePgPool {
  connectionString: string | undefined;
  query: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}

const ENV_KEYS = ['DB_DRIVER', 'DATABASE_URL', 'SQLITE_PATH'] as const;
const ORIGINAL_ENV: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) ORIGINAL_ENV[key] = process.env[key];

let createdPgPools: FakePgPool[] = [];
let sqlitePoolStub: {
  query: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
};
let createSqlitePoolMock: ReturnType<typeof vi.fn>;

/** Setzt Env, mockt die Treiber und lädt `src/db.ts` frisch. */
async function loadDb(env: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const key of ENV_KEYS) {
    const value = env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  vi.resetModules();
  vi.doMock('pg', () => ({
    Pool: class {
      connectionString: string | undefined;
      query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
      on = vi.fn();
      end = vi.fn().mockResolvedValue(undefined);
      constructor(config: { connectionString?: string } = {}) {
        this.connectionString = config.connectionString;
        createdPgPools.push(this as unknown as FakePgPool);
      }
    },
  }));
  vi.doMock('../../dbSqlite', () => ({ createSqlitePool: createSqlitePoolMock }));

  return import('../../db');
}

beforeEach(() => {
  createdPgPools = [];
  sqlitePoolStub = { query: vi.fn(), exec: vi.fn(), end: vi.fn(), on: vi.fn() };
  createSqlitePoolMock = vi.fn(() => sqlitePoolStub);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = ORIGINAL_ENV[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
  vi.doUnmock('pg');
  vi.doUnmock('../../dbSqlite');
  vi.restoreAllMocks();
});

describe('db.ts – Treiberwahl über DB_DRIVER', () => {
  it('nutzt ohne DB_DRIVER den Postgres-Treiber (Standard-Stack)', async () => {
    // Act
    const db = await loadDb({ DATABASE_URL: 'postgres://u:p@localhost:5432/app' });

    // Assert
    expect(db.DB_DRIVER).toBe('postgres');
    expect(db.isSqlite).toBe(false);
    expect(createSqlitePoolMock).not.toHaveBeenCalled();
    expect(createdPgPools).toHaveLength(1);
    expect(createdPgPools[0].connectionString).toBe('postgres://u:p@localhost:5432/app');
  });

  it('nutzt bei DB_DRIVER=sqlite den SQLite-Adapter (Single-Container-Stack)', async () => {
    // Act
    const db = await loadDb({ DB_DRIVER: 'sqlite', DATABASE_URL: undefined });

    // Assert
    expect(db.isSqlite).toBe(true);
    expect(createSqlitePoolMock).toHaveBeenCalledTimes(1);
    expect(createdPgPools).toHaveLength(0);
  });

  it('wertet DB_DRIVER unabhängig von Groß-/Kleinschreibung aus', async () => {
    // Act
    const db = await loadDb({ DB_DRIVER: 'SQLite', DATABASE_URL: undefined });

    // Assert
    expect(db.DB_DRIVER).toBe('sqlite');
    expect(db.isSqlite).toBe(true);
  });

  it('exportiert im SQLite-Fall den Adapter als `pool`', async () => {
    // Act
    const db = await loadDb({ DB_DRIVER: 'sqlite', DATABASE_URL: undefined });

    // Assert
    expect(db.pool).toBe(sqlitePoolStub);
  });

  it('braucht im SQLite-Fall KEINE DATABASE_URL', async () => {
    // Act + Assert – der Import darf nicht werfen.
    await expect(loadDb({ DB_DRIVER: 'sqlite', DATABASE_URL: undefined })).resolves.toBeDefined();
  });
});

describe('db.ts – harter Fehler ohne DATABASE_URL im Postgres-Stack', () => {
  it('wirft beim Import, wenn DATABASE_URL fehlt', async () => {
    // Act + Assert
    await expect(loadDb({ DB_DRIVER: 'postgres', DATABASE_URL: undefined })).rejects.toThrow(
      /DATABASE_URL environment variable is required/,
    );
  });

  it('wirft auch bei leerer DATABASE_URL (leerer String zählt nicht als gesetzt)', async () => {
    // Act + Assert
    await expect(loadDb({ DB_DRIVER: 'postgres', DATABASE_URL: '' })).rejects.toThrow(
      /DATABASE_URL environment variable is required/,
    );
  });
});

describe('db.ts – Pool-Fehlerbehandlung im Postgres-Stack', () => {
  it('registriert einen error-Listener, der den Fehler strukturiert protokolliert', async () => {
    // Arrange
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await loadDb({ DATABASE_URL: 'postgres://u:p@localhost:5432/app' });
    const listener = createdPgPools[0].on.mock.calls[0];

    // Act – den registrierten Listener wie der pg-Pool aufrufen.
    expect(listener[0]).toBe('error');
    (listener[1] as (err: Error) => void)(new Error('Verbindung verloren'));

    // Assert
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(errorSpy.mock.calls[0][0] as string)).toMatchObject({
      level: 'error',
      msg: 'Unexpected DB pool error',
    });
  });
});

describe('db.ts – applySchema() verteilt auf den passenden Treiber', () => {
  it('führt das Schema im Postgres-Stack als einzelnes query() aus', async () => {
    // Arrange
    const db = await loadDb({ DATABASE_URL: 'postgres://u:p@localhost:5432/app' });

    // Act
    await db.applySchema('CREATE TABLE a (id INT); CREATE TABLE b (id INT);');

    // Assert
    expect(createdPgPools[0].query).toHaveBeenCalledExactlyOnceWith(
      'CREATE TABLE a (id INT); CREATE TABLE b (id INT);',
    );
  });

  it('führt das Schema im SQLite-Stack als Multi-Statement-exec() aus', async () => {
    // Arrange
    const db = await loadDb({ DB_DRIVER: 'sqlite', DATABASE_URL: undefined });

    // Act
    await db.applySchema('CREATE TABLE a (id INT); CREATE TABLE b (id INT);');

    // Assert
    expect(sqlitePoolStub.exec).toHaveBeenCalledExactlyOnceWith(
      'CREATE TABLE a (id INT); CREATE TABLE b (id INT);',
    );
    expect(sqlitePoolStub.query).not.toHaveBeenCalled();
  });
});
