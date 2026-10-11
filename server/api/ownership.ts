import { getQuery, createError } from 'h3';
import { loadKseiSnapshot } from '../utils/store';
import { getRecentKseiMonths } from '../utils/kseiSync';
import { ownershipSeries } from '../utils/ksei';

// Month-end ownership (KSEI) for one stock: latest shifts, 24-month history,
// and the market-wide evaluation of the ownership signals.
export default defineEventHandler(async (event) => {
  const code = String(getQuery(event).symbol || '').toUpperCase().replace(/\.JK$/, '');
  if (!/^[A-Z]{4}$/.test(code)) throw createError({ statusCode: 400, statusMessage: 'Kode saham tidak valid.' });
  const snap = await loadKseiSnapshot();
  if (!snap) return { available: false as const };
  const latest = snap.latest[code] || null;
  return {
    available: latest != null,
    code,
    date: snap.date,
    latest,
    series: latest ? ownershipSeries(await getRecentKseiMonths(), code, 24) : [],
    evaluation: snap.evaluation
  };
});
