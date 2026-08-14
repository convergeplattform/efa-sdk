/**
 * Persistiert Listen-View-Preferences (Spalten, Sortierung, Filter, Gruppierung)
 * pro User und stabiler list_id über das Backend (`{app}_view_preferences`-Tabelle).
 *
 * Schema-Vorgabe: converge-template/CLAUDE.md "Listen-Verhalten (Pflicht)".
 *
 * Backend-Vertrag (jeder App-Backend muss diese Routen anbieten):
 *   GET    /api/view-preferences/:listId  → 200 JSON | 204 (= Default)
 *   PUT    /api/view-preferences/:listId  → Body beliebiges JSON
 *   DELETE /api/view-preferences/:listId  → Reset zurück auf Default
 *
 * Frontend-Vertrag (in jeder App's api.ts):
 *   getViewPreferences<T>(listId), putViewPreferences(listId, prefs),
 *   resetViewPreferences(listId)
 *
 * Verwendung:
 *   const [prefs, setPrefs, reset] = useViewPreferences('myapp.list', defaultPrefs);
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getViewPreferences, putViewPreferences, resetViewPreferences } from '../api';

export function useViewPreferences<T extends object>(
  listId: string,
  defaultPrefs: T,
): [T, (next: T) => void, () => Promise<void>, boolean] {
  const [prefs, setPrefsState] = useState<T>(defaultPrefs);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<number | null>(null);

  // Beim Mount Backend-Stand laden (oder Default behalten).
  useEffect(() => {
    let cancelled = false;
    getViewPreferences<T>(listId)
      .then((remote) => {
        if (cancelled) return;
        if (remote && typeof remote === 'object') {
          setPrefsState({ ...defaultPrefs, ...remote });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  // Debounced Persist bei Änderung.
  const setPrefs = useCallback((next: T): void => {
    setPrefsState(next);
    if (!loaded) return; // Initial-Sync nicht persistieren
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      putViewPreferences(listId, next).catch((err) => {
        console.warn('view-preferences save failed', err);
      });
    }, 600);
  }, [listId, loaded]);

  const reset = useCallback(async (): Promise<void> => {
    setPrefsState(defaultPrefs);
    try {
      await resetViewPreferences(listId);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, defaultPrefs]);

  return [prefs, setPrefs, reset, loaded];
}
