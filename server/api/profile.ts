import { defineEventHandler, getQuery, createError } from 'h3';

type StockProfileResponse = {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  sector: string;
  industry: string;
  website?: string;
  phone?: string;
  address?: string;
  employees?: number;
  description?: string;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
};

export default defineEventHandler(async (event): Promise<StockProfileResponse> => {
  const query = getQuery(event);
  const rawSymbol = (query.symbol as string) || 'BBCA';

  let symbol = rawSymbol.toUpperCase().trim();
  if (symbol === 'IHSG') {
    symbol = '^JKSE';
  } else if (!symbol.endsWith('.JK') && !symbol.startsWith('^')) {
    symbol = `${symbol}.JK`;
  }

  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,price,summaryDetail`;

  const data = await $fetch<any>(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  }).catch((err) => {
    console.error('Yahoo Finance quoteSummary fetch error:', err);
    return null;
  });

  const result = data?.quoteSummary?.result?.[0];
  if (!result) {
    throw createError({
      statusCode: 404,
      statusMessage: `Profil untuk simbol ${symbol} tidak ditemukan.`
    });
  }

  const assetProfile = result.assetProfile || {};
  const price = result.price || {};
  const summaryDetail = result.summaryDetail || {};

  const returnedSymbol = price.symbol || symbol;
  let name = price.longName || price.shortName || returnedSymbol;
  if (returnedSymbol === '^JKSE') {
    name = 'Indeks Harga Saham Gabungan (IHSG)';
  } else if (returnedSymbol.endsWith('.JK') && name === returnedSymbol) {
    name = `PT ${returnedSymbol.replace('.JK', '')} Tbk`;
  }

  const addressParts = [
    assetProfile.address1,
    assetProfile.address2,
    assetProfile.city,
    assetProfile.state,
    assetProfile.zip,
    assetProfile.country
  ].filter(Boolean);

  return {
    symbol: returnedSymbol,
    name,
    exchange: price.exchangeName || price.fullExchangeName || 'N/A',
    currency: price.currency || 'N/A',
    sector: assetProfile.sector || 'N/A',
    industry: assetProfile.industry || 'N/A',
    website: assetProfile.website || undefined,
    phone: assetProfile.phone || undefined,
    address: addressParts.length ? addressParts.join(', ') : undefined,
    employees: typeof assetProfile.fullTimeEmployees === 'number' ? assetProfile.fullTimeEmployees : undefined,
    description: assetProfile.longBusinessSummary || undefined,
    marketCap: summaryDetail.marketCap?.raw,
    fiftyTwoWeekHigh: summaryDetail.fiftyTwoWeekHigh?.raw,
    fiftyTwoWeekLow: summaryDetail.fiftyTwoWeekLow?.raw
  };
});

