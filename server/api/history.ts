import { getQuery, createError } from 'h3';
import { normalizeSymbol } from '../utils/symbol';
import { fetchDailyBars } from '../utils/yahoo';
import { loadStockHistory, backfillScoreTrend } from '../utils/history';
import { tradingDay } from '../utils/cacheKey';

// Per-stock history: the stored daily score/RS/QVM series (accumulates from the
// first sync) plus an on-demand backfilled technical-score trend so a chart is
// available immediately. Day-key cached.
export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event);
  const symbol = normalizeSymbol(query.symbol as string);
  const code = symbol.replace('.JK', '').replace('^JKSE', 'IHSG');

  const stored = await loadStockHistory(code);

  // 2y bars give a ~1y score trend after the 200-day MA warm-up.
  let trend: { date: string; score: number; close: number }[] = [];
  if (!symbol.startsWith('^')) {
    const fetched = await fetchDailyBars(symbol, '2y', false);
    if (fetched && fetched.bars.length > 210) trend = backfillScoreTrend(fetched.bars);
  }

  return { code, storedPoints: stored.length, stored, trend };
}, {
  maxAge: 60 * 60 * 24,
  swr: true,
  name: 'history',
  getKey: (event) => `${normalizeSymbol(getQuery(event).symbol as string)}:${tradingDay()}`,
});
