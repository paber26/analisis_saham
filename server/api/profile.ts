import { getQuery, createError } from 'h3';
import { normalizeSymbol, resolveDisplayName, YAHOO_HEADERS, getYahooAuth } from '../utils/symbol';
import { tradingDay } from '../utils/cacheKey';

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
  enterpriseValue?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyDayAverage?: number;
  twoHundredDayAverage?: number;
  peRatio?: number;
  forwardPE?: number;
  priceToBook?: number;
  roe?: number;
  roa?: number;
  profitMargins?: number;
  operatingMargins?: number;
  grossMargins?: number;
  revenueGrowth?: number;
  dividendYield?: number;
  beta?: number;
  totalCash?: number;
  totalDebt?: number;
  bookValue?: number;
  sharesOutstanding?: number;
  sectorsUrl: string;
};

// Company profile rarely changes: cache for 24 hours.
export default defineCachedEventHandler(async (event): Promise<StockProfileResponse> => {
  const query = getQuery(event);
  const symbol = normalizeSymbol(query.symbol as string);

  const auth = await getYahooAuth();
  const crumbParam = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : '';
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,price,summaryDetail,financialData,defaultKeyStatistics${crumbParam}`;

  const data = await $fetch<any>(url, {
    headers: auth ? { ...YAHOO_HEADERS, cookie: auth.cookie } : YAHOO_HEADERS
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
  const financialData = result.financialData || {};
  const defaultKeyStatistics = result.defaultKeyStatistics || {};

  const returnedSymbol = price.symbol || symbol;
  const cleanCode = returnedSymbol.replace('.JK', '').toUpperCase();
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
    exchange: price.exchangeName || price.fullExchangeName || 'IDX',
    currency: price.currency || 'IDR',
    sector: assetProfile.sector || 'N/A',
    industry: assetProfile.industry || 'N/A',
    website: assetProfile.website || undefined,
    phone: assetProfile.phone || undefined,
    address: addressParts.length ? addressParts.join(', ') : undefined,
    employees: typeof assetProfile.fullTimeEmployees === 'number' ? assetProfile.fullTimeEmployees : undefined,
    description: assetProfile.longBusinessSummary || undefined,
    marketCap: summaryDetail.marketCap?.raw,
    enterpriseValue: defaultKeyStatistics.enterpriseValue?.raw,
    fiftyTwoWeekHigh: summaryDetail.fiftyTwoWeekHigh?.raw,
    fiftyTwoWeekLow: summaryDetail.fiftyTwoWeekLow?.raw,
    fiftyDayAverage: summaryDetail.fiftyDayAverage?.raw,
    twoHundredDayAverage: summaryDetail.twoHundredDayAverage?.raw,
    peRatio: summaryDetail.trailingPE?.raw ?? defaultKeyStatistics.trailingPE?.raw,
    forwardPE: summaryDetail.forwardPE?.raw ?? defaultKeyStatistics.forwardPE?.raw,
    priceToBook: defaultKeyStatistics.priceToBook?.raw,
    roe: financialData.returnOnEquity?.raw,
    roa: financialData.returnOnAssets?.raw,
    profitMargins: financialData.profitMargins?.raw,
    operatingMargins: financialData.operatingMargins?.raw,
    grossMargins: financialData.grossMargins?.raw,
    revenueGrowth: financialData.revenueGrowth?.raw,
    dividendYield: summaryDetail.dividendYield?.raw ?? summaryDetail.trailingAnnualDividendYield?.raw,
    beta: summaryDetail.beta?.raw ?? defaultKeyStatistics.beta?.raw,
    totalCash: financialData.totalCash?.raw,
    totalDebt: financialData.totalDebt?.raw,
    bookValue: defaultKeyStatistics.bookValue?.raw,
    sharesOutstanding: defaultKeyStatistics.sharesOutstanding?.raw,
    sectorsUrl: `https://sectors.app/idx/${cleanCode}`
  };
}, {
  maxAge: 60 * 60 * 24, // 24 hours
  swr: true,
  name: 'profile',
  getKey: (event) => `${normalizeSymbol(getQuery(event).symbol as string)}:${tradingDay()}`
});
