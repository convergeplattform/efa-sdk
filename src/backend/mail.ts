/**
 * mail.ts – fire-and-forget mail client.
 *
 * Sends transactional mails to the converge-mail service. The mail is enqueued
 * server-side and delivered asynchronously through the configured provider
 * (SMTP or Microsoft Graph). The call returns immediately.
 *
 * Routing options (in priority order):
 *   1. MAIL_URL              – direct override (e.g. http://converge-mail-backend:3001/api/mail/send)
 *   2. CONVERGE_GATEWAY_URL  – {gateway}/api/gateway/converge_mail/api/mail/send
 *
 * If neither is set, sendMail is a silent no-op (does not throw, does not block).
 *
 * Auth: X-Service-Auth-Key (SERVICE_AUTH_KEY env var). The caller's service key is
 * forwarded as X-Source-Service so converge-mail can attribute the queue entry.
 *
 * Usage:
 *   import { sendMail } from '../../template-core/mail';
 *
 *   sendMail({
 *     to: ['user@example.com'],
 *     subject: 'Export abgeschlossen',
 *     body_text: '42 Datensätze exportiert.',
 *   });
 */

export interface MailAttachmentInput {
  filename: string;
  content_type: string;
  /** Base64-encoded payload. */
  data_b64: string;
}

export interface SendMailOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  /** Optional override of the provider's default From address. */
  from?: string;
  reply_to?: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  attachments?: MailAttachmentInput[];
  /** ISO timestamp; if set the mail is held until then. */
  scheduled_for?: string;
}

function resolveUrl(): string | null {
  if (process.env.MAIL_URL) return process.env.MAIL_URL;
  const gateway = process.env.CONVERGE_GATEWAY_URL;
  if (gateway) {
    return `${gateway.replace(/\/$/, '')}/api/gateway/converge_mail/api/mail/send`;
  }
  return null;
}

/**
 * Send a transactional mail. Fire-and-forget.
 *
 * Env vars:
 *   MAIL_URL                – optional direct endpoint override
 *   CONVERGE_GATEWAY_URL    – fallback (uses Converge gateway)
 *   SERVICE_AUTH_KEY        – required header for service-to-service auth
 *   SERVICE_KEY / APP_NAME  – stamped as X-Source-Service for traceability
 */
export function sendMail(options: SendMailOptions): void {
  const url = resolveUrl();
  if (!url) return;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const registryKey = process.env.SERVICE_AUTH_KEY;
  if (registryKey) headers['X-Service-Auth-Key'] = registryKey;
  const sourceService = process.env.SERVICE_KEY ?? process.env.APP_NAME ?? 'unknown';
  headers['X-Source-Service'] = sourceService;

  const body = JSON.stringify({
    to: options.to,
    cc: options.cc ?? [],
    bcc: options.bcc ?? [],
    from: options.from,
    reply_to: options.reply_to,
    subject: options.subject,
    body_text: options.body_text,
    body_html: options.body_html,
    attachments: options.attachments,
    scheduled_for: options.scheduled_for,
  });

  fetch(url, { method: 'POST', headers, body }).catch((err) => {
    console.error(
      JSON.stringify({
        level: 'error',
        msg: 'Mail send failed',
        subject: options.subject,
        err: String(err),
      }),
    );
  });
}
