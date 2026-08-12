import { readFileSync } from 'fs';
import { join } from 'path';

const locales: Record<string, Record<string, string>> = {};

/**
 * loadLocales – Lädt Locale-Dateien aus dem locales/ Verzeichnis.
 * Aufruf einmal beim Server-Start.
 *
 * @param localesDir Absoluter Pfad zum locales/ Verzeichnis
 * @param languages  Liste der zu ladenden Sprachen (Default: ['de', 'en'])
 */
export function loadLocales(localesDir: string, languages: string[] = ['de', 'en']): void {
  for (const lang of languages) {
    try {
      const data = readFileSync(join(localesDir, `${lang}.json`), 'utf-8');
      locales[lang] = JSON.parse(data);
    } catch {
      console.warn(`i18n: locale file for '${lang}' not found in ${localesDir}`);
    }
  }
}

/**
 * t – Übersetzungsfunktion.
 * Fallback-Kette: angefragte Sprache → Deutsch → Key selbst.
 */
export function t(key: string, lang: string = 'de'): string {
  return locales[lang]?.[key] ?? locales['de']?.[key] ?? key;
}
