import { getQuery, createError } from 'h3';
import { getSessionUser } from '../../utils/auth';
import { getAlertStore, saveAlertStore, loadScreenSnapshot, type AlertRule } from '../../utils/store';
import { evaluateAlerts } from '../../utils/alerts';
import { tradingDay, shortHash } from '../../utils/cacheKey';
import { sendTelegram, isTelegramConfigured } from '../../utils/notifyTelegram';
import { sendMail, isMailConfigured } from '../../utils/mailer';

// Evaluate alert rules against today's screener snapshot and notify.
// Intended for cron right after /api/sync:
//   curl "http://127.0.0.1:3200/api/alerts/run?token=SYNC_TOKEN"
// Auth: SYNC_TOKEN/APP_TOKEN via ?token= OR a valid login session (so the
// "Uji sekarang" button in /alert works for the logged-in owner).
// ?dry=1 → evaluate + report only; nothing is persisted or sent.
export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const user = getSessionUser(event);
  const provided = (q.token as string) || '';
  const syncOk = provided && provided === (process.env.SYNC_TOKEN || 'saham-sync');
  const appOk = provided && provided === (process.env.APP_TOKEN || 'saham-app');
  if (!user && !syncOk && !appOk) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const dry = q.dry === '1' || q.dry === 'true';
  const snap = await loadScreenSnapshot();
  if (!snap) {
    return { ok: false, note: 'Belum ada snapshot — jalankan /api/sync dulu.', triggers: [] };
  }
  if (!snap.rows?.length) {
    return { ok: false, note: 'Snapshot kosong.', date: snap.date, triggers: [] };
  }

  const store = await getAlertStore();
  const today = tradingDay();
  const { triggers, firedIds } = evaluateAlerts(store.rules, snap.rows, today);

  if (!dry && firedIds.length) {
    const nowIso = new Date().toISOString();
    store.rules = store.rules.map((r): AlertRule =>
      firedIds.includes(r.id) ? { ...r, lastTriggeredAt: today, ...(r.createdAt ? {} : { createdAt: nowIso }) } : r
    );
    // history newest-first, capped by saveAlertStore
    store.history = [...triggers, ...store.history].slice(0, 100);
    await saveAlertStore(store);
  }

  // ---- Notify (best-effort, never fails the run) ----
  let telegram: { ok: boolean; error?: string } | null = null;
  let email: { ok: boolean; error?: string } | null = null;
  if (!dry && triggers.length) {
    if (isTelegramConfigured()) {
      telegram = await sendTelegram(
        `🔔 Alert Saham (${snap.date})\n\n` +
          triggers.map((t) => `• ${t.message}`).join('\n') +
          `\n\n— saham.kuydinas.id`
      );
    }
    if (isMailConfigured()) {
      email = await sendMail({
        subject: `🔔 Alert Saham ${snap.date} — ${triggers.length} sinyal`,
        text: triggers.map((t) => `• ${t.message}`).join('\n'),
        html:
          `<div style="font-family:sans-serif;font-size:14px">` +
          `<h3>🔔 Alert Saham ${snap.date}</h3><ul>` +
          triggers.map((t) => `<li>${t.message}</li>`).join('') +
          `</ul><p style="color:#888">saham.kuydinas.id</p></div>`
      });
    }
  }

  return {
    ok: true,
    date: snap.date,
    today,
    evaluatedRules: store.rules.filter((r) => r.active !== false).length,
    triggered: triggers.length,
    rulesFired: firedIds.length,
    dedupedToday: store.rules.filter((r) => r.lastTriggeredAt === today && !firedIds.includes(r.id)).length,
    dry,
    notified: { telegram, email },
    telegramConfigured: isTelegramConfigured(),
    mailConfigured: isMailConfigured(),
    triggers: triggers.map((t) => ({ code: t.code, message: t.message })),
    runId: `${today}_${shortHash(firedIds.join(',') + triggers.length)}`
  };
});
