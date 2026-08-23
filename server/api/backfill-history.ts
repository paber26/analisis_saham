import { getQuery, createError } from 'h3';
import { IDX_TICKERS } from '../utils/idxTickers';
import { backfillDailyHistory } from '../utils/historyBackfill';

// One-time (resumable) seeding of daily_history with past screener rows
// recomputed from Yahoo 2y bars — no look-ahead, existing dates never touched.
//
// GET /api/backfill-history?token=SYNC_TOKEN[&limit=N]
// - limit=0 → seluruh IDX_TICKERS (~940); jalankan bertahap bila ragu.
// - Idempotent & resumable: tanggal yang sudah ada di histori dilewati, dan
//   fetch Yahoo memakai day-cache sehingga re-run di hari yang sama murah.
export default defineEventHandler(async (event): Promise<{
  ok: boolean;
  attempted: number;
  okTickers: number;
  filledDates: number;
  skippedDates: number;
  firstDate: string | null;
  lastDate: string | null;
  ms: number;
}> => {
  const query = getQuery(event);
  const token = process.env.SYNC_TOKEN || 'saham-sync';
  if ((query.token as string) !== token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const limit = parseInt((query.limit as string) || '0', 10);
  const tickers = limit > 0 ? IDX_TICKERS.slice(0, limit) : IDX_TICKERS;

  const t0 = Date.now();
  const r = await backfillDailyHistory(tickers, { concurrency: 6 });
  return { ok: true, ...r, ms: Date.now() - t0 };
});
