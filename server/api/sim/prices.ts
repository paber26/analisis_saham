import { getQuery, defineEventHandler, createError } from 'h3';
import { fetchDailyBars } from '../../utils/yahoo';
import { normalizeSymbol } from '../../utils/symbol';
import { shortHash, tradingDay } from '../../utils/cacheKey';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface PriceBar { date: string; open: number; high: number; low: number; close: number; volume: number }
export interface PriceSeries { code: string; bars: PriceBar[] }
export interface PricesResponse { from: string; to: string; series: PriceSeries[]; ihsgSeries: PriceSeries }

// OHLC series per stock over [from, to] for the playback animation. The server
// legitimately holds the "future" here — the client only reveals it bar-by-bar
// as the user steps the simulation forward.
const cachedSeries = defineCachedFunction(
  async (code: string, from: string, to: string): Promise<PriceSeries> => {
    const symbol = normalizeSymbol(code);
    const yearsBack = (Date.now() - new Date(from).getTime()) / (365.25 * 24 * 3600 * 1000);
    const range = yearsBack <= 1.8 ? '2y' : yearsBack <= 4.8 ? '5y' : '10y';
    const fetched = await fetchDailyBars(symbol, range, false);
    const bars = (fetched?.bars || [])
      .filter((b) => b.date >= from && b.date <= to)
      .map((b) => ({ date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }));
    return { code: code.replace('.JK', ''), bars };
  },
  {
    maxAge: 60 * 60 * 24 * 7,
    swr: true,
    name: 'sim-prices',
    getKey: (code: string, from: string, to: string) => `${code}:${from}:${to}:${tradingDay()}`
  }
);

export default defineEventHandler(async (event): Promise<PricesResponse> => {
  const query = getQuery(event);
  const from = (query.from as string) || '';
  const to = (query.to as string) || '';
  const codesParam = (query.codes as string) || '';
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    throw createError({ statusCode: 400, statusMessage: 'from & to wajib format YYYY-MM-DD' });
  }
  const codes = codesParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 20);
  if (!codes.length) {
    throw createError({ statusCode: 400, statusMessage: 'codes wajib diisi' });
  }
  const [series, ihsgSeries] = await Promise.all([
    Promise.all(codes.map((c) => cachedSeries(c, from, to))),
    cachedSeries('^JKSE', from, to)
  ]);
  return { from, to, series, ihsgSeries };
});
