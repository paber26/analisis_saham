import { getQuery, createError } from 'h3';
import { loadScreenSnapshot } from '../../utils/store';
import { trainAndStoreMl } from '../../utils/mlTrain';

// Manual trigger for the pooled ML ranking model (normally runs after /api/sync).
//   curl "http://127.0.0.1:3200/api/ml/train?token=SYNC_TOKEN"
export default defineEventHandler(async (event) => {
  const token = process.env.SYNC_TOKEN || 'saham-sync';
  if ((getQuery(event).token as string) !== token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }
  const snap = await loadScreenSnapshot();
  if (!snap || !snap.rows.length) {
    throw createError({ statusCode: 503, statusMessage: 'Snapshot screening belum ada. Jalankan /api/sync dulu.' });
  }
  const ml = await trainAndStoreMl(snap.rows.map((r) => r.code));
  if (!ml) throw createError({ statusCode: 500, statusMessage: 'Training ML gagal (data tidak cukup?). Lihat log server.' });
  const { scores, ...meta } = ml;
  return { ok: true, scored: Object.keys(scores).length, ...meta };
});
