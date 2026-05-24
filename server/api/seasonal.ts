import { defineEventHandler, getQuery, createError } from 'h3';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const rawSymbol = (query.symbol as string) || 'BBCA';
  
  // Format the symbol:
  // - 'IHSG' mapped to '^JKSE' (Jakarta Composite Index)
  // - 4 letter alpha symbols (like 'BBCA') mapped to 'BBCA.JK' (Indonesian Stock)
  // - Otherwise, keep it as-is (enables US stock queries like 'AAPL', 'MSFT', etc.)
  let symbol = rawSymbol.toUpperCase().trim();
  if (symbol === 'IHSG') {
    symbol = '^JKSE';
  } else if (/^[A-Z]{4}$/.test(symbol)) {
    symbol = `${symbol}.JK`;
  }

  // Fetch past 10 years of monthly historical chart data
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&range=10y`;

  try {
    const data = await $fetch<any>(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!data.chart || !data.chart.result || !data.chart.result[0]) {
      throw createError({
        statusCode: 404,
        statusMessage: `Simbol ${symbol} tidak ditemukan di Yahoo Finance.`
      });
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const quote = result.indicators.quote[0] || {};
    const opens = quote.open || [];
    const closes = quote.close || [];
    const returnedSymbol = result.meta.symbol || symbol;

    // Resolve full name if possible, or use standard labels
    let fullName = returnedSymbol;
    if (returnedSymbol === '^JKSE') {
      fullName = 'Indeks Harga Saham Gabungan (IHSG)';
    } else if (returnedSymbol.endsWith('.JK')) {
      fullName = `PT ${returnedSymbol.replace('.JK', '')} Tbk`;
    }

    const history: { year: number; month: number; returnVal: number }[] = [];

    // Parse price points into month-by-month returns
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const open = opens[i];
      const close = closes[i];

      // Skip nulls or zero values (market holidays or incomplete data)
      if (
        ts && 
        open !== null && 
        open !== undefined && 
        close !== null && 
        close !== undefined && 
        open > 0
      ) {
        const date = new Date(ts * 1000);
        // Calculate return percentage: ((close - open) / open) * 100
        const returnVal = Math.round(((close - open) / open) * 100 * 100) / 100;
        
        history.push({
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          returnVal
        });
      }
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
});
