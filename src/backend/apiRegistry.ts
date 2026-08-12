/**
 * apiRegistry.ts – Register API metadata and capabilities with Converge.
 *
 * Apps call registerApiMetadata() once at startup (after registerPermissions).
 * Converge creates/updates service_api_metadata and service_capabilities for
 * the app's service registry entry. Capabilities no longer declared are removed.
 *
 * Usage in index.ts:
 *   import { registerApiMetadata } from '../../template-core/apiRegistry';
 *
 *   app.listen(PORT, async () => {
 *     await registerPermissions('myapp', [...]);
 *     await registerApiMetadata('myapp', {
 *       description: 'Kundenstammdaten: Kunden anlegen, bearbeiten, suchen.',
 *       capabilities: [
 *         {
 *           capabilityKey: 'list_customers',
 *           endpointPath: '/api/customers',
 *           method: 'GET',
 *           description: 'Alle Kunden auflisten',
 *           tags: ['kunden', 'read'],
 *         },
 *       ],
 *     });
 *   });
 *
 * capabilityKey:
 *   A short, unique identifier for the capability (e.g. 'list_customers').
 *   Must be unique per service + endpoint + method combination.
 */

export interface ApiCapability {
  /** Unique key for this capability (e.g. 'list_customers') */
  capabilityKey: string;
  /** Endpoint path (e.g. '/api/v1/customers') */
  endpointPath: string;
  /** HTTP method: GET, POST, PUT, PATCH, DELETE */
  method: string;
  /** Human-readable description */
  description?: string;
  /** JSON Schema for request body */
  requestSchema?: Record<string, unknown>;
  /** JSON Schema for response body */
  responseSchema?: Record<string, unknown>;
  /** Tags for search/filtering (e.g. ['kunden', 'read']) */
  tags?: string[];
  /** Whether auth is required (default: true) */
  authRequired?: boolean;
}

export interface ApiMetadataPayload {
  /** What this service does overall */
  description: string;
  /** API version string (e.g. 'v1') */
  apiVersion?: string;
  /** URL to OpenAPI/Swagger spec (optional) */
  openApiSpecUrl?: string;
  /** List of API capabilities */
  capabilities: ApiCapability[];
}

function log(level: string, msg: string, extra?: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, msg, timestamp: new Date().toISOString(), ...extra }));
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const registryKey = process.env.SERVICE_AUTH_KEY;
  if (registryKey) headers['X-Service-Auth-Key'] = registryKey;
  return headers;
}

/**
 * Register API metadata and capabilities for this app with the Converge dashboard.
 *
 * @param serviceKey  The service_key as registered in the Converge service registry
 * @param metadata    API description and list of capabilities
 * @param options     Optional overrides (registryBaseUrl, retries, retryDelayMs)
 */
export async function registerApiMetadata(
  serviceKey: string,
  metadata: ApiMetadataPayload,
  options?: {
    registryBaseUrl?: string;
    retries?: number;
    retryDelayMs?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<void> {
  if (metadata.capabilities.length === 0) return;

  const baseUrl = (options?.registryBaseUrl ?? process.env.CONVERGE_REGISTRY_URL ?? '').replace(/\/$/, '');
  if (!baseUrl) {
    log('warn', 'registerApiMetadata: CONVERGE_REGISTRY_URL nicht gesetzt – übersprungen');
    return;
  }

  const maxRetries = options?.retries ?? 3;
  const retryDelay = options?.retryDelayMs ?? 5_000;
  const fetchImpl = options?.fetchImpl ?? fetch;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const url = `${baseUrl}/api/registry/services/${encodeURIComponent(serviceKey)}/capabilities`;
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(metadata),
      });

      if (res.ok) {
        const body = (await res.json()) as { registered?: string[] };
        log('info', 'API-Metadaten bei Converge registriert', {
          serviceKey,
          registered: body.registered,
        });
        return;
      }

      const errText = await res.text().catch(() => '');
      log('warn', 'registerApiMetadata: Converge antwortete mit Fehler', {
        status: res.status,
        body: errText,
        attempt,
      });
    } catch (err) {
      log('warn', 'registerApiMetadata: Netzwerkfehler', {
        err: String(err),
        attempt,
      });
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, retryDelay));
    }
  }

  log('error', 'registerApiMetadata: Konnte API-Metadaten nicht registrieren nach allen Versuchen', {
    serviceKey,
    maxRetries,
  });
}
