import { describe, it, expect, vi } from 'vitest';
import { createViewPreferencesClient } from '../src/frontend/viewPreferences';

/**
 * Der Standard-View-Preferences-Client (Persistenz-Adapter der DataTable).
 * Reine Logik — Fetch wird injiziert, kein DOM/Backend nötig.
 */

function fakeResponse(init: { status?: number; ok?: boolean; json?: unknown }): Response {
  return {
    status: init.status ?? 200,
    ok: init.ok ?? true,
    json: async () => init.json,
  } as unknown as Response;
}

describe('createViewPreferencesClient', () => {
  it('get: baut den Standard-Endpoint mit encodetem listId + credentials', async () => {
    const fetchImpl = vi.fn(async () => fakeResponse({ status: 200, json: { columnOrder: ['a'] } }));
    const client = createViewPreferencesClient({ apiBase: '/apps/converge_myapp', fetchImpl: fetchImpl as unknown as typeof fetch });

    const res = await client.get('my.list/1');

    expect(res).toEqual({ columnOrder: ['a'] });
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('/apps/converge_myapp/api/view-preferences/my.list%2F1');
    expect((opts as RequestInit).credentials).toBe('include');
  });

  it('get: 204 und !ok liefern null (= Default verwenden)', async () => {
    const c204 = createViewPreferencesClient({ fetchImpl: (async () => fakeResponse({ status: 204 })) as unknown as typeof fetch });
    expect(await c204.get('x')).toBeNull();

    const cErr = createViewPreferencesClient({ fetchImpl: (async () => fakeResponse({ status: 500, ok: false })) as unknown as typeof fetch });
    expect(await cErr.get('x')).toBeNull();
  });

  it('put: PUT mit JSON-Body, Content-Type und credentials', async () => {
    const fetchImpl = vi.fn(async () => fakeResponse({ status: 200 }));
    const client = createViewPreferencesClient({ apiBase: '', fetchImpl: fetchImpl as unknown as typeof fetch });

    await client.put('users.list', { sort: null });

    const [url, opts] = fetchImpl.mock.calls[0];
    const init = opts as RequestInit;
    expect(url).toBe('/api/view-preferences/users.list');
    expect(init.method).toBe('PUT');
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ sort: null }));
  });

  it('reset: DELETE auf den Endpoint', async () => {
    const fetchImpl = vi.fn(async () => fakeResponse({ status: 204 }));
    const client = createViewPreferencesClient({ fetchImpl: fetchImpl as unknown as typeof fetch });

    await client.reset('users.list');

    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/view-preferences/users.list');
    expect((opts as RequestInit).method).toBe('DELETE');
  });

  it('apiBase darf eine Funktion sein (Lazy-Resolve pro Request)', async () => {
    let base = '/apps/a';
    const fetchImpl = vi.fn(async () => fakeResponse({ status: 204 }));
    const client = createViewPreferencesClient({ apiBase: () => base, fetchImpl: fetchImpl as unknown as typeof fetch });

    await client.get('l');
    base = '/apps/b';
    await client.get('l');

    expect(fetchImpl.mock.calls[0][0]).toBe('/apps/a/api/view-preferences/l');
    expect(fetchImpl.mock.calls[1][0]).toBe('/apps/b/api/view-preferences/l');
  });
});
