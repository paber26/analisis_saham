import { getQuery, createError } from 'h3';
import { normalizeSymbol, resolveDisplayName } from '../utils/symbol';
import { fetchDailyBars } from '../utils/yahoo';
import { runForecast, type PricePoint } from '../utils/forecast';
import { loadScreenSnapshot } from '../utils/store';
import { tradingDay } from '../utils/cacheKey';

/**
 * Batch forecast scan: run the model for every stock in the daily screening
 * snapshot and return ALL rows with their projection direction — the
 * multi-category filter (arah proyeksi / edge / prob / upside) happens
 * client-side in /forecast.
 *
 * The single-symbol /api/forecast needs ~5y of bars + full model training, so
 * doing this for all 800+ snapshot stocks from the browser is impractical —
 * it must run server-side with a concurrency limit, then be cached per day.
 */

interface ForecastFilterRow {
  code: string;
  symbol: string;
  name: string;
  price: number;              // last actual close (adjusted)
  projPrice: number;          // forecast mean at end of horizon
  direction: 'up' | 'down' | 'flat'; // proyeksi vs aktual di akhir horizon
  upsidePct: number;          // (proj/price - 1) * 100
  expectedReturnPct: number;  // next-day ensemble expected return (%)
  probUp: number;             // probability next day closes up (%)
  edge: 'positif' | 'negatif' | 'netral';
}

interface ForecastFilterResponse {
  date: string;
  horizon: number;
  scanned: number;
  count: number;                    // total rows returned (semua arah)
  counts: { up: number; down: number; flat: number };
  results: ForecastFilterRow[];
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return results;
}

async function buildForecastRow(code: string, horizon: number): Promise<ForecastFilterRow | null> {
  try {
    const symbol = normalizeSymbol(code);
    const fetched = await fetchDailyBars(symbol, '5y', true);
    if (!fetched || fetched.bars.length === 0) return null;

    const points: PricePoint[] = fetched.bars.map((b) => ({ date: b.date, close: b.close }));
    const result = runForecast(points, horizon);
    if (!result) return null;

    const last = result.forecast[result.forecast.length - 1];
    if (!last) return null;
    const direction: ForecastFilterRow['direction'] =
      last.mean > result.lastPrice ? 'up' : last.mean < result.lastPrice ? 'down' : 'flat';

    return {
      code: code.replace('.JK', ''),
      symbol,
      name: resolveDisplayName(symbol, fetched.meta?.longName || fetched.meta?.shortName),
      price: result.lastPrice,
      projPrice: last.mean,
      direction,
      upsidePct: Math.round((last.mean / result.lastPrice - 1) * 1000) / 10,
      expectedReturnPct: result.nextDay.expectedReturnPct,
      probUp: result.nextDay.probUp,
      edge: result.tradeOdds.edge
    };
  } catch {
    return null;
  }
}

export default defineCachedEventHandler(async (event): Promise<ForecastFilterResponse> => {
  const query = getQuery(event);
  let horizon = parseInt((query.horizon as string) || '14', 10);
  if (!Number.isFinite(horizon)) horizon = 14;
  horizon = Math.max(5, Math.min(60, horizon));

  const snap = await loadScreenSnapshot();
  if (!snap || snap.rows.length === 0) {
    throw createError({ statusCode: 503, statusMessage: 'Snapshot screening belum tersedia. Jalankan /api/sync dulu.' });
  }

  const codes = snap.rows.map((r) => r.code);
  const rows = await mapWithConcurrency(codes, 8, (c) => buildForecastRow(c, horizon));

  const results = rows
    .filter((r): r is ForecastFilterRow => r !== null)
    .sort((a, b) => b.upsidePct - a.upsidePct);

  return {
    date: tradingDay(),
    horizon,
    scanned: codes.length,
    count: results.length,
    counts: {
      up: results.filter((r) => r.direction === 'up').length,
      down: results.filter((r) => r.direction === 'down').length,
      flat: results.filter((r) => r.direction === 'flat').length
    },
    results
  };
}, {
  maxAge: 60 * 60 * 24, // 1 day (refreshed via the day-based key)
  swr: true,
  name: 'forecast-screen',
  getKey: (event) => {
    const q = getQuery(event);
    return `h${q.horizon || 14}:${tradingDay()}`;
  }
});
