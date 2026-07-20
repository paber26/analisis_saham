// Live fundamentals for any IDX ticker, sourced from Yahoo quoteSummary
// (requires cookie + crumb auth). Extracted so both /api/fundamentals and the
// daily sync job can reuse it.

import { normalizeSymbol, YAHOO_HEADERS, getYahooAuth } from './symbol';

export interface FundamentalsData {
  symbol: string;
  available: boolean;
  currency?: string;
  sector: string | null;
  industry: string | null;
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
  // Deeper quality/valuation metrics (Tier 1c)
  revenueGrowth: number | null;  // % YoY
  earningsGrowth: number | null; // % YoY
  debtToEquity: number | null;   // ratio (0.5 = 50%)
  currentRatio: number | null;
  profitMargin: number | null;   // %
  pegRatio: number | null;
  grahamFair: number | null;     // sqrt(22.5 * eps * bvps)
}

const raw = (v: any): number | null =>
  v && typeof v.raw === 'number' && isFinite(v.raw) ? v.raw : null;
const round2 = (n: number | null): number | null =>
  n == null ? null : Math.round(n * 100) / 100;
const pct = (frac: number | null): number | null =>
  frac == null ? null : Math.round(frac * 100 * 100) / 100;

export function emptyFundamentals(symbol: string): FundamentalsData {
  return {
    symbol, available: false, sector: null, industry: null,
    eps: null, bvps: null, dps: null, per: null, pbv: null,
    roe: null, dividendYield: null, payout: null, marketCap: null, sharesOutstanding: null,
    revenueGrowth: null, earningsGrowth: null, debtToEquity: null,
    currentRatio: null, profitMargin: null, pegRatio: null, grahamFair: null
  };
}

export async function fetchFundamentals(rawSymbol: string): Promise<FundamentalsData> {
  const symbol = normalizeSymbol(rawSymbol);
  const empty = emptyFundamentals(symbol);
  if (symbol.startsWith('^')) return empty;

  const auth = await getYahooAuth();
  const crumbParam = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : '';
  const modules = 'defaultKeyStatistics,financialData,summaryDetail,price,assetProfile';
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}${crumbParam}`;

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
  const asset = result.assetProfile || {};

  const eps = raw(stats.trailingEps);
  const bvps = raw(stats.bookValue);
  const dps = raw(detail.dividendRate) ?? raw(detail.trailingAnnualDividendRate);
  const currentPrice = raw(price.regularMarketPrice);

  const perRaw = raw(detail.trailingPE) ?? (eps && eps > 0 && currentPrice ? currentPrice / eps : null);
  const pbvRaw = raw(stats.priceToBook) ?? (bvps && bvps > 0 && currentPrice ? currentPrice / bvps : null);
  // Sanity guard: Yahoo sometimes returns garbage (e.g. PBV 15000×) when
  // book value is near-zero or in the wrong unit. Drop implausible values.
  const per = perRaw != null && Math.abs(perRaw) < 1000 ? perRaw : null;
  const pbv = pbvRaw != null && pbvRaw > 0 && pbvRaw < 100 ? pbvRaw : null;

  const roeFrac = raw(fin.returnOnEquity);
  const yieldFrac = raw(detail.dividendYield) ?? raw(detail.trailingAnnualDividendYield);
  const payoutFrac = raw(detail.payoutRatio);
  const derRaw = raw(fin.debtToEquity); // Yahoo gives percentage-like (e.g. 45.2)
  const graham = eps && eps > 0 && bvps && bvps > 0 ? Math.sqrt(22.5 * eps * bvps) : null;

  return {
    symbol,
    available: eps !== null || per !== null || bvps !== null,
    currency: price.currency || 'IDR',
    sector: asset.sector || null,
    industry: asset.industry || null,
    eps: round2(eps),
    bvps: round2(bvps),
    dps: round2(dps),
    per: round2(per),
    pbv: round2(pbv),
    roe: round2(roeFrac == null ? null : roeFrac * 100),
    dividendYield: round2(yieldFrac == null ? null : yieldFrac * 100),
    payout: round2(payoutFrac == null ? null : payoutFrac * 100),
    marketCap: raw(price.marketCap),
    sharesOutstanding: raw(stats.sharesOutstanding),
    revenueGrowth: pct(raw(fin.revenueGrowth)),
    earningsGrowth: pct(raw(fin.earningsGrowth)),
    debtToEquity: derRaw == null ? null : round2(derRaw / 100),
    currentRatio: round2(raw(fin.currentRatio)),
    profitMargin: pct(raw(fin.profitMargins)),
    pegRatio: round2(raw(stats.pegRatio)),
    grahamFair: round2(graham)
  };
}
