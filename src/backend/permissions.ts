/**
 * permissions.ts – Register app-specific permission objects with Converge.
 *
 * Apps call registerPermissions() once at startup (after the server is listening).
 * Der converge_access-Service legt permission_objects an / aktualisiert sie und
 * entfernt nicht mehr gemeldete Custom-Permissions (.default bleibt erhalten).
 *
 * Usage in index.ts:
 *   import { registerPermissions } from '../../template-core/permissions';
 *
 *   app.listen(PORT, async () => {
 *     await registerPermissions('myapp', [
 *       { key: 'readonly',   displayName: 'MyApp – Nur Lesen',  level: 1 },
 *       { key: 'can-export', displayName: 'MyApp – Export',      level: 2 },
 *     ]);
 *   });
 *
 * Key format:
 *   Pass the short suffix only (e.g. 'readonly'). The Permissions-App prefixes it
 *   automatically with the service key ('myapp.readonly').
 *   If a fully-qualified key with '.' is passed, it is used as-is.
 */

export interface AppPermission {
  /** Short key suffix (e.g. 'readonly') or full key (e.g. 'myapp.readonly') */
  key: string;
  /** Human-readable label shown in Converge role management */
  displayName: string;
  /** Numeric level – 0 = standard, higher = more privileged */
  level: number;
}

function log(level: string, msg: string, extra?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

/**
 * Register custom permission objects for this app with the Converge Permissions-App.
 *
 * @param serviceKey  The service_key as registered in Converge
 * @param permissions Array of permission definitions to register
 * @param options     Optional overrides (registryBaseUrl, retries, retryDelayMs)
 */
export async function registerPermissions(
  serviceKey: string,
  permissions: AppPermission[],
  options?: {
    registryBaseUrl?: string;
    retries?: number;
    retryDelayMs?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<void> {
  if (permissions.length === 0) return;

  // Ziel: Permissions-App über den Gateway oder direkte URL
  // Reihenfolge: CONVERGE_GATEWAY_URL (Gateway-Proxy), dann CONVERGE_REGISTRY_URL (Legacy)
  const gatewayUrl = (process.env.CONVERGE_GATEWAY_URL ?? '').replace(/\/$/, '');
  const legacyUrl = (options?.registryBaseUrl ?? process.env.CONVERGE_REGISTRY_URL ?? '').replace(/\/$/, '');

  let url: string;
  if (gatewayUrl) {
    // Über Gateway → converge-access (zentrale Zugriffsverwaltung)
    url = `${gatewayUrl}/api/gateway/converge_access/api/internal/register`;
  } else if (legacyUrl) {
    // Legacy: direkt an Dashboard-Registry (Abwärtskompatibilität während Migration)
    url = `${legacyUrl}/api/registry/services/${encodeURIComponent(serviceKey)}/permissions`;
  } else {
    log('warn', 'registerPermissions: Weder CONVERGE_GATEWAY_URL noch CONVERGE_REGISTRY_URL gesetzt – übersprungen');
    return;
  }

  const maxRetries = options?.retries ?? 3;
  const retryDelay = options?.retryDelayMs ?? 5_000;
  const fetchImpl = options?.fetchImpl ?? fetch;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
      const registryKey = process.env.SERVICE_AUTH_KEY;
      if (registryKey) headers['X-Service-Auth-Key'] = registryKey;

      const res = await fetchImpl(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ serviceKey, permissions }),
      });

      if (res.ok) {
        const body = await res.json() as { registered?: string[] };
        log('info', 'Permissions registriert', {
          serviceKey,
          registered: body.registered,
        });
        return;
      }

      const errText = await res.text().catch(() => '');
      log('warn', 'registerPermissions: Plattform antwortete mit Fehler', {
        status: res.status,
        body: errText,
        attempt,
      });
    } catch (err) {
      log('warn', 'registerPermissions: Netzwerkfehler', {
        err: String(err),
        attempt,
      });
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, retryDelay));
    }
  }

  log('error', 'registerPermissions: Konnte Permissions nicht registrieren nach allen Versuchen', {
    serviceKey,
    maxRetries,
  });
}
