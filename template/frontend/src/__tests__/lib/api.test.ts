import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch } from '../../api';
import { setApiBase, getApiBase } from '../../convergeApi';

/**
 * apiFetch + der Gateway-Präfix.
 *
 * Beides ist reine Logik ohne DOM — aber genau die Stelle, an der eine App im
 * eingebetteten Betrieb bricht: fehlt der Präfix, geht der Request an die
 * Kernel-Origin statt an die eigene App, und ohne `credentials: 'include'`
 * schickt der Browser den app_session-Cookie nicht mit.
 */

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  setApiBase('');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  } as Response;
}

describe('getApiBase / setApiBase', () => {
  it('ist ohne Einbettung leer (lokaler Dev-Server)', () => {
    expect(getApiBase()).toBe('');
  });

  it('übernimmt den vom Kernel gemeldeten Gateway-Pfad', () => {
    setApiBase('/apps/converge_myapp');
    expect(getApiBase()).toBe('/apps/converge_myapp');
  });
});

describe('apiFetch', () => {
  it('stellt den Gateway-Präfix voran und schickt den Session-Cookie mit', async () => {
    setApiBase('/apps/converge_myapp');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await apiFetch('/api/items');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/apps/converge_myapp/api/items');
    expect(init.credentials).toBe('include');
  });

  it('setzt Content-Type application/json für normale Bodies', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await apiFetch('/api/items', { method: 'POST', body: JSON.stringify({ a: 1 }) });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('setzt KEIN Content-Type bei FormData (der Browser braucht die eigene Boundary)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await apiFetch('/api/upload', { method: 'POST', body: new FormData() });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('lässt eigene Header gewinnen', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await apiFetch('/api/items', { headers: { 'Content-Type': 'text/plain' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('text/plain');
  });

  it('gibt den geparsten Body zurück', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [1, 2] }));

    await expect(apiFetch<{ items: number[] }>('/api/items')).resolves.toEqual({ items: [1, 2] });
  });

  it('wirft die Fehlermeldung des Backends, wenn eine da ist', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Nicht erlaubt' }, { ok: false, status: 403 }));

    await expect(apiFetch('/api/items')).rejects.toThrow('Nicht erlaubt');
  });

  it('fällt auf den Statuscode zurück, wenn der Fehlerbody kein JSON ist', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('kein JSON');
      },
    } as unknown as Response);

    await expect(apiFetch('/api/items')).rejects.toThrow('API error 500');
  });
});
