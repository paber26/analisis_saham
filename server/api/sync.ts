import { getQuery, createError } from 'h3';
import { normalizeSymbol, resolveDisplayName } from '../utils/symbol';
import { fetchDailyBars } from '../utils/yahoo';
import { analyzeTechnical } from '../utils/technical';
import { fetchFundamentals } from '../utils/fundamentals';
import { IDX_TICKERS } from '../utils/idxTickers';
import { saveScreenSnapshot, type ScreenRow, type ScreenSnapshot } from '../utils/store';
import { tradingDay } from '../utils/cacheKey';

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

async function buildRow(code: string): Promise<ScreenRow | null> {
  const symbol = normalizeSymbol(code);
  const fetched = await fetchDailyBars(symbol, '1y', false);
  if (!fetched || fetched.bars.length === 0) return null;

  const tech = analyzeTechnical(fetched.bars);
  if (!tech) return null;

  // Fundamentals are best-effort — a failure just leaves nulls.
  let per: number | null = null;
  let pbv: number | null = null;
  let roe: number | null = null;
  let dividendYield: number | null = null;
  let marketCap: number | null = null;
  try {
    const f = await fetchFundamentals(symbol);
    if (f.available) {
      per = f.per; pbv = f.pbv; roe = f.roe; dividendYield = f.dividendYield; marketCap = f.marketCap;
    }
  } catch { /* ignore */ }

  return {
    code: code.replace('.JK', ''),
    symbol,
    name: resolveDisplayName(symbol, fetched.meta?.longName || fetched.meta?.shortName),
    per, pbv, roe, dividendYield, marketCap,
    ...tech
  };
}

// Daily sync: fetch + analyze the whole IDX ticker list and persist a snapshot.
// Triggered by cron (curl with ?token=). Long-running; not cached.
export default defineEventHandler(async (event): Promise<{ ok: boolean; date: string; attempted: number; count: number; ms: number }> => {
  const query = getQuery(event);
  const token = process.env.SYNC_TOKEN || 'saham-sync';
  if ((query.token as string) !== token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const t0 = Date.now();
  const limit = parseInt((query.limit as string) || '0', 10);
  const tickers = limit > 0 ? IDX_TICKERS.slice(0, limit) : IDX_TICKERS;
  const settled = await mapWithConcurrency(tickers, 6, (c) => buildRow(c).catch(() => null));
  const rows = settled
    .filter((r): r is ScreenRow => r !== null)
    .sort((a, b) => b.score - a.score);

  const snapshot: ScreenSnapshot = {
    date: tradingDay(),
    generatedAt: new Date().toISOString(),
    count: rows.length,
    attempted: tickers.length,
    rows
  };
  await saveScreenSnapshot(snapshot);

  return { ok: true, date: snapshot.date, attempted: snapshot.attempted, count: snapshot.count, ms: Date.now() - t0 };
});
