/**
 * reporting.ts – fire-and-forget reporting client.
 *
 * Sends events, logs, metrics, and user activity to Converge's central reporting.
 * Requires REPORTING_URL env var (the Converge backend reporting ingest endpoint).
 * If REPORTING_URL is not set, all calls are silently skipped.
 * Never blocks, never throws.
 *
 * The request must carry the user's session token so Converge can identify the tenant.
 * Pass `req.cookies?.app_session` (or the Bearer token from the request) as `token`.
 *
 * Usage:
 *   import { reportEvent, reportLog, reportMetric, reportActivity } from '../reporting';
 *
 *   reportEvent('item.created', { itemId: id }, req.cookies?.app_session);
 *   reportLog('info', 'User exported data', { count: rows }, req.cookies?.app_session);
 *   reportMetric('export_duration_ms', elapsed, { format: 'csv' }, req.cookies?.app_session);
 *   reportActivity('export', req.cookies?.app_session, undefined, 'items');
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type ReportEntry =
  | { type: 'event'; sourceApp: string; appVersion: string; eventType: string; payload?: Record<string, unknown> }
  | { type: 'log'; sourceApp: string; appVersion: string; level: LogLevel; message: string; context?: Record<string, unknown> }
  | { type: 'metric'; sourceApp: string; appVersion: string; metricName: string; value: number; dimensions?: Record<string, unknown> }
  | { type: 'activity'; sourceApp: string; appVersion: string; action: string; resource?: string };

function ingest(entries: ReportEntry[], token?: string): void {
  const url = process.env.REPORTING_URL;
  if (!url) return;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Fire-and-forget: intentionally not awaited
  fetch(url, { method: 'POST', headers, body: JSON.stringify(entries) }).catch((err) => {
    console.error(
      JSON.stringify({ level: 'error', msg: 'Reporting ingest failed', err: String(err) }),
    );
  });
}

const appName = () => process.env.APP_NAME ?? 'app';
// APP_VERSION wird vom Backend-Dockerfile als ENV gesetzt (siehe ARG APP_VERSION
// dort) — entspricht dem GHCR-Image-Tag des Backends. Lokale dev-Builds liefern 'dev'.
// Beim Debugging eines Reporting-Events sieht der Operator damit, gegen welche
// Backend-Version geschrieben wurde — entscheidend nach Rollbacks oder
// gemischten Deployments.
const appVersion = () => process.env.APP_VERSION ?? 'dev';

/** Send a structured event (e.g. "item.created") to Converge reporting. */
export function reportEvent(
  eventType: string,
  payload?: Record<string, unknown>,
  token?: string,
): void {
  ingest([{ type: 'event', sourceApp: appName(), appVersion: appVersion(), eventType, payload }], token);
}

/** Send a structured log line to Converge reporting. */
export function reportLog(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  token?: string,
): void {
  ingest([{ type: 'log', sourceApp: appName(), appVersion: appVersion(), level, message, context }], token);
}

/** Send a numeric metric to Converge reporting. */
export function reportMetric(
  metricName: string,
  value: number,
  dimensions?: Record<string, unknown>,
  token?: string,
): void {
  ingest([{ type: 'metric', sourceApp: appName(), appVersion: appVersion(), metricName, value, dimensions }], token);
}

/** Send a user activity event to Converge reporting. */
export function reportActivity(
  action: string,
  token?: string,
  userId?: string,
  resource?: string,
): void {
  ingest([{ type: 'activity', sourceApp: appName(), appVersion: appVersion(), action, resource }], token);
}
