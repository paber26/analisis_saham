import { getQuery } from 'h3';
import { normalizeSymbol, YAHOO_HEADERS, getYahooAuth } from '../utils/symbol';
import { tradingDay } from '../utils/cacheKey';

interface FundamentalsResponse {
  symbol: string;
  available: boolean;      // false -> caller should fall back to static data
  currency?: string;
  eps: number | null;      // trailing EPS (IDR)
  bvps: number | null;     // book value per share (IDR)
  dps: number | null;      // annual dividend per share (IDR)
  per: number | null;      // trailing P/E
  pbv: number | null;      // price / book
  roe: number | null;      // return on equity (%)
  dividendYield: number | null; // (%)
  payout: number | null;   // payout ratio (%)
  marketCap: number | null;
  sharesOutstanding: number | null; // absolute share count
}

// Yahoo quoteSummary wraps every number as { raw, fmt }. Pull the raw value.
const raw = (v: any): number | null =>
  v && typeof v.raw === 'number' && isFinite(v.raw) ? v.raw : null;

const round2 = (n: number | null): number | null =>
  n == null ? null : Math.round(n * 100) / 100;

// Live fundamentals for ANY IDX ticker, sourced from Yahoo Finance.
// This scales to the whole exchange without hand-maintained data.
export default defineCachedEventHandler(async (event): Promise<FundamentalsResponse> => {
  const query = getQuery(event);
  const symbol = normalizeSymbol(query.symbol as string);

  const empty: FundamentalsResponse = {
    symbol, available: false,
    eps: null, bvps: null, dps: null, per: null, pbv: null,
    roe: null, dividendYield: null, payout: null, marketCap: null, sharesOutstanding: null
  };

  // Indices have no company fundamentals
  if (symbol.startsWith('^')) return empty;

  const auth = await getYahooAuth();
  const crumbParam = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : '';
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics,financialData,summaryDetail,price${crumbParam}`;

  const data = await $fetch<any>(url, {
    headers: auth ? { ...YAHOO_HEADERS, cookie: auth.cookie } : YAHOO_HEADERS
  }).catch((err) => {
    console.error('Yahoo Finance fundamentals fetch error:', err);
    return null;
  });

  const result = data?.quoteSummary?.result?.[0];
  if (!result) return empty;

  const stats = result.defaultKeyStatistics || {};
  const fin = result.financialData || {};
  const detail = result.summaryDetail || {};
  const price = result.price || {};

  const eps = raw(stats.trailingEps);
  const bvps = raw(stats.bookValue);
  const dps = raw(detail.dividendRate) ?? raw(detail.trailingAnnualDividendRate);
  const currentPrice = raw(price.regularMarketPrice);

  const per = raw(detail.trailingPE) ?? (eps && eps > 0 && currentPrice ? currentPrice / eps : null);
  const pbv = raw(stats.priceToBook) ?? (bvps && bvps > 0 && currentPrice ? currentPrice / bvps : null);
  const roeFrac = raw(fin.returnOnEquity);
  const yieldFrac = raw(detail.dividendYield) ?? raw(detail.trailingAnnualDividendYield);
  const payoutFrac = raw(detail.payoutRatio);

  const response: FundamentalsResponse = {
    symbol,
    available: eps !== null || per !== null || bvps !== null,
    currency: price.currency || 'IDR',
    eps: round2(eps),
    bvps: round2(bvps),
    dps: round2(dps),
    per: round2(per),
    pbv: round2(pbv),
    roe: round2(roeFrac == null ? null : roeFrac * 100),
    dividendYield: round2(yieldFrac == null ? null : yieldFrac * 100),
    payout: round2(payoutFrac == null ? null : payoutFrac * 100),
    marketCap: raw(price.marketCap),
    sharesOutstanding: raw(stats.sharesOutstanding)
  };

  return response;
}, {
  maxAge: 60 * 60 * 24, // 1 day (refreshed via the day-based key)
  swr: true,
  name: 'fundamentals',
  getKey: (event) => `${normalizeSymbol(getQuery(event).symbol as string)}:${tradingDay()}`
});
