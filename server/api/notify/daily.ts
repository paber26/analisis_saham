import { getQuery, createError } from 'h3';
import { loadScreenSnapshot } from '../../utils/store';
import { buildDailyDigest } from '../../utils/dailyDigest';
import { sendMail, isMailConfigured, getMailConfig } from '../../utils/mailer';

// Daily recommendation email. Triggered by cron (curl with ?token=), same
// gate as /api/sync. Reads the latest screener snapshot (written by /api/sync),
// composes the digest, and emails it to MAIL_TO.
//
//   ?token=...   required — matches NOTIFY_TOKEN (falls back to SYNC_TOKEN)
//   ?dry=1       build + return the email WITHOUT sending (preview/debug)
//   ?to=addr     override the recipient for this call
//   ?limit=N     number of top picks to include (default 10)
//
// Recommended cron: run AFTER /api/sync has produced the day's snapshot.
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const token = process.env.NOTIFY_TOKEN || process.env.SYNC_TOKEN || 'saham-sync';
  if ((query.token as string) !== token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const snapshot = await loadScreenSnapshot();
  if (!snapshot) {
    return { ok: false, error: 'no screener snapshot yet — run /api/sync first' };
  }

  const limit = Math.max(1, Math.min(50, parseInt((query.limit as string) || '10', 10) || 10));
  const digest = buildDailyDigest(snapshot, { limit });
  const dry = query.dry === '1' || query.dry === 'true';

  if (dry) {
    return {
      ok: true,
      dry: true,
      date: snapshot.date,
      recommendations: digest.count,
      subject: digest.subject,
      mailConfigured: isMailConfigured(),
      to: getMailConfig()?.to ?? null,
      html: digest.html
    };
  }

  const result = await sendMail({
    subject: digest.subject,
    html: digest.html,
    text: digest.text,
    to: (query.to as string) || undefined
  });

  if (!result.ok) {
    throw createError({ statusCode: 502, statusMessage: `mail failed: ${result.error}` });
  }
  return {
    ok: true,
    date: snapshot.date,
    recommendations: digest.count,
    subject: digest.subject,
    to: result.to,
    messageId: result.messageId
  };
});
