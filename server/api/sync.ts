import { getQuery, createError } from 'h3';
import { normalizeSymbol, resolveDisplayName } from '../utils/symbol';
import { fetchDailyBars } from '../utils/yahoo';
import { analyzeTechnical } from '../utils/technical';
import { fetchFundamentals } from '../utils/fundamentals';
import { rs3mOnly } from '../utils/relative';
import { IDX_TICKERS } from '../utils/idxTickers';
import { saveScreenSnapshot, type ScreenRow, type ScreenSnapshot } from '../utils/store';
import { computeFactors } from '../utils/factor';
import { appendDailyHistory, type HistoryRow } from '../utils/history';
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

async function buildRow(code: string, ihsgCloses: number[]): Promise<ScreenRow | null> {
  const symbol = normalizeSymbol(code);
  const fetched = await fetchDailyBars(symbol, '1y', false);
  if (!fetched || fetched.bars.length === 0) return null;

  const tech = analyzeTechnical(fetched.bars);
  if (!tech) return null;

  const closes = fetched.bars.map((b) => b.close);
  const rs3m = ihsgCloses.length ? rs3mOnly(closes, ihsgCloses) : null;

  // Fundamentals are best-effort — a failure just leaves nulls.
  let sector: string | null = null;
  let per: number | null = null;
  let pbv: number | null = null;
  let roe: number | null = null;
  let dividendYield: number | null = null;
  let marketCap: number | null = null;
  let revenueGrowth: number | null = null;
  let earningsGrowth: number | null = null;
  let debtToEquity: number | null = null;
  try {
    const f = await fetchFundamentals(symbol);
    sector = f.sector;
    if (f.available) {
      per = f.per; pbv = f.pbv; roe = f.roe; dividendYield = f.dividendYield; marketCap = f.marketCap;
      revenueGrowth = f.revenueGrowth; earningsGrowth = f.earningsGrowth; debtToEquity = f.debtToEquity;
    }
  } catch { /* ignore */ }

  return {
    code: code.replace('.JK', ''),
    symbol,
    name: resolveDisplayName(symbol, fetched.meta?.longName || fetched.meta?.shortName),
    sector, rs3m,
    per, pbv, roe, dividendYield, marketCap,
    revenueGrowth, earningsGrowth, debtToEquity,
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

  // IHSG baseline (once) for relative strength
  const ihsg = await fetchDailyBars('^JKSE', '1y', false);
  const ihsgCloses = ihsg?.bars.map((b) => b.close) || [];

  const settled = await mapWithConcurrency(tickers, 6, (c) => buildRow(c, ihsgCloses).catch(() => null));
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

  // Append a compact daily history record (score/RS/QVM/fundamentals) — the
  // foundation for trends & honest screener backtests over time.
  try {
    const scored = computeFactors(rows);
    const histRows: HistoryRow[] = scored.map((r) => ({
      code: r.code,
      close: r.price,
      score: r.score,
      rating: r.rating,
      per: r.per,
      pbv: r.pbv,
      roe: r.roe,
      rs3m: r.rs3m,
      qvm: r.qvm,
    }));
    await appendDailyHistory(snapshot.date, histRows);
  } catch { /* history is best-effort; never fail the sync over it */ }

  return { ok: true, date: snapshot.date, attempted: snapshot.attempted, count: snapshot.count, ms: Date.now() - t0 };
});
