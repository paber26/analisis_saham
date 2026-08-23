// Historical daily-history backfill — seeds `.data-store/history` (or the
// Postgres `daily_history` table) with past screener rows recomputed from
// Yahoo OHLCV bars, so score/QVM trend pages and strategy backtests have data
// immediately instead of waiting months of cron accumulation.
//
// Honesty rules (same discipline as backtest.ts):
// - NO look-ahead: the row for date t is computed ONLY from bars ≤ t.
// - MERGE, never overwrite: dates already present in daily_history are skipped
//   (appendDailyHistory upserts, so filtering must happen BEFORE the write).
// - Fundamentals are NOT available historically from Yahoo → backfilled rows
//   carry per/pbv/roe = null and QVM degrades honestly to its momentum-only
//   part (RS vs IHSG + technical score).

import { fetchDailyBars } from './yahoo';
import type { DailyBar } from './yahoo';
import { analyzeTechnical } from './technical';
import { rs3mOnly } from './relative';
import { computeFactors } from './factor';
import type { ScreenRow } from './store';
import { normalizeSymbol } from './symbol';
import { appendDailyHistory, listHistoryDates, type HistoryRow } from './history';

/** Bars needed before indicators (MA200 etc.) are meaningful. */
const WARMUP = 210;
/** Weekly sampling keeps CPU ~50 analyzeTechnical calls per ticker. */
const DEFAULT_STEP = 5;

interface PartialRow {
  code: string;
  close: number;
  score: number;
  rating: string;
  rs3m: number | null;
}

export interface BackfillDay { date: string; rows: HistoryRow[] }

export interface BackfillBuildResult {
  /** Ascending by date, existing dates already filtered out. */
  days: BackfillDay[];
  skippedDates: number;
}

/**
 * Pure cross-sectional builder: recompute screener rows at weekly steps from
 * historical bars, group by trading date, drop dates that already exist.
 */
export function buildBackfillRows(
  barsByTicker: Map<string, DailyBar[]>,
  ihsgBars: DailyBar[],
  existingDates: Set<string>,
  opts: { stepDays?: number } = {}
): BackfillBuildResult {
  const step = opts.stepDays ?? DEFAULT_STEP;

  // IHSG closes keyed by DATE STRING — each ticker has its own calendar
  // (suspensions), so positional alignment would silently misalign series.
  const ihsgByDate = new Map(ihsgBars.map((b) => [b.date, b.close]));

  const byDate = new Map<string, PartialRow[]>();

  for (const [code, bars] of barsByTicker) {
    if (bars.length < WARMUP + 1) continue;
    for (let i = WARMUP; i < bars.length; i += step) {
      const slice = bars.slice(0, i + 1); // strictly ≤ t — no look-ahead
      const t = analyzeTechnical(slice);
      if (!t) continue;

      const stockCloses: number[] = [];
      const ihsgCloses: number[] = [];
      for (const b of slice) {
        const ic = ihsgByDate.get(b.date);
        if (ic !== undefined) {
          stockCloses.push(b.close);
          ihsgCloses.push(ic);
        }
      }
      const rs3m = ihsgCloses.length ? rs3mOnly(stockCloses, ihsgCloses) : null;

      const date = bars[i]!.date;
      const list = byDate.get(date) ?? [];
      list.push({ code, close: t.price, score: t.score, rating: t.rating, rs3m });
      byDate.set(date, list);
    }
  }

  const days: BackfillDay[] = [];
  let skippedDates = 0;
  const dates = [...byDate.keys()].sort();
  for (const date of dates) {
    if (existingDates.has(date)) {
      skippedDates++;
      continue;
    }
    const parts = byDate.get(date)!;
    // Momentum-only QVM: fundamentals null → Value/Quality factors are null,
    // QVM becomes the mean of available sub-scores (momentum here).
    const scored = computeFactors(parts.map((p) => ({
      code: p.code,
      symbol: p.code + '.JK',
      name: p.code,
      sector: null,
      rs3m: p.rs3m,
      per: null,
      pbv: null,
      roe: null,
      dividendYield: null,
      marketCap: null,
      revenueGrowth: null,
      earningsGrowth: null,
      debtToEquity: null,
      score: p.score,
      rating: p.rating
    })) as unknown as ScreenRow[]);
    const byCode = new Map(scored.map((r) => [r.code, r]));
    days.push({
      date,
      rows: parts.map((p): HistoryRow => ({
        code: p.code,
        close: p.close,
        score: p.score,
        rating: p.rating,
        per: null,
        pbv: null,
        roe: null,
        rs3m: p.rs3m,
        qvm: byCode.get(p.code)?.qvm ?? null
      }))
    });
  }
  return { days, skippedDates };
}

export interface BackfillResult {
  attempted: number;
  okTickers: number;
  filledDates: number;
  skippedDates: number;
  firstDate: string | null;
  lastDate: string | null;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Fetch 2y bars for every ticker (day-cached → resumable), rebuild historical
 * screener rows, and write only the missing dates. Never throws on individual
 * ticker failures — they're counted in `attempted - okTickers`.
 */
export async function backfillDailyHistory(
  tickers: string[],
  opts: { concurrency?: number } = {}
): Promise<BackfillResult> {
  const concurrency = opts.concurrency ?? 6;

  // Dates already stored (file store or Postgres) must NOT be overwritten.
  const existing = new Set(await listHistoryDates());

  const ihsg = await fetchDailyBars('^JKSE', '2y');
  if (!ihsg || ihsg.bars.length < 130) {
    throw new Error('IHSG 2y bars unavailable — cannot compute relative strength.');
  }

  const fetched = await mapWithConcurrency(tickers, concurrency, async (raw) => {
    try {
      const symbol = normalizeSymbol(raw);
      const f = await fetchDailyBars(symbol, '2y');
      if (!f || f.bars.length === 0) return null;
      const code = raw.replace('.JK', '');
      return [code, f.bars] as const;
    } catch {
      return null;
    }
  });

  const barsByTicker = new Map(fetched.filter((x): x is readonly [string, DailyBar[]] => x !== null));
  const built = buildBackfillRows(barsByTicker, ihsg.bars, existing);

  for (const day of built.days) {
    await appendDailyHistory(day.date, day.rows);
  }

  return {
    attempted: tickers.length,
    okTickers: barsByTicker.size,
    filledDates: built.days.length,
    skippedDates: built.skippedDates,
    firstDate: built.days[0]?.date ?? null,
    lastDate: built.days[built.days.length - 1]?.date ?? null
  };
}
