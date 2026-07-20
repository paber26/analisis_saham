import { getQuery, createError } from 'h3';
import { normalizeSymbol, resolveDisplayName } from '../utils/symbol';
import { fetchDailyBars } from '../utils/yahoo';
import { runForecast, type PricePoint, type ForecastResult } from '../utils/forecast';
import { tradingDay } from '../utils/cacheKey';

interface ForecastResponse extends ForecastResult {
  symbol: string;
  name: string;
}

// Train + walk-forward backtest + forward projection for one symbol.
// Uses ~5y of ADJUSTED daily closes (splits/dividends must not distort returns).
export default defineCachedEventHandler(async (event): Promise<ForecastResponse> => {
  const query = getQuery(event);
  const symbol = normalizeSymbol(query.symbol as string);
  let horizon = parseInt((query.horizon as string) || '14', 10);
  if (!Number.isFinite(horizon)) horizon = 14;
  horizon = Math.max(5, Math.min(60, horizon));

  const fetched = await fetchDailyBars(symbol, '5y', true);
  if (!fetched || fetched.bars.length === 0) {
    throw createError({ statusCode: 404, statusMessage: `Simbol ${symbol} tidak ditemukan.` });
  }

  const points: PricePoint[] = fetched.bars.map((b) => ({ date: b.date, close: b.close }));
  const result = runForecast(points, horizon);
  if (!result) {
    throw createError({ statusCode: 422, statusMessage: `Data ${symbol} tidak cukup untuk forecasting (butuh >150 hari).` });
  }

  return {
    symbol,
    name: resolveDisplayName(symbol, fetched.meta?.longName || fetched.meta?.shortName),
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
