import { getQuery, createError } from 'h3';
import { normalizeSymbol, resolveDisplayName, YAHOO_HEADERS } from '../utils/symbol';

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

// Company profile rarely changes: cache for 24 hours.
export default defineCachedEventHandler(async (event): Promise<StockProfileResponse> => {
  const query = getQuery(event);
  const symbol = normalizeSymbol(query.symbol as string);

  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,price,summaryDetail`;

  const data = await $fetch<any>(url, { headers: YAHOO_HEADERS }).catch((err) => {
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
  const name = resolveDisplayName(returnedSymbol, price.longName || price.shortName);

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
}, {
  maxAge: 60 * 60 * 24, // 24 hours
  swr: true,
  name: 'profile',
  getKey: (event) => normalizeSymbol(getQuery(event).symbol as string)
});
