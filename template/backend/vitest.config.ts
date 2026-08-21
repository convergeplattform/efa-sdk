import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Test- und Coverage-Gate des App-Scaffolds.
 *
 *   npm test             → schnelle Suite (Unit + API), alles I/O gemockt bzw.
 *                          gegen eine Temp-SQLite. Hook- und PR-Gate-tauglich.
 *   npm run test:coverage → dieselbe Suite + Coverage-Gate (so läuft die CI).
 *
 * Verbindlicher Standard: TESTING.md im Meta-Repo. MSW ist hier bewusst NICHT
 * eingerichtet — das Scaffold ruft noch keine andere App auf. Sobald die App
 * `serviceClient`/`resolveService` nutzt, `test/msw/{server,handlers}.ts` aus
 * dem Kernel übernehmen und hier als `setupFiles` eintragen.
 *
 * DB-Integrationstests gegen eine echte Postgres (Testcontainers) gehören in
 * `src/__tests__/integration/` und in eine eigene `vitest.integration.config.ts`
 * — `npm test` soll ohne Docker laufen.
 */

/**
 * Per-Datei-Gates auf den gezielt getesteten Modulen (jeweils knapp unter dem
 * gemessenen Ist-Stand).
 *
 * FALLE: Vitest ignoriert einen Schwellen-Key, der auf KEINE Datei matcht,
 * vollkommen still — ein Tippfehler oder eine spätere Umbenennung schaltet das
 * Gate unbemerkt ab, und es bleibt für immer grün. Deshalb wird die Existenz
 * jedes Pfads beim Laden der Config geprüft und bei einem toten Key hart
 * abgebrochen.
 *
 * BEWUSST OHNE Gate: `src/audit.ts`, `src/middleware/auth.ts`, `src/routes/auth.ts`
 * und `src/routes/health.ts`. Das sind reine Fassaden vor dem SDK (Re-Export bzw.
 * ein einziger Factory-Aufruf) — v8 misst dort 0 von 0 Statements, ein Gate wäre
 * also immer trivial grün. Ihre Verträge sichern stattdessen
 * `unit/sdkReexports.test.ts` (Export-Fläche) und `routes/health.test.ts` /
 * `routes/authExchange.test.ts` (Verhalten über supertest) ab. Sobald eine App
 * eigene Logik in eine dieser Dateien schreibt, gehört sie hier mit hinein.
 */
const perFileThresholds = {
  'src/dbSqlite.ts': { lines: 100, statements: 100, functions: 100, branches: 100 },
  'src/db.ts': { lines: 100, statements: 100, functions: 100, branches: 100 },
  'src/store.ts': { lines: 100, statements: 100, functions: 100, branches: 100 },
  'src/types.ts': { lines: 100, statements: 100, functions: 100, branches: 100 },
  'src/db/init.ts': { lines: 100, statements: 100, functions: 100, branches: 100 },
  'src/routes/openapi.ts': { lines: 100, statements: 100, functions: 100, branches: 100 },
  'src/routes/dev.ts': { lines: 100, statements: 100, functions: 100, branches: 100 },
};

// Die Config wird immer aus dem Backend-Root geladen (dort läuft `npm test`).
for (const file of Object.keys(perFileThresholds)) {
  if (!existsSync(resolve(process.cwd(), file))) {
    throw new Error(
      `vitest.config.ts: Coverage-Schwelle zeigt auf eine nicht existierende Datei: ${file}. ` +
        'Pfad korrigieren oder Eintrag entfernen — sonst wäre das Gate für dieses Modul still abgeschaltet.',
    );
  }
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'src/__tests__/integration/**'],
    setupFiles: [],
    // Dummy-DATABASE_URL: `src/db.ts` wirft beim IMPORT, wenn sie im
    // Postgres-Stack fehlt. Die schnelle Suite verbindet nie (der Pool wird pro
    // Test gemockt), aber ohne diesen Wert müsste jede künftige App-Route ihren
    // db-Import mocken. `db.test.ts` setzt die Variable pro Fall selbst.
    env: {
      DATABASE_URL: 'postgres://app:test@127.0.0.1:5432/app_test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      // `index.ts` startet beim blossen Import den Server (app.listen +
      // Registrierungen beim Kernel) und ist deshalb nicht sinnvoll messbar.
      // Alles andere unter src/ zählt mit — auch neue App-Module.
      exclude: ['src/index.ts', 'src/__tests__/**'],
      thresholds: {
        // FLOOR — Regressions-Schutz knapp unter dem gemessenen Ist-Stand des
        // Scaffolds (2026-08-21: L 100 / S 100 / F 100 / B 100, also 70/70
        // Zeilen, 75/75 Statements, 18/18 Funktionen, 43/43 Branches).
        //
        // Beim Ausbauen der App gilt der Ratchet aus TESTING.md: neue Tests
        // heben die Abdeckung → Floor nachziehen, NIE senken. Wer eigenen Code
        // ergänzt, testet ihn also mit — das ist der Zweck dieses Gates.
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 95,
        ...perFileThresholds,
      },
    },
  },
});
