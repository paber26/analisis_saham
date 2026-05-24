import { defineEventHandler, getQuery, createError } from 'h3';

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

export default defineEventHandler(async (event): Promise<StockDetailResponse> => {
  const query = getQuery(event);
  const rawSymbol = (query.symbol as string) || 'BBCA';

  // Format symbol (same as seasonal API)
  let symbol = rawSymbol.toUpperCase().trim();
  if (symbol === 'IHSG') {
    symbol = '^JKSE';
  } else if (!symbol.endsWith('.JK') && !symbol.startsWith('^')) {
    symbol = `${symbol}.JK`;
  }

  // Fetch daily chart data (3 months)
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`;
  
  // Fetch sector and industry search data
  const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}`;

  try {
    const [chartData, searchData]: [any, any] = await Promise.all([
      $fetch<any>(chartUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }).catch(err => {
        console.error('Yahoo Finance chart fetch error:', err);
        return null;
      }),
      $fetch<any>(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }).catch(err => {
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
    let fullName = meta.longName || meta.shortName || returnedSymbol;
    if (returnedSymbol === '^JKSE') {
      fullName = 'Indeks Harga Saham Gabungan (IHSG)';
    } else if (returnedSymbol.endsWith('.JK') && fullName === returnedSymbol) {
      fullName = `PT ${returnedSymbol.replace('.JK', '')} Tbk`;
    }

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

    // Parse daily historical records
    const history: DailyPriceItem[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const open = opens[i];
      const high = highs[i];
      const low = lows[i];
      const close = closes[i];
      const vol = volumes[i];

      // We need at least close and open to compute changes and render properly
      if (
        ts && 
        open !== null && open !== undefined &&
        high !== null && high !== undefined &&
        low !== null && low !== undefined &&
        close !== null && close !== undefined &&
        open > 0
      ) {
        const dateObj = new Date(ts * 1000);
        // Format as YYYY-MM-DD
        const formattedDate = dateObj.toISOString().split('T')[0] || '';
        
        // Price change metrics vs. open of the day
        const changeVal = Math.round((close - open) * 100) / 100;
        const changePct = Math.round(((close - open) / open) * 100 * 100) / 100;

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
});
