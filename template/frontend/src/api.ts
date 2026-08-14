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

// ─── View Preferences (Pflicht-Helpers für DataTable) ────────────────────────
//
// Jede App, die die zentrale DataTable-Komponente nutzt, muss
//   - im Backend GET/PUT/DELETE /api/view-preferences/:listId anbieten
//     (siehe converge-template/CLAUDE.md "Listen-Verhalten").
//   - die folgenden Helpers entweder identisch zu diesem Block bereitstellen
//     oder direkt aus dem Template übernehmen.

export async function getViewPreferences<T = unknown>(listId: string): Promise<T | null> {
  const res = await fetch(`${getApiBase()}/api/view-preferences/${encodeURIComponent(listId)}`, {
    credentials: 'include',
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`view-preferences GET ${listId} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const putViewPreferences = (listId: string, prefs: unknown): Promise<void> =>
  apiFetch<void>(`/api/view-preferences/${encodeURIComponent(listId)}`, {
    method: 'PUT',
    body: JSON.stringify(prefs),
  });

export const resetViewPreferences = (listId: string): Promise<void> =>
  apiFetch<void>(`/api/view-preferences/${encodeURIComponent(listId)}`, { method: 'DELETE' });
