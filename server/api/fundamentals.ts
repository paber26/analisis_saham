import { getQuery } from 'h3';
import { normalizeSymbol } from '../utils/symbol';
import { fetchFundamentals } from '../utils/fundamentals';
import { tradingDay } from '../utils/cacheKey';

// Live fundamentals for a single symbol (thin wrapper over the shared util).
export default defineCachedEventHandler(async (event) => {
  return fetchFundamentals(getQuery(event).symbol as string);
}, {
  maxAge: 60 * 60 * 24, // 1 day (refreshed via the day-based key)
  swr: true,
  name: 'fundamentals',
  getKey: (event) => `${normalizeSymbol(getQuery(event).symbol as string)}:${tradingDay()}`
});
