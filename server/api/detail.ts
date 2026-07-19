import { getQuery, createError } from 'h3';
import { normalizeSymbol, resolveDisplayName, YAHOO_HEADERS } from '../utils/symbol';

interface DailyPriceItem {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changeVal: number;
  changePct: number;
}

interface StockDetailResponse {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  currency: string;
  exchange: string;
  currentPrice: number;
  previousClose: number;
  dayHigh: number;
  dayLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  volume: number;
  history: DailyPriceItem[];
}

// Cache daily price detail for 30 minutes: fresh enough for ratio display,
// while shielding Yahoo from repeated hits when users switch symbols.
export default defineCachedEventHandler(async (event): Promise<StockDetailResponse> => {
  const query = getQuery(event);
  const symbol = normalizeSymbol(query.symbol as string);

  // Fetch daily chart data (1 year)
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;

  // Fetch sector and industry search data
  const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}`;

  try {
    const [chartData, searchData]: [any, any] = await Promise.all([
      $fetch<any>(chartUrl, { headers: YAHOO_HEADERS }).catch((err) => {
        console.error('Yahoo Finance chart fetch error:', err);
        return null;
      }),
      $fetch<any>(searchUrl, { headers: YAHOO_HEADERS }).catch((err) => {
        console.error('Yahoo Finance search fetch error:', err);
        return null;
      })
    ]);

    if (!chartData || !chartData.chart || !chartData.chart.result || !chartData.chart.result[0]) {
      throw createError({
        statusCode: 404,
        statusMessage: `Simbol ${symbol} tidak ditemukan di Yahoo Finance.`
      });
    }

    const result = chartData.chart.result[0];
    const meta = result.meta;
    const timestamps: number[] = result.timestamp || [];
    const quoteObj = result.indicators.quote[0] || {};
    const opens: (number | null)[] = quoteObj.open || [];
    const highs: (number | null)[] = quoteObj.high || [];
    const lows: (number | null)[] = quoteObj.low || [];
    const closes: (number | null)[] = quoteObj.close || [];
    const volumes: (number | null)[] = quoteObj.volume || [];

    const returnedSymbol = meta.symbol || symbol;
    const fullName = resolveDisplayName(returnedSymbol, meta.longName || meta.shortName);

    // Extract sector and industry from search API results
    let sector = 'N/A';
    let industry = 'N/A';
    if (searchData && searchData.quotes && searchData.quotes.length > 0) {
      const match = searchData.quotes.find((q: any) => q.symbol === returnedSymbol);
      if (match) {
        sector = match.sector || 'N/A';
        industry = match.industry || 'N/A';
      }
    }

    // Parse daily historical records (chronological order first so we can
    // compute the daily change against the PREVIOUS close, not the same-day
    // open. Change vs previous close is the standard exchange convention.
    const history: DailyPriceItem[] = [];
    let prevClose: number | null = null;
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const open = opens[i];
      const high = highs[i];
      const low = lows[i];
      const close = closes[i];
      const vol = volumes[i];

      // We need OHLC to render a candle properly
      if (
        ts &&
        open !== null && open !== undefined &&
        high !== null && high !== undefined &&
        low !== null && low !== undefined &&
        close !== null && close !== undefined &&
        open > 0
      ) {
        const dateObj = new Date(ts * 1000);
        const formattedDate = dateObj.toISOString().split('T')[0] || '';

        // Change vs previous close (fallback to same-day open for the first bar)
        const baseline = prevClose !== null && prevClose > 0 ? prevClose : open;
        const changeVal = Math.round((close - baseline) * 100) / 100;
        const changePct = Math.round(((close - baseline) / baseline) * 100 * 100) / 100;

        history.push({
          date: formattedDate,
          timestamp: ts,
          open: Math.round(open * 100) / 100,
          high: Math.round(high * 100) / 100,
          low: Math.round(low * 100) / 100,
          close: Math.round(close * 100) / 100,
          volume: vol || 0,
          changeVal,
          changePct
        });

        prevClose = close;
      }
    }

    // Reverse history to have the latest dates first for tables
    const reversedHistory = [...history].reverse();

    // Map summary profile metrics
    const currentPrice = meta.regularMarketPrice || (history.length > 0 ? history[history.length - 1]!.close : 0);
    const previousClose = meta.chartPreviousClose || (history.length > 1 ? history[history.length - 2]!.close : currentPrice);
    const dayHigh = meta.regularMarketDayHigh || (history.length > 0 ? history[history.length - 1]!.high : currentPrice);
    const dayLow = meta.regularMarketDayLow || (history.length > 0 ? history[history.length - 1]!.low : currentPrice);
    const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh || currentPrice;
    const fiftyTwoWeekLow = meta.fiftyTwoWeekLow || currentPrice;
    const volume = meta.regularMarketVolume || (history.length > 0 ? history[history.length - 1]!.volume : 0);

    return {
      symbol: returnedSymbol,
      name: fullName,
      sector,
      industry,
      currency: meta.currency || 'IDR',
      exchange: meta.fullExchangeName || meta.exchangeName || 'IDX',
      currentPrice,
      previousClose,
      dayHigh,
      dayLow,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      volume,
      history: reversedHistory
    };

  } catch (error: any) {
    console.error('Yahoo Finance Detail fetch error:', error);
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: `Koneksi ke Yahoo Finance gagal untuk simbol ${symbol}. Periksa kembali ticker Anda.`
    });
  }
}, {
  maxAge: 60 * 30, // 30 minutes
  swr: true,
  name: 'detail',
  getKey: (event) => normalizeSymbol(getQuery(event).symbol as string)
});
