// Live fundamentals for any IDX ticker, sourced from Yahoo quoteSummary
// (requires cookie + crumb auth). Extracted so both /api/fundamentals and the
// daily sync job can reuse it.

import { normalizeSymbol, YAHOO_HEADERS, getYahooAuth } from './symbol';

export interface FundamentalsData {
  symbol: string;
  available: boolean;
  currency?: string;
  eps: number | null;
  bvps: number | null;
  dps: number | null;
  per: number | null;
  pbv: number | null;
  roe: number | null;            // %
  dividendYield: number | null;  // %
  payout: number | null;         // %
  marketCap: number | null;
  sharesOutstanding: number | null;
}

const raw = (v: any): number | null =>
  v && typeof v.raw === 'number' && isFinite(v.raw) ? v.raw : null;
const round2 = (n: number | null): number | null =>
  n == null ? null : Math.round(n * 100) / 100;

export function emptyFundamentals(symbol: string): FundamentalsData {
  return {
    symbol, available: false,
    eps: null, bvps: null, dps: null, per: null, pbv: null,
    roe: null, dividendYield: null, payout: null, marketCap: null, sharesOutstanding: null
  };
}

export async function fetchFundamentals(rawSymbol: string): Promise<FundamentalsData> {
  const symbol = normalizeSymbol(rawSymbol);
  const empty = emptyFundamentals(symbol);
  if (symbol.startsWith('^')) return empty;

  const auth = await getYahooAuth();
  const crumbParam = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : '';
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics,financialData,summaryDetail,price${crumbParam}`;

  const data = await $fetch<any>(url, {
    headers: auth ? { ...YAHOO_HEADERS, cookie: auth.cookie } : YAHOO_HEADERS
  }).catch((err) => {
    console.error('Yahoo fundamentals fetch error:', err);
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

  return {
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
}
