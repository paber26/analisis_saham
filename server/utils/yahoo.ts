// Single entry point for fetching daily OHLCV bars from Yahoo Finance.
// Used by /api/screen, /api/analysis, and /api/forecast so the request
// building/parsing logic lives in exactly one place.

import { YAHOO_HEADERS } from './symbol';

export interface DailyBar {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Fetch daily bars for a Yahoo symbol.
 * @param useAdjusted replace close with adjusted close (splits/dividends) —
 *   use for return-based analytics (forecasting), not for price levels.
 */
export async function fetchDailyBars(
  symbol: string,
  range: '1y' | '2y' | '5y' | '10y' = '1y',
  useAdjusted = false
): Promise<{ bars: DailyBar[]; meta: any } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
  let data: any;
  try {
    data = await $fetch<any>(url, { headers: YAHOO_HEADERS });
  } catch (err) {
    console.error(`Yahoo daily fetch error for ${symbol}:`, err);
    return null;
  }

  const r = data?.chart?.result?.[0];
  if (!r || !r.timestamp) return null;

  const ts: number[] = r.timestamp || [];
  const q = r.indicators?.quote?.[0] || {};
  const opens: (number | null)[] = q.open || [];
  const highs: (number | null)[] = q.high || [];
  const lows: (number | null)[] = q.low || [];
  const closes: (number | null)[] = q.close || [];
  const vols: (number | null)[] = q.volume || [];
  const adj: (number | null)[] = r.indicators?.adjclose?.[0]?.adjclose || [];

  const bars: DailyBar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const cRaw = useAdjusted ? adj[i] ?? closes[i] : closes[i];
    if (o == null || h == null || l == null || cRaw == null || cRaw <= 0) continue;
    bars.push({
      date: new Date(ts[i]! * 1000).toISOString().split('T')[0]!,
      open: o,
      high: h,
      low: l,
      close: cRaw,
      volume: vols[i] || 0
    });
  }

  return { bars, meta: r.meta || {} };
}
