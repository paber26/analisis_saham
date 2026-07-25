// Email transport for outbound notifications (daily recommendations, alerts).
//
// SMTP-based (nodemailer) so it works with any provider — the default target is
// a personal Gmail using an App Password. All secrets come from env; nothing is
// hardcoded. Config is read lazily so the app boots fine even when mail is unset.
//
// Required env (set in .deploy.env, shipped to PM2 via deploy.sh):
//   SMTP_HOST     e.g. smtp.gmail.com
//   SMTP_PORT     e.g. 465 (SSL) or 587 (STARTTLS)
//   SMTP_USER     the SMTP login (usually the full email address)
//   SMTP_PASS     the SMTP password / Gmail App Password (NEVER commit)
//   MAIL_FROM     From header, defaults to SMTP_USER
//   MAIL_TO       default recipient, defaults to bernaldo.stis@gmail.com

import nodemailer, { type Transporter } from 'nodemailer';

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports (STARTTLS)
  user: string;
  pass: string;
  from: string;
  to: string;
}

const DEFAULT_TO = 'bernaldo.stis@gmail.com';

/** Read + validate mail config from env. Returns null when not fully configured. */
export function getMailConfig(): MailConfig | null {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const pass = process.env.SMTP_PASS || '';
  if (!host || !user || !pass) return null;

  const port = parseInt(process.env.SMTP_PORT || '465', 10) || 465;
  return {
    host,
    port,
    secure: port === 465,
    user,
    pass,
    from: (process.env.MAIL_FROM || user).trim(),
    to: (process.env.MAIL_TO || DEFAULT_TO).trim()
  };
}

/** True when SMTP is configured — lets endpoints report a clear status. */
export function isMailConfigured(): boolean {
  return getMailConfig() !== null;
}

let cachedTransport: Transporter | null = null;
let cachedKey = '';

function getTransport(cfg: MailConfig): Transporter {
  const key = `${cfg.host}:${cfg.port}:${cfg.user}`;
  if (cachedTransport && cachedKey === key) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass }
  });
  cachedKey = key;
  return cachedTransport;
}

export interface SendMailInput {
  subject: string;
  html: string;
  text?: string;
  to?: string; // override the default recipient
}

export interface SendMailResult {
  ok: boolean;
  to?: string;
  messageId?: string;
  error?: string;
}

/**
 * Send one email. Never throws — returns { ok:false, error } so callers (cron
 * endpoints) can surface the failure in their JSON response instead of 500ing.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const cfg = getMailConfig();
  if (!cfg) return { ok: false, error: 'SMTP not configured (set SMTP_HOST/SMTP_USER/SMTP_PASS)' };

  const to = (input.to || cfg.to).trim();
  if (!to) return { ok: false, error: 'no recipient (set MAIL_TO)' };

  try {
    const info = await getTransport(cfg).sendMail({
      from: cfg.from,
      to,
      subject: input.subject,
      html: input.html,
      text: input.text
    });
    return { ok: true, to, messageId: info.messageId };
  } catch (err: any) {
    console.error('[mailer] send failed:', err?.message || err);
    return { ok: false, to, error: err?.message || String(err) };
  }
}
