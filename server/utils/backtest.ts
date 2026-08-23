// Strategy backtest engine — cross-sectional, periodic-rebalanced, equal-weight.
//
// Honesty guarantees:
// - No look-ahead: the signal at rebalance date t is computed ONLY from bars up
//   to and including t (analyzeTechnical on a slice), and returns are realised
//   from t to the next rebalance.
// - Transaction costs modelled on turnover each rebalance.
// - Always benchmarked against IHSG buy & hold.
// Known limitation: uses today's liquid universe (survivorship bias) and
// current constituents — treat results as indicative, not a promise.

import type { DailyBar } from './yahoo';
import { analyzeTechnical, type Bar } from './technical';

export type SignalFn = (bars: Bar[]) => boolean;

/** 'monthly' = bar terakhir tiap bulan; 'weekly' = minggu-ISO; 'biweekly' = 2 mingguan. */
export type Cadence = 'monthly' | 'weekly' | 'biweekly';

export interface BacktestMetrics {
  totalReturnPct: number;
  cagrPct: number;
  winRatePct: number;
  maxDrawdownPct: number;
  sharpe: number;
  sortino: number;
  avgHoldings: number;
}

export interface BacktestResult {
  start: string;
  end: string;
  months: number; // jumlah periode rebalance (bulanan=bulan, mingguan=minggu)
  cadence: Cadence;
  equity: { date: string; strat: number; ihsg: number }[];
  metrics: BacktestMetrics;
  benchmark: { totalReturnPct: number; cagrPct: number; maxDrawdownPct: number; alphaCagrPct: number };
  costPerRebalancePct: number;
}

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const std = (v: number[]) => {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
};
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---- Rebalance point detection -------------------------------------------
function isoWeekKey(d: Date): string {
  // ISO-8601 week (year-Www) — deterministic across engines.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum); // Thursday of this ISO week
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function biweeklyKey(d: Date): string {
  const iso = isoWeekKey(d); // YYYY-Www
  const [y, wStr] = iso.split('-W');
  const w = parseInt(wStr!, 10);
  const half = Math.ceil(w / 2);
  return `${y}-B${String(half).padStart(2, '0')}`;
}

/** Indeks bar terakhir tiap periode pada deret kronologis. */
export function rebalanceIndices(bars: DailyBar[], cadence: Cadence = 'monthly'): number[] {
  const keyOf =
    cadence === 'weekly' ? (b: DailyBar) => isoWeekKey(new Date(b.date + 'T00:00:00Z'))
    : cadence === 'biweekly' ? (b: DailyBar) => biweeklyKey(new Date(b.date + 'T00:00:00Z'))
    : (b: DailyBar) => b.date.slice(0, 7); // YYYY-MM
  const out: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const cur = keyOf(bars[i]!);
    const next = bars[i + 1] ? keyOf(bars[i + 1]!) : null;
    if (next !== cur) out.push(i);
  }
  return out;
}

function maxDrawdown(equity: number[]): number {
  let peak = equity[0] ?? 1;
  let mdd = 0;
  for (const e of equity) {
    peak = Math.max(peak, e);
    mdd = Math.max(mdd, (peak - e) / peak);
  }
  return mdd;
}

// ---- Built-in signal functions ----
export function signalFor(strategy: string, threshold: number): SignalFn {
  if (strategy === 'ma200') {
    return (bars) => {
      if (bars.length < 200) return false;
      let s = 0;
      for (let i = bars.length - 200; i < bars.length; i++) s += bars[i]!.close;
      return bars[bars.length - 1]!.close > s / 200;
    };
  }
  if (strategy === 'golden') {
    return (bars) => {
      if (bars.length < 200) return false;
      const n = bars.length;
      let s50 = 0;
      let s200 = 0;
      for (let i = n - 50; i < n; i++) s50 += bars[i]!.close;
      for (let i = n - 200; i < n; i++) s200 += bars[i]!.close;
      return s50 / 50 > s200 / 200;
    };
  }
  // default: composite technical score >= threshold (reuses the live scoring)
  return (bars) => {
    const t = analyzeTechnical(bars);
    return t != null && t.score >= threshold;
  };
}

// ---- Signal families + precomputed matrix (for the 500-run Strategi Lab) ----
export type FamilyKey = 'score' | 'ma200' | 'golden' | 'score_ma200' | 'always' | 'lowvol';

