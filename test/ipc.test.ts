import { describe, it, expect, vi, afterEach } from 'vitest';
import { appInfoDeclareFromAuth, registerAppInfo } from '../src/frontend/ipc';

// Korrelation der App-Info über den serviceKey: eine App re-deklariert bei jedem
// CONVERGE_AUTH und taggt die Deklaration mit dem serviceKey, den der Kernel
// sendet — so kann der Kernel Stale (vorher offene App) von der aktuellen App
// unterscheiden.

describe('appInfoDeclareFromAuth', () => {
  const info = { appName: 'Converge Wetter', version: '1.2.3' };

  it('baut die DECLARE-Nachricht mit serviceKey aus CONVERGE_AUTH', () => {
    expect(appInfoDeclareFromAuth(info, { type: 'CONVERGE_AUTH', serviceKey: 'converge_weather' })).toEqual({
      type: 'CONVERGE_DECLARE_APP_INFO',
      payload: { appName: 'Converge Wetter', version: '1.2.3', serviceKey: 'converge_weather' },
    });
  });

  it('ignoriert Nicht-Auth-Nachrichten', () => {
    expect(appInfoDeclareFromAuth(info, { type: 'CONVERGE_ROUTE_CHANGED', serviceKey: 'x' })).toBeNull();
  });

  it('ignoriert Auth ohne string-serviceKey', () => {
    expect(appInfoDeclareFromAuth(info, { type: 'CONVERGE_AUTH' })).toBeNull();
    expect(appInfoDeclareFromAuth(info, { type: 'CONVERGE_AUTH', serviceKey: 42 })).toBeNull();
    expect(appInfoDeclareFromAuth(info, null)).toBeNull();
  });
});

describe('registerAppInfo', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubEmbeddedWindow() {
    const parent = { postMessage: vi.fn() };
    let handler: ((e: any) => void) | null = null;
    const win: any = {
      parent,
      location: { origin: 'https://app.example', ancestorOrigins: { 0: 'https://kernel.example', length: 1 } },
      addEventListener: vi.fn((type: string, h: any) => {
        if (type === 'message') handler = h;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('window', win);
    return { win, parent, getHandler: () => handler };
  }

  it('re-deklariert mit serviceKey bei CONVERGE_AUTH vom Parent', () => {
    const { parent, getHandler } = stubEmbeddedWindow();
    registerAppInfo({ appName: 'Converge Wetter', version: '1.2.3' });
    getHandler()!({ source: parent, data: { type: 'CONVERGE_AUTH', serviceKey: 'converge_weather' } });
    expect(parent.postMessage).toHaveBeenCalledWith(
      {
        type: 'CONVERGE_DECLARE_APP_INFO',
        payload: { appName: 'Converge Wetter', version: '1.2.3', serviceKey: 'converge_weather' },
      },
      'https://kernel.example',
    );
  });

  it('ignoriert Nachrichten, die nicht vom Platform-Parent stammen', () => {
    const { parent, getHandler } = stubEmbeddedWindow();
    registerAppInfo({ appName: 'Converge Wetter', version: '1.2.3' });
    getHandler()!({ source: { fake: true }, data: { type: 'CONVERGE_AUTH', serviceKey: 'converge_weather' } });
    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it('Unsubscribe entfernt den Listener', () => {
    const { win, getHandler } = stubEmbeddedWindow();
    const unsub = registerAppInfo({ appName: 'Converge Wetter', version: '1.2.3' });
    unsub();
    expect(win.removeEventListener).toHaveBeenCalledWith('message', getHandler());
  });

  it('ist ein No-op, wenn die App nicht eingebettet ist', () => {
    const self: any = { location: { origin: 'https://app.example' }, addEventListener: vi.fn() };
    self.parent = self; // parent === window → nicht eingebettet
    vi.stubGlobal('window', self);
    const unsub = registerAppInfo({ appName: 'Converge Wetter', version: '1.2.3' });
    expect(self.addEventListener).not.toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
  });
});
