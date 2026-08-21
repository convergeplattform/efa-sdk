import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';


/**
 * Per-Datei-Gates auf den gezielt getesteten Modulen (jeweils knapp unter dem Ist-Stand).
 *
 * FALLE: Vitest ignoriert einen Schwellen-Key, der auf KEINE Datei matcht, vollkommen
 * still — ein Tippfehler oder eine Umbenennung schaltet das Gate unbemerkt ab. Deshalb
 * wird die Existenz jedes Pfads beim Laden der Config geprüft.
 */
const perFileThresholds = {
  'src/api.ts': { lines: 100, statements: 100, functions: 100, branches: 85 },
  'src/convergeApi.ts': { lines: 100, statements: 100, functions: 100, branches: 100 },
  'src/types.ts': { lines: 100, statements: 100, functions: 100, branches: 100 },
  'src/hooks/useConvergeAuth.ts': { lines: 90, statements: 86, functions: 73, branches: 78 },
};

for (const file of Object.keys(perFileThresholds)) {
  if (!existsSync(resolve(process.cwd(), file))) {
    throw new Error(
      `vitest.config.ts: Coverage-Schwelle zeigt auf eine nicht existierende Datei: ${file}. ` +
        'Pfad korrigieren oder Eintrag entfernen — sonst wäre das Gate für dieses Modul still abgeschaltet.',
    );
  }
}

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      // main.tsx ist reines Bootstrapping, vite-env.d.ts eine Typdeklaration,
      // icons.ts ein kuratiertes Re-Export-Barrel ohne eigene Logik.
      exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/lib/icons.ts'],
      /**
       * Zwei-Ebenen-Gate (TESTING.md → „Coverage-Ratchet"):
       *  1) Globaler FLOOR knapp unter dem Ist-Stand als Regressions-Schutz. Er ist
       *     niedrig, weil die Seiten-Komponenten (MainPage/SettingsPage/WidgetPage/App)
       *     bewusst noch ungetestet sind — die ersetzt jede App ohnehin als Erstes.
       *  2) Per-Datei-Gates auf den mitgelieferten Bausteinen, die JEDE App erbt.
       *
       * RATCHET: Wenn deine Tests die Abdeckung heben, zieh die Werte nach — nie senken.
       */
      thresholds: {
        // FLOOR — gemessener Ist-Stand: L 63.7 / S 60 / F 40 / B 48.19
        lines: 62,
        statements: 58,
        functions: 38,
        branches: 46,
        ...perFileThresholds,
      },
    },
  },
});