export interface MatrixCell { ok: boolean; rank: number }
/** code -> rebalance-date -> cell. `rank` dipakai untuk top-K & ambang numerik. */
export type SignalMatrix = Map<string, Map<string, MatrixCell>>;

/**
 * Evaluasi satu keluarga sinyal pada potongan bars ≤ t.
 * `ok` = kondisi dasar TANPA ambang numerik (threshold diterapkan terpisah);
 * `rank` = metrik pemeringkat (skor / % di atas MA200 / spread MA).
 * Null berarti data tak memadai → saham tidak bisa dipilih pada tanggal itu.
 */
export function evaluateFamily(family: FamilyKey, bars: Bar[]): MatrixCell | null {
  if (family === 'always') return { ok: true, rank: 0 };
  if (family === 'ma200') {
    if (bars.length < 200) return null;
    const n = bars.length;
    let s = 0;
    for (let i = n - 200; i < n; i++) s += bars[i]!.close;
    const ma = s / 200;
    const price = bars[n - 1]!.close;
    return ma > 0 ? { ok: price > ma, rank: ((price / ma) - 1) * 100 } : null;
  }
  if (family === 'golden') {
    if (bars.length < 200) return null;
    const n = bars.length;
    let s50 = 0;
    let s200 = 0;
    for (let i = n - 50; i < n; i++) s50 += bars[i]!.close;
    for (let i = n - 200; i < n; i++) s200 += bars[i]!.close;
    const ma50 = s50 / 50;
    const ma200v = s200 / 200;
    return ma200v > 0 ? { ok: ma50 > ma200v, rank: ((ma50 / ma200v) - 1) * 100 } : null;
  }
  if (family === 'lowvol') {
    if (bars.length < 61) return null;
    const rets: number[] = [];
    for (let i = bars.length - 60; i < bars.length; i++) {
      const prev = bars[i - 1]!.close;
      if (prev > 0) rets.push(Math.log(bars[i]!.close / prev));
    }
    if (rets.length < 30) return null;
    const sigma = std(rets) * Math.sqrt(252) * 100; // vol tahunan %
    if (!isFinite(sigma) || sigma <= 0) return null;
    return { ok: true, rank: -sigma }; // makin tenang makin tinggi rank
  }
  // score & score_ma200
  const t = analyzeTechnical(bars);
  if (!t) return null;
  if (family === 'score_ma200') {
    const above = t.sma200 != null && t.price > t.sma200;
    return { ok: above, rank: t.score };
  }
  return { ok: true, rank: t.score };
}

export interface RunOptions {
  costPct?: number;
  cadence?: Cadence;
  /** Batasi jumlah nama dipilih per rebalance — top-K by `rank` desc. */
  maxNames?: number | null;
  /** Ambang numerik di atas `rank` (untuk matrix path). */
  minRank?: number | null;
  /** Matrix prakomputasi — mengesampingkan `signal` saat diberikan. */
  signals?: SignalMatrix;
}

