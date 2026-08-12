/**
 * audit.ts – audit client mit Zustell-Retry (Finding #12).
 *
 * Logs events to the kernel audit endpoint (AUDIT_URL env var).
 * If AUDIT_URL is not set, the call is silently skipped (Dev-Default).
 * Never blocks the caller, never throws.
 *
 * Auth: service-to-service via X-Service-Auth-Key (SERVICE_AUTH_KEY env var) — wie
 * alle anderen template-core-Clients. Der app_session-Bearer (HS256) ist vom
 * Kernel NICHT verifizierbar (er erwartet RS256), daher trägt der Registry-Key
 * die Authentifizierung. Weil der Aufruf damit als "intern" gilt, kennt der
 * Kernel den Akteur nicht aus dem Token — die User-Identität MUSS im payload
 * mitkommen (`userId`, optional `userEmail`, `userName`).
 *
 * Reservierte payload-Keys werden auf Top-Level gehoben (der Kernel liest sie
 * dort): `userId`, `userEmail`, `tenant`, `mode`. Der restliche Kontext landet
 * verschachtelt unter `payload` → so füllt er die JSONB-Spalte audit_logs.payload.
 *
 * DURABILITY (Finding #12): früher genau EIN fetch ohne Retry — ein kurzer
 * Kernel-Ausfall verlor das compliance-relevante Event still. Jetzt: bis zu vier
 * Zustellversuche mit Backoff (transiente 5xx/429/Netzwerkfehler). Scheitert die
 * Zustellung endgültig, wird das komplette Event als strukturierte Zeile
 * `AUDIT_DELIVERY_FAILED` nach stderr geschrieben — aus den Container-Logs
 * rekonstruierbar. (Garantierte Zustellung über Neustarts hinweg — Outbox-Tabelle
 * — ist bewusst NICHT hier: siehe BACKLOG „Audit-Outbox".)
 *
 * Usage:
 *   import { logAudit } from '../audit';
 *   logAudit('user.role_changed', { targetId: userId, newRole: 'admin', userId: req.user?.sub });
 */

const AUDIT_MAX_ATTEMPTS = 4;
const AUDIT_BACKOFF_MS = [250, 1000, 3000];

function auditDeliveryFailed(event: string, body: string, reason: string): void {
  // Vollständiges Event mitloggen → aus stderr/Container-Logs nachtragbar.
  console.error(JSON.stringify({ level: 'error', msg: 'AUDIT_DELIVERY_FAILED', event, reason, body }));
}

async function deliverAudit(url: string, headers: Record<string, string>, body: string, event: string): Promise<void> {
  for (let attempt = 1; attempt <= AUDIT_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body });
      if (res.status < 400) return; // 2xx/202/3xx = zugestellt
      // 4xx außer 429 = Client-Fehler → Retry sinnlos, sofort laut scheitern.
      if (res.status < 500 && res.status !== 429) {
        auditDeliveryFailed(event, body, `http_${res.status}`);
        return;
      }
      // 5xx/429 → weiter zum Retry
    } catch {
      // Netzwerk-/Timeout-Fehler → weiter zum Retry
    }
    if (attempt < AUDIT_MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, AUDIT_BACKOFF_MS[attempt - 1] ?? 3000));
    }
  }
  auditDeliveryFailed(event, body, 'exhausted_retries');
}

export function logAudit(
  event: string,
  payload: Record<string, unknown>,
  token?: string,
): void {
  const url = process.env.AUDIT_URL;
  if (!url) return;

  const { userId, userEmail, tenant, mode, ...context } = payload ?? {};

  const body = JSON.stringify({
    eventType: event,
    sourceApp: process.env.APP_NAME ?? 'app',
    timestamp: new Date().toISOString(),
    ...(userId !== undefined ? { userId } : {}),
    ...(userEmail !== undefined ? { userEmail } : {}),
    ...(tenant !== undefined ? { tenant } : {}),
    ...(mode !== undefined ? { mode } : {}),
    payload: context,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const registryKey = process.env.SERVICE_AUTH_KEY;
  if (registryKey) {
    headers['X-Service-Auth-Key'] = registryKey;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Fire-and-forget aus Sicht des Aufrufers: Retry-Zustellung läuft im Hintergrund.
  void deliverAudit(url, headers, body, event);
}
