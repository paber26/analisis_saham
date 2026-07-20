import { getQuery, defineEventHandler } from 'h3';
import { normalizeSymbol, resolveDisplayName } from '../utils/symbol';
import { fetchDailyBars } from '../utils/yahoo';
import { analyzeTechnical } from '../utils/technical';
import { SCREENING_UNIVERSE } from '../utils/universe';
import { loadScreenSnapshot, type ScreenRow } from '../utils/store';
import { tradingDay, shortHash } from '../utils/cacheKey';

interface ScreenResponse {
  source: 'snapshot' | 'live';
  date?: string;
  generatedAt?: string;
  count: number;
  results: ScreenRow[];
}

function parseSymbols(raw: string): string[] {
  const list = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const source = list.length ? list : SCREENING_UNIVERSE;
  return source.filter((s, i, arr) => arr.indexOf(s) === i).slice(0, 200);
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return results;
}

async function analyzeSymbol(code: string): Promise<ScreenRow | null> {
  const symbol = normalizeSymbol(code);
  const fetched = await fetchDailyBars(symbol, '1y', false);
  if (!fetched || fetched.bars.length === 0) return null;
  const tech = analyzeTechnical(fetched.bars);
  if (!tech) return null;
  return {
    code: code.replace('.JK', ''),
    symbol,
    name: resolveDisplayName(symbol, fetched.meta?.longName || fetched.meta?.shortName),
    per: null, pbv: null, roe: null, dividendYield: null, marketCap: null,
    ...tech
  };
}

// Live technical compute (cached per day per universe hash). Used as a fallback
// before the first snapshot exists, or for custom symbol subsets.
const computeLive = defineCachedFunction(async (codes: string[]): Promise<ScreenRow[]> => {
  const settled = await mapWithConcurrency(codes, 12, (c) => analyzeSymbol(c));
  return settled.filter((r): r is ScreenRow => r !== null).sort((a, b) => b.score - a.score);
}, {
  maxAge: 60 * 60 * 24,
  swr: true,
  name: 'screen-live',
  getKey: (codes: string[]) => `${shortHash([...codes].sort().join(','))}:${tradingDay()}`
});

// Screener: prefers the daily snapshot (full universe + fundamentals, instant),
// falls back to live technical compute when no snapshot or a custom list.
export default defineEventHandler(async (event): Promise<ScreenResponse> => {
  const query = getQuery(event);
  const symbolsParam = (query.symbols as string) || '';

  if (!symbolsParam) {
    const snap = await loadScreenSnapshot();
    if (snap && snap.rows.length) {
      return { source: 'snapshot', date: snap.date, generatedAt: snap.generatedAt, count: snap.count, results: snap.rows };
    }
  }

  const codes = parseSymbols(symbolsParam);
  const results = await computeLive(codes);
  return { source: 'live', count: results.length, results };
});