export function runBacktest(
  barsBySymbol: Map<string, DailyBar[]>,
  ihsgBars: DailyBar[],
  signal: SignalFn,
  opts: RunOptions = {}
): BacktestResult | null {
  if (ihsgBars.length < 260) return null;
  const cost = opts.costPct ?? 0.15; // % of turnover per rebalance
  const cadence = opts.cadence ?? 'monthly';
  const maxNames = opts.maxNames ?? null;
  const minRank = opts.minRank ?? null;
  const matrix = opts.signals ?? null;

  const timeline = ihsgBars.map((b) => b.date);
  const ihsgClose = new Map(ihsgBars.map((b) => [b.date, b.close]));

  // Per-stock date -> index (for slicing without look-ahead) and date -> close
  const idxMaps = new Map<string, Map<string, number>>();
  for (const [sym, bars] of barsBySymbol) {
    idxMaps.set(sym, new Map(bars.map((b, i) => [b.date, i])));
  }

  // Rebalance points: period-ends where IHSG has >=200 prior bars (MA200 warm-up)
  const allEnds = rebalanceIndices(ihsgBars, cadence);
  const rebal = allEnds.filter((i) => i >= 200);
  if (rebal.length < 6) return null;

  let equity = 100;
  let ihsgEq = 100;
  const stratCurve: number[] = [100];
  const ihsgCurve: number[] = [100];
  const monthlyRets: number[] = [];
  const holdingsCount: number[] = [];
  let prev = new Set<string>();

  for (let k = 0; k < rebal.length - 1; k++) {
    const t = rebal[k]!;
    const tNext = rebal[k + 1]!;
    const dateT = timeline[t]!;
    const dateNext = timeline[tNext]!;

    const candidates: { sym: string; ret: number; rank: number }[] = [];
    for (const [sym, bars] of barsBySymbol) {
      const im = idxMaps.get(sym)!;
      const idx = im.get(dateT);
      const idxNext = im.get(dateNext);
      if (idx == null || idxNext == null || idx < 30) continue;
      let pass: boolean;
      let rank = 0;
      if (matrix) {
        const cell = matrix.get(sym)?.get(dateT);
        if (!cell || !cell.ok) continue;
        pass = true;
        rank = cell.rank;
        if (minRank != null && rank < minRank) continue;
      } else {
        pass = signal(bars.slice(0, idx + 1));
      }
      if (!pass) continue;
      candidates.push({ sym, ret: bars[idxNext]!.close / bars[idx]!.close - 1, rank });
    }

    // Top-K by rank (stable: ties keep insertion order)
    let chosen = candidates;
    if (maxNames != null && candidates.length > maxNames) {
      chosen = [...candidates].sort((a, b) => b.rank - a.rank).slice(0, maxNames);
    }

    const holdings = new Set(chosen.map((s) => s.sym));
    holdingsCount.push(holdings.size);

    // Equal-weight portfolio return (cash = 0% when nothing selected)
    let pr = chosen.length ? mean(chosen.map((s) => s.ret)) : 0;

    // Turnover cost: fraction of names that changed vs previous holdings
    const union = new Set([...prev, ...holdings]);
    let changed = 0;
    for (const s of union) if (prev.has(s) !== holdings.has(s)) changed++;
    const turnover = union.size ? changed / union.size : 0;
    pr -= (cost / 100) * turnover;
    prev = holdings;

    equity *= 1 + pr;
    const ic0 = ihsgClose.get(dateT)!;
    const ic1 = ihsgClose.get(dateNext)!;
    ihsgEq *= ic1 / ic0;

    monthlyRets.push(pr);
    stratCurve.push(equity);
    ihsgCurve.push(ihsgEq);
  }

  const periods = monthlyRets.length;
  const perYear = cadence === 'weekly' ? 52 : cadence === 'biweekly' ? 26 : 12;
  const annFactor = Math.sqrt(perYear);
  const years = periods / perYear;
  const totalReturn = equity / 100 - 1;
  const cagr = years > 0 ? Math.pow(equity / 100, 1 / years) - 1 : 0;
  const winRate = periods ? monthlyRets.filter((r) => r > 0).length / periods : 0;
  const mMean = mean(monthlyRets);
  const mStd = std(monthlyRets);
  const downside = std(monthlyRets.filter((r) => r < 0).map((r) => r));
  const sharpe = mStd > 0 ? (mMean / mStd) * annFactor : 0;
  const sortino = downside > 0 ? (mMean / downside) * annFactor : 0;

  const ihsgTotal = ihsgEq / 100 - 1;
  const ihsgCagr = years > 0 ? Math.pow(ihsgEq / 100, 1 / years) - 1 : 0;

  // equity curve points (align to rebalance dates)
  const curveDates = [timeline[rebal[0]!]!, ...rebal.slice(1).map((i) => timeline[i]!)];
  const equityPoints = curveDates.map((d, i) => ({
    date: d,
    strat: r2(stratCurve[i] ?? 100),
    ihsg: r2(ihsgCurve[i] ?? 100)
  }));

  return {
    start: curveDates[0]!,
    end: curveDates[curveDates.length - 1]!,
    months: periods,
    cadence,
    equity: equityPoints,
    metrics: {
      totalReturnPct: r2(totalReturn * 100),
      cagrPct: r2(cagr * 100),
      winRatePct: r2(winRate * 100),
      maxDrawdownPct: r2(maxDrawdown(stratCurve) * 100),
      sharpe: r2(sharpe),
      sortino: r2(sortino),
      avgHoldings: r2(mean(holdingsCount))
    },
    benchmark: {
      totalReturnPct: r2(ihsgTotal * 100),
      cagrPct: r2(ihsgCagr * 100),
      maxDrawdownPct: r2(maxDrawdown(ihsgCurve) * 100),
      alphaCagrPct: r2((cagr - ihsgCagr) * 100)
    },
    costPerRebalancePct: cost
  };
}
