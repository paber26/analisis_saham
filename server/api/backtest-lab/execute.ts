import { getQuery, createError } from 'h3';
import { getSessionUser } from '../../utils/auth';
import { fetchLabBars, runSweep } from '../../utils/backtestLab';
import { sweepFromSummary, saveSweep } from '../../utils/backtestHistory';
import { tradingDay } from '../../utils/cacheKey';

// Strategi Lab — EKSEKUSI 50 kombinasi parameter dalam satu sweep.
//
// GET /api/backtest-lab/execute   → owner-gated: sesi login ATAU
//   x-app-token APP_TOKEN ATAU ?token= SYNC_TOKEN.
// Cold fetch ~45 saham 5y bisa 15–40 detik; hari yang sama = cache instan.
// Hasil otomatis disimpan ke histori (.data-store/backtest-lab.json).

export default defineCachedEventHandler(async (event) => {
  const user = getSessionUser(event);
  const provided = (getQuery(event).token as string) || '';
  const appOk = provided && provided === (process.env.APP_TOKEN || 'saham-app');
  const syncOk = provided && provided === (process.env.SYNC_TOKEN || 'saham-sync');
  if (!user && !appOk && !syncOk) {
    throw createError({ statusCode: 401, statusMessage: 'Jalankan lab memerlukan login atau token.' });
  }

  const { barsBySymbol, ihsgBars } = await fetchLabBars();
  if (ihsgBars.length < 260 || barsBySymbol.size < 5) {
    throw createError({ statusCode: 503, statusMessage: 'Data backtest belum cukup, coba lagi.' });
  }

  const summary = runSweep(barsBySymbol, ihsgBars);
  if (!summary.executed) {
    throw createError({ statusCode: 422, statusMessage: 'Semua konfigurasi gagal dihitung.' });
  }
  const sweep = sweepFromSummary(summary);
  await saveSweep(sweep);
  return { ok: true, sweep };
}, {
  maxAge: 60 * 60 * 24,
  swr: false,
  name: 'backtest-lab-execute',
  getKey: () => tradingDay()
});
