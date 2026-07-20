import { getQuery, createError } from 'h3';
import { normalizeSymbol, resolveDisplayName, YAHOO_HEADERS } from '../utils/symbol';
import { runForecast, type PricePoint, type ForecastResult } from '../utils/forecast';
import { tradingDay } from '../utils/cacheKey';

interface ForecastResponse extends ForecastResult {
  symbol: string;
  name: string;
}

// Train + backtest + forecast for a single symbol. Uses ~5y of daily closes.
// Cached 12h since daily data only changes once per session.
export default defineCachedEventHandler(async (event): Promise<ForecastResponse> => {
  const query = getQuery(event);
  const symbol = normalizeSymbol(query.symbol as string);
  let horizon = parseInt((query.horizon as string) || '14', 10);
  if (!Number.isFinite(horizon)) horizon = 14;
  horizon = Math.max(5, Math.min(60, horizon));

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5y`;

  let data: any;
  try {
    data = await $fetch<any>(url, { headers: YAHOO_HEADERS });
  } catch (err) {
    console.error('Forecast fetch error:', err);
    throw createError({ statusCode: 502, statusMessage: `Gagal mengambil data harga untuk ${symbol}.` });
  }

  const r = data?.chart?.result?.[0];
  if (!r || !r.timestamp) {
    throw createError({ statusCode: 404, statusMessage: `Simbol ${symbol} tidak ditemukan.` });
  }

  const ts: number[] = r.timestamp || [];
  const closes: (number | null)[] = r.indicators?.quote?.[0]?.close || [];
  const adj: (number | null)[] = r.indicators?.adjclose?.[0]?.adjclose || [];

  const points: PricePoint[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = adj[i] ?? closes[i];
    if (c == null || c <= 0) continue;
    points.push({ date: new Date(ts[i]! * 1000).toISOString().split('T')[0]!, close: c });
  }

  const result = runForecast(points, horizon);
  if (!result) {
    throw createError({ statusCode: 422, statusMessage: `Data ${symbol} tidak cukup untuk forecasting (butuh >150 hari).` });
  }

  return {
    symbol,
    name: resolveDisplayName(symbol, r.meta?.longName || r.meta?.shortName),
    ...result
  };
}, {
  maxAge: 60 * 60 * 24, // 1 day (refreshed via the day-based key)
  swr: true,
  name: 'forecast',
  getKey: (event) => {
    const q = getQuery(event);
    return `${normalizeSymbol(q.symbol as string)}:${q.horizon || 14}:${tradingDay()}`;
  }
});
