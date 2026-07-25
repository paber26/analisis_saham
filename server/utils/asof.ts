// As-Of Engine — point-in-time screening with NO lookahead.
//
// Core idea: analyzeTechnical() is a pure function over a chronological bar
// array. To reconstruct what a stock's screen looked like on a past date T, we
// fetch the long history once and slice it to bars with date <= T, then score
// that slice. The result is exactly what would have been visible back then.
//
// Fundamentals from Yahoo are only a *current* snapshot (not point-in-time), so
// they are deliberately omitted here — the technical score is the backbone of
// historical screening.

import { fetchDailyBars, type DailyBar } from './yahoo';
import { analyzeTechnical } from './technical';
import { rs3mOnly } from './relative';
import { normalizeSymbol, resolveDisplayName } from './symbol';
import { SCREENING_UNIVERSE } from './universe';
import { shortHash } from './cacheKey';

export interface AsOfRow {
  code: string;
  name: string;
  asOfDate: string;   // the last bar date <= T actually used
  price: number;      // close on asOfDate
  score: number;
  rating: 'Kuat' | 'Menarik' | 'Netral' | 'Lemah';
  rsi: number | null;
  rs3m: number | null;      // relative strength vs IHSG, 3-month (%)
  atrPct: number | null;    // volatility proxy
  volRatio: number | null;  // volume vs average
  pctFromHigh: number;      // distance from 52w high (%)
  changePct: number;        // last-bar % change
}

/** Slice a chronological bar array to those on/before date T (YYYY-MM-DD). */
export function sliceAsOf(bars: DailyBar[], dateT: string): DailyBar[] {
  return bars.filter((b) => b.date <= dateT);
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

// Pick a Yahoo range wide enough to contain date T plus ~1y of history before
// it (technical needs a long lookback). Yahoo ranges are relative to *now*.
function rangeForDate(dateT: string): '2y' | '5y' | '10y' {
  const yearsAgo = (Date.now() - new Date(dateT).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (yearsAgo <= 0.8) return '2y';
  if (yearsAgo <= 3.8) return '5y';
  return '10y';
}

/**
 * Screen the given universe (default SCREENING_UNIVERSE) as of date T.
 * Uncached core — endpoints wrap this with a per-day cache.
 */
export async function screenAsOf(dateT: string, codes: string[] = SCREENING_UNIVERSE): Promise<AsOfRow[]> {
  const range = rangeForDate(dateT);

  // IHSG baseline (sliced) for relative strength — fetched once.
  const ihsgFetched = await fetchDailyBars('^JKSE', range, false);
  const ihsgCloses = ihsgFetched ? sliceAsOf(ihsgFetched.bars, dateT).map((b) => b.close) : [];

  const rows = await mapWithConcurrency(codes, 10, async (code): Promise<AsOfRow | null> => {
    const symbol = normalizeSymbol(code);
    const fetched = await fetchDailyBars(symbol, range, false);
    if (!fetched) return null;
    const upto = sliceAsOf(fetched.bars, dateT);
    if (upto.length < 60) return null; // not enough history at that point in time

    const tech = analyzeTechnical(upto);
    if (!tech) return null;

    const closes = upto.map((b) => b.close);
    const rs3m = ihsgCloses.length ? rs3mOnly(closes, ihsgCloses) : null;

    return {
      code: code.replace('.JK', ''),
      name: resolveDisplayName(symbol, fetched.meta?.longName || fetched.meta?.shortName),
      asOfDate: upto[upto.length - 1]!.date,
      price: tech.price,
      score: tech.score,
      rating: tech.rating,
      rsi: tech.rsi,
      rs3m,
      atrPct: tech.atrPct,
      volRatio: tech.volRatio,
      pctFromHigh: tech.pctFromHigh,
      changePct: tech.changePct
    };
  });

  return rows
    .filter((r): r is AsOfRow => r !== null)
    .sort((a, b) => b.score - a.score);
}

/** Feature vector used by the regression engine (order matters — see labels). */
export const FEATURE_LABELS = ['score', 'rs3m', 'rsi', 'atrPct', 'volRatio', 'pctFromHigh'] as const;
export function featureVector(r: AsOfRow): number[] {
  return [r.score, r.rs3m ?? 0, r.rsi ?? 50, r.atrPct ?? 0, r.volRatio ?? 1, r.pctFromHigh];
}

/** Cache key for a day's as-of screen over a given code set. */
export function asOfKey(dateT: string, codes: string[]): string {
  return `${dateT}:${shortHash([...codes].sort().join(','))}`;
}

export interface RegressionObs {
  code: string;
  features: number[];      // aligned to FEATURE_LABELS
  score: number;
  rating: string;
  forwardReturnPct: number; // realized return over horizon (the "reveal")
}

/**
 * Build the regression learning dataset: as-of features on date T (no lookahead)
 * paired with the REALIZED forward return over `horizonDays` trading days after T.
 * This is the analytical payoff shown only AFTER the user's decisions — it uses
 * future data the user did not have while deciding.
 */
export async function regressionDataset(
  dateT: string,
  horizonDays: number,
  codes: string[] = SCREENING_UNIVERSE
): Promise<RegressionObs[]> {
  const range = rangeForDate(dateT);
  const ihsgFetched = await fetchDailyBars('^JKSE', range, false);
  const ihsgCloses = ihsgFetched ? sliceAsOf(ihsgFetched.bars, dateT).map((b) => b.close) : [];

  const obs = await mapWithConcurrency(codes, 10, async (code): Promise<RegressionObs | null> => {
    const symbol = normalizeSymbol(code);
    const fetched = await fetchDailyBars(symbol, range, false);
    if (!fetched) return null;
    const all = fetched.bars;
    const idxT = lastIndexAtOrBefore(all, dateT);
    if (idxT < 60) return null;                       // need history before T
    if (idxT + 1 >= all.length) return null;          // need at least 1 future bar

    const upto = all.slice(0, idxT + 1);
    const tech = analyzeTechnical(upto);
    if (!tech) return null;

    const closeT = all[idxT]!.close;
    const idxFuture = Math.min(idxT + horizonDays, all.length - 1);
    const closeFuture = all[idxFuture]!.close;
    if (!closeT || !closeFuture) return null;
    const forwardReturnPct = (closeFuture / closeT - 1) * 100;

    const closes = upto.map((b) => b.close);
    const rs3m = ihsgCloses.length ? rs3mOnly(closes, ihsgCloses) : null;
    const row: AsOfRow = {
      code: code.replace('.JK', ''), name: '', asOfDate: all[idxT]!.date, price: tech.price,
      score: tech.score, rating: tech.rating, rsi: tech.rsi, rs3m, atrPct: tech.atrPct,
      volRatio: tech.volRatio, pctFromHigh: tech.pctFromHigh, changePct: tech.changePct
    };

    return { code: row.code, features: featureVector(row), score: tech.score, rating: tech.rating, forwardReturnPct };
  });

  return obs.filter((o): o is RegressionObs => o !== null);
}

/** Index of the last bar with date <= dateT, or -1. Bars are chronological. */
function lastIndexAtOrBefore(bars: DailyBar[], dateT: string): number {
  let idx = -1;
  for (let i = 0; i < bars.length; i++) {
    if (bars[i]!.date <= dateT) idx = i;
    else break;
  }
  return idx;
}
