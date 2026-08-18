import { getApiBase } from './convergeApi';

/**
 * apiFetch – authenticated fetch to the app's own backend.
 *
 * Automatically prepends the Converge gateway base path (e.g. "/apps/converge_zbv")
 * so callers just pass "/api/..." paths. In local dev mode the prefix is empty.
 *
 * Auth is handled via the httpOnly app_session cookie (set by /api/auth/exchange).
 * No Authorization header needed – credentials: 'include' sends the cookie automatically.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const url = `${getApiBase()}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const body = await res.json() as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ─── View Preferences (Persistenz der DataTable-Ansicht) ─────────────────────
//
// Die DataTable aus `@efa-one/sdk/frontend/ui` persistiert Spalten/Sort/Filter
// über einen injizierten Adapter — KEINE eigenen Helper mehr hier. Verwendung:
//
//   import { DataTable } from '@efa-one/sdk/frontend/ui';
//   import { createViewPreferencesClient } from '@efa-one/sdk/frontend/viewPreferences';
//   import { getApiBase } from './convergeApi';
//   // einmal erzeugen (stabil halten, nicht pro Render):
//   const viewPrefs = createViewPreferencesClient({ apiBase: getApiBase });
//   <DataTable persistence={viewPrefs} listId="items.list" … />
//
// Backend-Voraussetzung dafür: GET/PUT/DELETE /api/view-preferences/:listId +
// eine `{app}_view_preferences`-Tabelle (siehe CLAUDE.md „Listen-Verhalten").
// Ohne `persistence`-Prop läuft die DataTable rein In-Memory.
