import { getQuery, createError } from 'h3';
import { normalizeSymbol, resolveDisplayName, YAHOO_HEADERS } from '../utils/symbol';
import { tradingDay } from '../utils/cacheKey';

interface StockHistoryItem {
  year: number;
  month: number;
  returnVal: number;
}

interface StockResponse {
  code: string;
  name: string;
  history: StockHistoryItem[];
}

// Cache monthly seasonal data for 6 hours (data only changes once a month).
// stale-while-revalidate keeps the app fast and resilient to Yahoo rate limits.
export default defineCachedEventHandler(async (event): Promise<StockResponse> => {
  const query = getQuery(event);
  const symbol = normalizeSymbol(query.symbol as string);

  // Fetch past 10 years of monthly historical chart data
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=10y`;

  try {
    const data: any = await $fetch<any>(url, { headers: YAHOO_HEADERS });

    if (!data.chart || !data.chart.result || !data.chart.result[0]) {
      throw createError({
        statusCode: 404,
        statusMessage: `Simbol ${symbol} tidak ditemukan di Yahoo Finance.`
      });
    }

    const result: any = data.chart.result[0];
    const timestamps: number[] = result.timestamp || [];
    const quote: any = result.indicators.quote[0] || {};
    // Prefer adjusted close so stock splits & dividends do not distort returns.
    const adjClose: (number | null)[] = result.indicators.adjclose?.[0]?.adjclose || [];
    const closes: (number | null)[] = quote.close || [];
    const returnedSymbol: string = result.meta.symbol || symbol;
    const fullName = resolveDisplayName(returnedSymbol, result.meta.longName || result.meta.shortName);

    const history: StockHistoryItem[] = [];

    // Month-over-month return: (close[m] - close[m-1]) / close[m-1].
    // This is the correct seasonal methodology; the previous open->close
    // (intra-month) calculation ignored the gap between consecutive months.
    let prevClose: number | null = null;
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const rawClose = adjClose[i] ?? closes[i];

      // Skip nulls/zeros (market holidays or incomplete data)
      if (!ts || rawClose === null || rawClose === undefined || rawClose <= 0) {
        continue;
      }

      const close = rawClose as number;
      if (prevClose !== null && prevClose > 0) {
        const date = new Date(ts * 1000);
        const returnVal = Math.round(((close - prevClose) / prevClose) * 100 * 100) / 100;
        history.push({
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          returnVal
        });
      }
      prevClose = close;
    }

    if (history.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: `Simbol ${symbol} ditemukan, tetapi tidak ada data harga bulanan yang valid.`
      });
    }

    return {
      code: returnedSymbol,
      name: fullName,
      history
    };
  } catch (error: any) {
    console.error('Yahoo Finance server fetch error:', error);

    // Pass along Nuxt H3 errors, otherwise create a new one
    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Koneksi ke Yahoo Finance gagal untuk simbol ${symbol}. Periksa ticker Anda.`
    });
  }
}, {
  maxAge: 60 * 60 * 24, // 1 day (refreshed via the day-based key)
  swr: true,
  name: 'seasonal',
  getKey: (event) => `${normalizeSymbol(getQuery(event).symbol as string)}:${tradingDay()}`
});
