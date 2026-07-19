import { getQuery } from 'h3';
import { normalizeSymbol, resolveDisplayName, YAHOO_HEADERS } from '../utils/symbol';
import { analyzeTechnical, type Bar, type TechResult } from '../utils/technical';

export interface ScreenRow extends TechResult {
  code: string;
  symbol: string;
  name: string;
}

function parseSymbols(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .slice(0, 80); // safety cap
}

async function analyzeSymbol(code: string): Promise<ScreenRow | null> {
  const symbol = normalizeSymbol(code);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
  try {
    const data: any = await $fetch<any>(url, { headers: YAHOO_HEADERS });
    const r = data?.chart?.result?.[0];
    if (!r) return null;
    const ts: number[] = r.timestamp || [];
    const q = r.indicators?.quote?.[0] || {};
    const opens = q.open || [];
    const highs = q.high || [];
    const lows = q.low || [];
    const closes = q.close || [];
    const vols = q.volume || [];

    const bars: Bar[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      const h = highs[i];
      const l = lows[i];
      const o = opens[i];
      if (c == null || h == null || l == null || o == null || c <= 0) continue;
      bars.push({ close: c, high: h, low: l, volume: vols[i] || 0 });
    }

    const tech = analyzeTechnical(bars);
    if (!tech) return null;

    return {
      code: code.replace('.JK', ''),
      symbol,
      name: resolveDisplayName(symbol, r.meta?.longName || r.meta?.shortName),
      ...tech
    };
  } catch (err) {
    console.error(`Screen fetch error for ${symbol}:`, err);
    return null;
  }
}

// Technical screener: scores each requested symbol and returns them ranked.
// The frontend passes its universe via ?symbols=BBCA,BBRI,... so the stock list
// lives in a single place (app/data/stockList.ts).
export default defineCachedEventHandler(async (event): Promise<{ results: ScreenRow[]; count: number }> => {
  const query = getQuery(event);
  const codes = parseSymbols((query.symbols as string) || '');
  if (codes.length === 0) return { results: [], count: 0 };

  const settled = await Promise.all(codes.map((c) => analyzeSymbol(c)));
  const results = settled
    .filter((r): r is ScreenRow => r !== null)
    .sort((a, b) => b.score - a.score);

  return { results, count: results.length };
}, {
  maxAge: 60 * 30, // 30 minutes
  swr: true,
  name: 'screen',
  getKey: (event) =>
    parseSymbols((getQuery(event).symbols as string) || '').sort().join(',')
});
