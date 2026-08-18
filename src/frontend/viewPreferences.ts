/**
 * @efa-one/sdk/frontend/viewPreferences — Persistenz-Seam für die `DataTable`.
 *
 * Die `DataTable` speichert Spalten-Sichtbarkeit/-Reihenfolge, Sortierung, Filter
 * und Gruppierung **pro Benutzer und stabiler `listId`**. Das SDK schreibt diese
 * Ansicht aber nicht selbst weg — das ist App-Sache (App-DB, App-Permissions).
 * Stattdessen wird ein `ViewPreferencesAdapter` injiziert.
 *
 * - `createViewPreferencesClient()` liefert den Standard-Adapter für den
 *   plattformweiten Backend-Vertrag `GET/PUT/DELETE /api/view-preferences/:listId`
 *   (204 = „keine gespeicherte Ansicht", `credentials: 'include'`).
 * - Ohne Adapter läuft `useViewPreferences` **rein In-Memory** (kein Backend-Zwang):
 *   die Ansicht lebt nur für die Lebensdauer der Komponente.
 *
 * Backend-Vertrag (jedes App-Backend, das persistieren will, muss ihn anbieten):
 *   GET    /api/view-preferences/:listId  → 200 JSON | 204 (= Default)
 *   PUT    /api/view-preferences/:listId  → Body beliebiges JSON
 *   DELETE /api/view-preferences/:listId  → Reset zurück auf Default
 *
 * Verwendung in der App:
 *   import { createViewPreferencesClient } from '@efa-one/sdk/frontend/viewPreferences';
 *   import { getApiBase } from './convergeApi';
 *   // einmal erzeugen (stabil halten — nicht pro Render neu):
 *   const viewPrefs = createViewPreferencesClient({ apiBase: getApiBase });
 *   <DataTable persistence={viewPrefs} … />
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ViewPreferencesAdapter {
  /** Gespeicherte Ansicht laden. `null` = keine (Default verwenden). */
  get<T = unknown>(listId: string): Promise<T | null>;
  /** Ansicht persistieren (fire-and-forget seitens der DataTable). */
  put(listId: string, prefs: unknown): void | Promise<void>;
  /** Persistierten Eintrag löschen (Zurücksetzen auf Default). */
  reset(listId: string): void | Promise<void>;
}

export interface ViewPreferencesClientOptions {
  /**
   * Gateway-Basis-Pfad der App (z. B. `/apps/converge_myapp`). Als Funktion
   * übergeben, wenn die Basis erst zur Laufzeit feststeht (z. B. nach dem
   * Auth-Exchange) — sie wird dann pro Request neu aufgelöst.
   */
  apiBase?: string | (() => string);
  /** Fetch-Implementierung (Default: globales `fetch`). Nützlich für Tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Standard-Adapter für den plattformweiten View-Preferences-Endpoint.
 */
export function createViewPreferencesClient(
  opts: ViewPreferencesClientOptions = {},
): ViewPreferencesAdapter {
  const resolveBase = typeof opts.apiBase === 'function'
    ? opts.apiBase
    : (): string => (opts.apiBase as string | undefined) ?? '';
  const f = opts.fetchImpl ?? fetch;
  const url = (listId: string): string =>
    `${resolveBase()}/api/view-preferences/${encodeURIComponent(listId)}`;

  return {
    async get<T = unknown>(listId: string): Promise<T | null> {
      const res = await f(url(listId), { credentials: 'include' });
      if (res.status === 204 || !res.ok) return null;
      return res.json() as Promise<T>;
    },
    async put(listId: string, prefs: unknown): Promise<void> {
      await f(url(listId), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
    },
    async reset(listId: string): Promise<void> {
      await f(url(listId), { method: 'DELETE', credentials: 'include' });
    },
  };
}

/**
 * Hält die View-Preferences pro `listId`. Mit `adapter` wird beim Mount geladen
 * (mit Schema-Version-Gate) und bei Änderung debounced (600 ms) persistiert;
 * ohne `adapter` bleibt alles In-Memory.
 *
 * Das Version-Gate: hat `defaultPrefs` ein `version`-Feld und weicht die
 * gespeicherte Ansicht davon ab (oder fehlt es), wird die gespeicherte Ansicht
 * einmalig verworfen (Reset) und der Code-Default erzwungen — so migriert ein
 * `DEFAULT_VIEW_VERSION`-Bump alte Blobs sauber.
 */
export function useViewPreferences<T extends object>(
  listId: string,
  defaultPrefs: T,
  adapter?: ViewPreferencesAdapter,
): [T, (next: T) => void, () => Promise<void>, boolean] {
  const [prefs, setPrefsState] = useState<T>(defaultPrefs);
  // Ohne Adapter gibt es nichts zu laden → sofort „geladen".
  const [loaded, setLoaded] = useState(!adapter);
  const saveTimer = useRef<number | null>(null);

  // Beim Mount Backend-Stand laden (oder Default behalten).
  useEffect(() => {
    if (!adapter) return;
    let cancelled = false;
    Promise.resolve(adapter.get<T>(listId))
      .then((remote) => {
        if (cancelled) return;
        const hasRemote = !!remote && typeof remote === 'object';
        const dv = (defaultPrefs as { version?: number }).version;
        const rv = hasRemote ? (remote as { version?: number }).version : undefined;
        if (hasRemote && rv === dv) {
          // Aktuelle Version → gespeicherte Ansicht normal mergen.
          setPrefsState({ ...defaultPrefs, ...(remote as object) } as T);
        } else {
          // Fehlende/alte Version → einmalig auf neuen Code-Default zwingen …
          setPrefsState(defaultPrefs);
          // … und die stale Zeile entfernen (fire-and-forget).
          if (hasRemote) Promise.resolve(adapter.reset(listId)).catch(() => { /* ignore */ });
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
    if (!adapter || !loaded) return; // In-Memory bzw. Initial-Sync nicht persistieren
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      Promise.resolve(adapter.put(listId, next)).catch((err) => {
        console.warn('view-preferences save failed', err);
      });
    }, 600);
  }, [listId, loaded, adapter]);

  const reset = useCallback(async (): Promise<void> => {
    setPrefsState(defaultPrefs);
    if (!adapter) return;
    try {
      await adapter.reset(listId);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId, defaultPrefs, adapter]);

  return [prefs, setPrefs, reset, loaded];
}
