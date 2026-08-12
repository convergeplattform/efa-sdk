/**
 * notifications.ts – fire-and-forget notification client.
 *
 * Sends notifications to Converge's central notification system.
 * Requires NOTIFICATION_URL env var (the Converge backend notification send endpoint).
 * If NOTIFICATION_URL is not set, all calls are silently skipped.
 * Never blocks, never throws.
 *
 * The request uses X-Service-Auth-Key for service-to-service auth.
 *
 * Usage:
 *   import { sendNotification } from '../../template-core/notifications';
 *
 *   sendNotification({
 *     userId: 'uuid-of-target-user',
 *     type: 'info',
 *     title: 'Export abgeschlossen',
 *     body: '42 Datensätze exportiert.',
 *     link: '/apps/myapp/',
 *   });
 */

export type NotificationType = 'info' | 'warning' | 'error';

export interface SendNotificationOptions {
  /** UUID of the target user */
  userId: string;
  /** Notification type (default: 'info') */
  type?: NotificationType;
  /** Short notification title (required) */
  title: string;
  /** Optional longer body text */
  body?: string;
  /** Optional deep-link URL (relative to Converge root) */
  link?: string;
}

/**
 * Send a notification to a Converge user. Fire-and-forget.
 *
 * Env vars:
 *   NOTIFICATION_URL – e.g. http://converge-kernel-backend:3001/api/notifications/send
 *   SERVICE_AUTH_KEY – for X-Service-Auth-Key auth
 *   APP_NAME – source app name
 */
export function sendNotification(options: SendNotificationOptions): void {
  const url = process.env.NOTIFICATION_URL;
  if (!url) return;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const registryKey = process.env.SERVICE_AUTH_KEY;
  if (registryKey) {
    headers['X-Service-Auth-Key'] = registryKey;
  }

  const body = JSON.stringify({
    userId: options.userId,
    type: options.type ?? 'info',
    title: options.title,
    body: options.body ?? null,
    link: options.link ?? null,
    sourceApp: process.env.APP_NAME ?? 'app',
  });

  // Fire-and-forget: intentionally not awaited
  fetch(url, { method: 'POST', headers, body }).catch((err) => {
    console.error(
      JSON.stringify({ level: 'error', msg: 'Notification send failed', title: options.title, err: String(err) }),
    );
  });
}
