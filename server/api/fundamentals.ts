import { getQuery } from 'h3';
import { normalizeSymbol } from '../utils/symbol';
import { fetchFundamentals, fetchPiotroski } from '../utils/fundamentals';
import { tradingDay } from '../utils/cacheKey';

// Live fundamentals for a single symbol (thin wrapper over the shared util),
// plus the Piotroski F-Score from annual statements.
export default defineCachedEventHandler(async (event) => {
  const symbol = getQuery(event).symbol as string;
  const f = await fetchFundamentals(symbol);
  const piotroski = await fetchPiotroski(symbol, f.sector === 'Financial Services').catch(() => null);
  return { ...f, piotroski };
}, {
  maxAge: 60 * 60 * 24, // 1 day (refreshed via the day-based key)
  swr: true,
  name: 'fundamentals-v2', // v2: F-Score with direct-method cash flow (drops cached 7-signal scores)
  getKey: (event) => `${normalizeSymbol(getQuery(event).symbol as string)}:${tradingDay()}`
});
