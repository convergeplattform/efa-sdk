import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { mkdtempSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

/**
 * `src/store.ts` liest `DATA_DIR` beim MODUL-IMPORT — daher pro Fall
 * `vi.resetModules()` + dynamischer Import (gleiches Muster wie db.test.ts).
 *
 * Es wird gegen ein echtes Temp-Verzeichnis getestet: `ensureUploadsDir()` ist
 * genau die Stelle, an der ein Mock den eigentlichen Effekt (Verzeichnis liegt
 * danach da) verdecken würde.
 */

const ORIGINAL_DATA_DIR = process.env.DATA_DIR;
let tempRoot: string | null = null;

async function loadStore(dataDir: string | undefined) {
  if (dataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = dataDir;
  vi.resetModules();
  return import('../../store');
}

beforeEach(() => {
  tempRoot = mkdtempSync(path.join(tmpdir(), 'efa-tpl-store-'));
});

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = null;
  if (ORIGINAL_DATA_DIR === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = ORIGINAL_DATA_DIR;
  vi.restoreAllMocks();
});

describe('store.ts – UPLOADS_DIR', () => {
  it('hängt "uploads" an das konfigurierte DATA_DIR', async () => {
    // Act
    const store = await loadStore(tempRoot!);

    // Assert
    expect(store.UPLOADS_DIR).toBe(path.join(tempRoot!, 'uploads'));
  });

  it('fällt ohne DATA_DIR auf den Container-Pfad /app/data zurück', async () => {
    // Act
    const store = await loadStore(undefined);

    // Assert
    expect(store.UPLOADS_DIR).toBe(path.join('/app/data', 'uploads'));
  });
});

describe('store.ts – ensureUploadsDir()', () => {
  it('legt das Upload-Verzeichnis samt fehlender Elternverzeichnisse an', async () => {
    // Arrange – DATA_DIR zeigt auf einen noch nicht existierenden Unterpfad.
    const dataDir = path.join(tempRoot!, 'noch', 'nicht', 'da');
    const store = await loadStore(dataDir);
    expect(existsSync(store.UPLOADS_DIR)).toBe(false);
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync');

    // Act
    store.ensureUploadsDir();

    // Assert
    expect(existsSync(store.UPLOADS_DIR)).toBe(true);
    // Beweist zugleich, dass der Spy die Aufrufe von store.ts wirklich sieht —
    // ohne das wäre die Negativ-Erwartung im Idempotenz-Test wertlos.
    expect(mkdirSpy).toHaveBeenCalledWith(store.UPLOADS_DIR, { recursive: true });
  });

  it('ist idempotent und legt ein vorhandenes Verzeichnis nicht erneut an', async () => {
    // Arrange
    const store = await loadStore(tempRoot!);
    mkdirSync(store.UPLOADS_DIR, { recursive: true });
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync');

    // Act
    store.ensureUploadsDir();

    // Assert
    expect(mkdirSpy).not.toHaveBeenCalled();
    expect(existsSync(store.UPLOADS_DIR)).toBe(true);
  });
});
