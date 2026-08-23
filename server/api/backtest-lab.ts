import { getQuery, createError } from 'h3';
import { getLatestSweep, getSweep, listSweepSummaries } from '../utils/backtestHistory';

// Strategi Lab — pembacaan hasil sweep tersimpan.
// GET /api/backtest-lab              → { latest, sweeps[] }
// GET /api/backtest-lab?sweep=<id>   → satu sweep penuh
// Eksekusi ada di /api/backtest-lab/execute (owner-gated).

export default defineCachedEventHandler(async (event) => {
  const sweepId = getQuery(event).sweep as string;

  if (sweepId) {
    const sweep = await getSweep(sweepId);
    if (!sweep) throw createError({ statusCode: 404, statusMessage: 'Sweep tidak ditemukan.' });
    return { ok: true, sweep };
  }

  const [latest, sweeps] = await Promise.all([getLatestSweep(), listSweepSummaries()]);
  return { ok: true, latest, sweeps };
}, {
  maxAge: 300,
  swr: true,
  name: 'backtest-lab',
  getKey: (event) => `latest:${getQuery(event).sweep ?? ''}`
});
