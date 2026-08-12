export type RegistryStatus = 'running' | 'stopped' | 'not_found' | 'error';

export interface ResolveServiceResponse {
  serviceKey: string;
  baseUrlInternal: string;
  healthUrl: string;
  openApiUrl: string | null;
  status: RegistryStatus;
}

export interface RegistryServiceDetailResponse extends ResolveServiceResponse {
  capabilities: Array<{
    id: string;
    serviceId: string;
    capabilityKey: string;
    endpointPath: string;
    method: string;
    version: string | null;
  }>;
}

type CacheEntry = {
  value: ResolveServiceResponse;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function normalizeRegistryBaseUrl(registryBaseUrl: string): string {
  return registryBaseUrl.replace(/\/$/, '');
}

export function clearServiceDiscoveryCache(): void {
  cache.clear();
}

/**
 * Resolve a dependent service strictly via Converge Registry.
 *
 * Usage:
 *   const partner = await resolveService('geschaeftspartner');
 *   if (partner.status !== 'running') throw new Error('Dependency unavailable');
 *   const res = await fetch(`${partner.baseUrlInternal}/api/v1/partners`);
 */
export async function resolveService(
  serviceKey: string,
  options?: {
    registryBaseUrl?: string;
    ttlMs?: number;
    fetchImpl?: typeof fetch;
  }
): Promise<ResolveServiceResponse> {
  const ttlMs = options?.ttlMs ?? 60_000;
  const now = Date.now();
  const cached = cache.get(serviceKey);
  if (cached && cached.expiresAt > now) return cached.value;

  const fetchImpl = options?.fetchImpl ?? fetch;
  const baseUrl = normalizeRegistryBaseUrl(options?.registryBaseUrl ?? process.env.CONVERGE_REGISTRY_URL ?? '');
  if (!baseUrl) {
    throw new Error('CONVERGE_REGISTRY_URL ist nicht gesetzt');
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  const registryKey = process.env.SERVICE_AUTH_KEY;
  if (registryKey) headers['X-Service-Auth-Key'] = registryKey;
  const response = await fetchImpl(`${baseUrl}/api/registry/resolve/${encodeURIComponent(serviceKey)}`, {
    method: 'GET',
    headers,
  });
  if (!response.ok) {
    throw new Error(`Service-Aufloesung fehlgeschlagen (${response.status})`);
  }

  const resolved = await response.json() as ResolveServiceResponse;
  cache.set(serviceKey, { value: resolved, expiresAt: now + ttlMs });
  return resolved;
}

/**
 * Load registry detail for endpoint discovery (OpenAPI/capabilities).
 * Useful when an agent must inspect available operations before coding calls.
 */
export async function resolveServiceDetail(
  serviceKey: string,
  options?: { registryBaseUrl?: string; fetchImpl?: typeof fetch }
): Promise<RegistryServiceDetailResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const baseUrl = normalizeRegistryBaseUrl(options?.registryBaseUrl ?? process.env.CONVERGE_REGISTRY_URL ?? '');
  if (!baseUrl) {
    throw new Error('CONVERGE_REGISTRY_URL ist nicht gesetzt');
  }

  const detailHeaders: Record<string, string> = { Accept: 'application/json' };
  const detailRegistryKey = process.env.SERVICE_AUTH_KEY;
  if (detailRegistryKey) detailHeaders['X-Service-Auth-Key'] = detailRegistryKey;
  const response = await fetchImpl(`${baseUrl}/api/registry/services/${encodeURIComponent(serviceKey)}`, {
    method: 'GET',
    headers: detailHeaders,
  });
  if (!response.ok) {
    throw new Error(`Service-Details konnten nicht geladen werden (${response.status})`);
  }

  return response.json() as Promise<RegistryServiceDetailResponse>;
}
