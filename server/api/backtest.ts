import { getQuery, createError } from 'h3';
import { normalizeSymbol } from '../utils/symbol';
import { fetchDailyBars, type DailyBar } from '../utils/yahoo';
import { runBacktest, signalFor } from '../utils/backtest';
import { LAB_UNIVERSE } from '../utils/backtestLab';
import { tradingDay } from '../utils/cacheKey';

const BACKTEST_UNIVERSE = LAB_UNIVERSE;

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

const STRATEGIES = new Set(['score', 'ma200', 'golden']);

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event);
  const strategy = STRATEGIES.has(query.strategy as string) ? (query.strategy as string) : 'score';
  let threshold = parseInt((query.threshold as string) || '70', 10);
  if (!Number.isFinite(threshold)) threshold = 70;
  threshold = Math.max(40, Math.min(90, threshold));

  // Fetch 5y so MA200 is warm from the start of the backtest window
  const barsBySymbol = new Map<string, DailyBar[]>();
  await mapWithConcurrency(BACKTEST_UNIVERSE, 8, async (code) => {
    const f = await fetchDailyBars(normalizeSymbol(code), '5y', false);
    if (f && f.bars.length > 260) barsBySymbol.set(code, f.bars);
  });
  const ihsg = await fetchDailyBars('^JKSE', '5y', false);
  if (!ihsg || ihsg.bars.length < 260 || barsBySymbol.size < 5) {
    throw createError({ statusCode: 503, statusMessage: 'Data backtest belum cukup, coba lagi.' });
  }

  const signal = signalFor(strategy, threshold);
  const result = runBacktest(barsBySymbol, ihsg.bars, signal);
  if (!result) throw createError({ statusCode: 422, statusMessage: 'Backtest gagal dihitung.' });

  return { strategy, threshold, universeSize: barsBySymbol.size, ...result };
}, {
  maxAge: 60 * 60 * 24,
  swr: true,
  name: 'backtest',
  getKey: (event) => {
    const q = getQuery(event);
    return `${q.strategy || 'score'}:${q.threshold || 70}:${tradingDay()}`;
  }
});
