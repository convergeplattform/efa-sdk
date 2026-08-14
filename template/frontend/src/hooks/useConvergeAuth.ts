import { useState, useEffect } from 'react';
import { AppUser, ConvergeTheme, DEV_THEME } from '../types';
import { setApiBase } from '../convergeApi';
import { isFromPlatformParent } from '@efa-one/sdk/frontend/ipc';

/** Service-Key-Kontrakt (siehe CLAUDE.md „Naming-Konventionen"). */
const SERVICE_KEY_RE = /^[a-z][a-z0-9_]{1,63}$/;

interface ConvergeAuthState {
  user: AppUser | null;
  theme: ConvergeTheme | null;
  isReady: boolean;
  error: string | null;
}

/**
 * Applies Converge theme colors as CSS custom properties on <html>.
 * Same property names as Converge's own applyTheme() – apps use --color-primary etc.
 */
function applyThemeColors(theme: ConvergeTheme): void {
  const root = document.documentElement;
  const c = theme.colors;
  root.style.setProperty('--color-primary', c.primary);
  root.style.setProperty('--color-primary-hover', c.primaryHover);
  root.style.setProperty('--color-secondary', c.secondary);
  root.style.setProperty('--color-background', c.background);
  root.style.setProperty('--color-surface', c.surface);
  root.style.setProperty('--color-surface-raised', c.surfaceRaised);
  root.style.setProperty('--color-border', c.border);
  root.style.setProperty('--color-text-primary', c.textPrimary);
  root.style.setProperty('--color-text-secondary', c.textSecondary);
  root.style.setProperty('--color-text-muted', c.textMuted);
  root.style.setProperty('--color-success', c.success);
  root.style.setProperty('--color-warning', c.warning);
  root.style.setProperty('--color-danger', c.danger);
  root.style.setProperty('--color-header-bg',           c.headerBg ?? c.surface);
  root.style.setProperty('--color-header-text',         c.headerText ?? c.textPrimary);
  root.style.setProperty('--color-header-button-hover', c.headerButtonHover ?? 'rgba(0,0,0,0.05)');
  root.setAttribute('data-theme', theme.mode);
  if (theme.mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Exchanges a Converge JWT for an httpOnly app_session cookie.
 * apiBase is the gateway path prefix (e.g. "/apps/converge_zbv") or "" for local dev.
 *
 * Permissions stehen NICHT im JWT — werden vom Kernel live geladen und in den
 * AppUser gemerged.
 */
async function exchangeToken(token: string, apiBase: string): Promise<AppUser> {
  const res = await fetch(`${apiBase}/api/auth/exchange`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Exchange failed (${res.status})`);
  }
  const data = await res.json() as { user: AppUser };
  const permissions = await fetchUserPermissions(apiBase).catch(() => [] as string[]);
  return { ...data.user, permissions };
}

/**
 * Lädt die Permissions des aktuell eingeloggten Users live vom App-Backend.
 * Das App-Backend ruft dafür intern converge_access auf — Apps sehen dadurch
 * immer die aktuellen Permissions (kein 8h-Lag durch JWT-Caching).
 */
export async function fetchUserPermissions(apiBase: string = ''): Promise<string[]> {
  const res = await fetch(`${apiBase}/api/auth/permissions`, { credentials: 'include' });
  if (!res.ok) return [];
  const data = await res.json() as { keys?: string[] };
  return data.keys ?? [];
}

/**
 * useConvergeAuth – the main auth hook for Converge-integrated apps.
 *
 * Embedded in Converge:
 *   Listens for CONVERGE_AUTH postMessage → exchanges JWT → sets cookie.
 *   The message includes `serviceKey` so the exchange request goes to the
 *   correct gateway path (/apps/{serviceKey}/api/auth/exchange).
 *
 * Local dev (not embedded, ENVIRONMENT=development in backend):
 *   Probes /dev/token at runtime → 200 means dev mode, 404 means production.
 *   No build-time env var needed – set ENVIRONMENT=development in .env.
 *
 * Returns { user, theme, isReady } – no token in state (XSS-safe).
 */
export function useConvergeAuth(): ConvergeAuthState {
  const [state, setState] = useState<ConvergeAuthState>({
    user: null,
    theme: null,
    isReady: false,
    error: null,
  });

  useEffect(() => {
    const isEmbedded = window.self !== window.top;
    let exchanged = false;

    async function handleToken(token: string, theme: ConvergeTheme | null, apiBase: string): Promise<void> {
      try {
        const user = await exchangeToken(token, apiBase);
        const resolvedTheme = theme ?? DEV_THEME;
        applyThemeColors(resolvedTheme);
        setState({ user, theme: resolvedTheme, isReady: true, error: null });
      } catch (err) {
        setState({ user: null, theme: null, isReady: true, error: String(err) });
      }
    }

    if (isEmbedded) {
      // Receive JWT from Converge via postMessage.
      // Origin-Guard zuerst: nur der einbettende Kernel-Frame darf CONVERGE_AUTH
      // liefern. Ohne das könnte ein Sibling-iframe oder window.opener ein
      // CONVERGE_AUTH mit fremdem (eigenem, gültigem) Token einschleusen und die
      // App-Session auf einen fremden User fixieren (Session-Fixation).
      const handler = (event: MessageEvent): void => {
        if (!isFromPlatformParent(event)) return;
        if (event.data?.type !== 'CONVERGE_AUTH') return;
        if (exchanged) return; // Duplikate ignorieren (Kernel sendet 3x als Retry)
        const { token, theme, serviceKey } = event.data as {
          token: string;
          theme?: ConvergeTheme;
          serviceKey?: string;
        };
        // serviceKey geht in einen fetch-Pfad → Format erzwingen (Defense-in-Depth).
        if (serviceKey !== undefined && !SERVICE_KEY_RE.test(serviceKey)) return;
        exchanged = true;
        // Build API base path from serviceKey sent by Converge
        const apiBase = serviceKey ? `/apps/${serviceKey}` : '';
        setApiBase(apiBase);
        handleToken(token, theme ?? null, apiBase);
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    } else {
      // Standalone aufgerufen. Sind wir unter dem Kernel-Gateway (/apps/<sk>/…),
      // ist das die rohe iframe-URL, die jemand direkt geöffnet hat (Rechtsklick
      // „Frame in neuem Tab", geleakte/gebookmarkte Innen-URL). Auf den Kernel-
      // Deeplink umleiten, damit die App eingebettet + authentifiziert lädt statt
      // am Standalone-Auth-Probe (HTML statt JSON) zu scheitern.
      const gw = window.location.pathname.match(/^\/apps\/([a-z][a-z0-9_]{1,63})\//);
      if (gw && window.top) {
        const inner = window.location.hash.replace(/^#/, '');
        window.top.location.replace(`/#/app/${gw[1]}${inner}`);
        return;
      }
      // Not embedded – probe /dev/token. Backend serves this only when ENVIRONMENT=development.
      // 404 means production mode (route disabled), 200 means dev mode (use mock JWT).
      fetch('/dev/token')
        .then(async (r) => {
          if (!r.ok) {
            setState({ user: null, theme: null, isReady: true, error: 'Not running in Converge or dev mode' });
            return;
          }
          const data = await r.json() as { token: string };
          return handleToken(data.token, null, '');
        })
        .catch((err) => {
          setState({ user: null, theme: null, isReady: true, error: String(err) });
        });
    }
  }, []);

  return state;
}
