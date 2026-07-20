import { getQuery, createError } from 'h3';
import { normalizeSymbol, resolveDisplayName } from '../utils/symbol';
import { fetchDailyBars } from '../utils/yahoo';
import { analyzeTechnical, type TechResult } from '../utils/technical';
import { computeLevels, type Levels } from '../utils/levels';
import { tradingDay } from '../utils/cacheKey';

interface AnalysisResponse {
  symbol: string;
  code: string;
  name: string;
  currency: string;
  technical: TechResult;
  levels: Levels | null;
}

// Full single-stock technical picture: indicator score + price levels + ATR
// trade plan. Backs the /analisa/[symbol] hub page.
export default defineCachedEventHandler(async (event): Promise<AnalysisResponse> => {
  const query = getQuery(event);
  const symbol = normalizeSymbol(query.symbol as string);

  const fetched = await fetchDailyBars(symbol, '1y', false);
  if (!fetched || fetched.bars.length === 0) {
    throw createError({ statusCode: 404, statusMessage: `Simbol ${symbol} tidak ditemukan.` });
  }

  const technical = analyzeTechnical(fetched.bars);
  if (!technical) {
    throw createError({
      statusCode: 422,
      statusMessage: `Data ${symbol} tidak cukup / tidak likuid untuk analisis teknikal.`
    });
  }

  return {
    symbol,
    code: symbol.replace('.JK', '').replace('^JKSE', 'IHSG'),
    name: resolveDisplayName(symbol, fetched.meta?.longName || fetched.meta?.shortName),
    currency: fetched.meta?.currency || 'IDR',
    technical,
    levels: computeLevels(fetched.bars)
  };
}, {
  maxAge: 60 * 60 * 24, // 1 day (day-keyed)
  swr: true,
  name: 'analysis',
  getKey: (event) => `${normalizeSymbol(getQuery(event).symbol as string)}:${tradingDay()}`
});
