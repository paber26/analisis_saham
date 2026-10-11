import { getQuery, createError } from 'h3';
import { syncKsei } from '../../utils/kseiSync';

// Manual trigger for the KSEI ownership history (normally runs after /api/sync).
// The first run backfills ~80 months and takes a few minutes.
//   curl "http://127.0.0.1:3200/api/ksei/sync?token=SYNC_TOKEN"
export default defineEventHandler(async (event) => {
  const token = process.env.SYNC_TOKEN || 'saham-sync';
  if ((getQuery(event).token as string) !== token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }
  const snap = await syncKsei();
  if (!snap) throw createError({ statusCode: 502, statusMessage: 'Data KSEI tidak bisa diambil. Lihat log server.' });
  return { ok: true, date: snap.date, months: snap.months, stocks: Object.keys(snap.latest).length, evaluation: snap.evaluation };
});
