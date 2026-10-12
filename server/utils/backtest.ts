// Strategy backtest engine — cross-sectional, periodic-rebalanced, equal-weight.
//
// Honesty guarantees:
// - No look-ahead: the signal at rebalance date t is computed ONLY from bars up
//   to and including t (analyzeTechnical on a slice), and returns are realised
//   from t to the next rebalance.
// - Executable trades: next-open fills, IDX fees + tick spread on every trade,
//   and auto-reject limits (no buy at an ARA open, no sell while locked at ARB).
// - Always benchmarked against IHSG buy & hold.
// Known limitation: uses today's liquid universe (survivorship bias) and
// current constituents — treat results as indicative, not a promise.

import type { DailyBar } from './yahoo';
import { analyzeTechnical, type Bar } from './technical';
import { halfSpread, buyBlocked, sellBlocked } from '../../shared/utils/idxMarket';

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
  execution: ExecutionModel;
  trading: {
    buys: number;
    sells: number;
    /** Fees + spread paid, % of average equity per year. */
    costPctPerYear: number;
    /** One-way turnover, % of average equity per year. */
    turnoverPctPerYear: number;
    /** New entries skipped because the stock opened at ARA. */
    blockedBuys: number;
    /** Exits that had to wait while the stock was locked at ARB. */
    delayedSells: number;
    avgDelayDays: number;
  };
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

/**
 * How trades are executed. The default (IDX_EXECUTION) is what a retail
 * account on IDX actually gets; FRICTIONLESS reproduces the textbook
 * close-to-close, cost-free backtest for comparison.
 */
export interface ExecutionModel {
  /** Broker commission + levies on buys, % of traded value. */
  buyFeePct: number;
  /** Broker commission + levies + 0.1% final income tax on sells, %. */
  sellFeePct: number;
  /** Cross half the minimum tick (fraksi harga) on every trade. */
  spread: boolean;
  /** Trade at the next session's open (signal is computed at the close). */
  nextOpen: boolean;
  /** No buys at a limit-up (ARA) open; no sells while locked limit-down (ARB). */
  autoReject: boolean;
}

export const IDX_EXECUTION: ExecutionModel = { buyFeePct: 0.15, sellFeePct: 0.25, spread: true, nextOpen: true, autoReject: true };
export const FRICTIONLESS: ExecutionModel = { buyFeePct: 0, sellFeePct: 0, spread: false, nextOpen: false, autoReject: false };

export interface RunOptions {
  /** Defaults to IDX_EXECUTION. */
  execution?: ExecutionModel;
  cadence?: Cadence;
  /** Batasi jumlah nama dipilih per rebalance — top-K by `rank` desc. */
  maxNames?: number | null;
  /** Ambang numerik di atas `rank` (untuk matrix path). */
  minRank?: number | null;
  /** Matrix prakomputasi — mengesampingkan `signal` saat diberikan. */
  signals?: SignalMatrix;
}

/** Last bar index with date ≤ `date` (bars ascending), or -1. */
function indexOnOrBefore(bars: DailyBar[], date: string): number {
  let lo = 0;
  let hi = bars.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid]!.date <= date) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/**
 * Equal-weight, periodically rebalanced portfolio, simulated position by
 * position: cash and fractional shares, fees and spread on every trade, and
 * IDX auto-reject limits deciding whether an order fills.
 *
 * At each rebalance the signal uses bars up to the close of date t only; the
 * trades execute at the next open (or that close, if `nextOpen` is off).
 * A blocked buy leaves its slice in cash for the period; a blocked sell is
 * retried at each following open until the next rebalance, and the proceeds
 * stay in cash. The equity curve is marked at each rebalance's execution price.
 */
export function runBacktest(
  barsBySymbol: Map<string, DailyBar[]>,
  ihsgBars: DailyBar[],
  signal: SignalFn,
  opts: RunOptions = {}
): BacktestResult | null {
  if (ihsgBars.length < 260) return null;
  const ex = opts.execution ?? IDX_EXECUTION;
  const cadence = opts.cadence ?? 'monthly';
  const maxNames = opts.maxNames ?? null;
  const minRank = opts.minRank ?? null;
  const matrix = opts.signals ?? null;
  const buyFee = ex.buyFeePct / 100;
  const sellFee = ex.sellFeePct / 100;
  const spreadOf = (price: number) => (ex.spread ? halfSpread(price) : 0);

  const timeline = ihsgBars.map((b) => b.date);
  const ihsgClose = new Map(ihsgBars.map((b) => [b.date, b.close]));
  const idxMaps = new Map<string, Map<string, number>>();
  for (const [sym, bars] of barsBySymbol) idxMaps.set(sym, new Map(bars.map((b, i) => [b.date, i])));

  // Rebalance points: period-ends where IHSG has >=200 prior bars (MA200 warm-up)
  const rebal = rebalanceIndices(ihsgBars, cadence).filter((i) => i >= 200);
  if (rebal.length < 6) return null;

  /** Execution bar for a trade decided at the close of `date` (null if not traded that day). */
  const execIndex = (sym: string, date: string): number | null => {
    const idx = idxMaps.get(sym)!.get(date);
    if (idx == null) return null;
    const bars = barsBySymbol.get(sym)!;
    return ex.nextOpen && idx + 1 < bars.length ? idx + 1 : idx;
  };
  const priceAt = (bars: DailyBar[], i: number, decidedAt: number) =>
    ex.nextOpen && i > decidedAt ? bars[i]!.open : bars[i]!.close;

  let cash = 100;
  const shares = new Map<string, number>();
  let ihsgEq = 100;
  const stratCurve: number[] = [];
  const ihsgCurve: number[] = [];
  const periodRets: number[] = [];
  const holdingsCount: number[] = [];
  let costPaid = 0;
  let traded = 0;
  let buys = 0;
  let sells = 0;
  let blockedBuys = 0;
  let delayedSells = 0;
  let delayDays = 0;
  let prevValue = 100;

  for (let k = 0; k < rebal.length; k++) {
    const dateT = timeline[rebal[k]!]!;
    const last = k === rebal.length - 1;

    // 1) Mark every position at this rebalance's execution price.
    const mark = new Map<string, { i: number | null; price: number }>();
    let value = cash;
    for (const [sym, n] of shares) {
      const bars = barsBySymbol.get(sym)!;
      const e = execIndex(sym, dateT);
      const idxT = idxMaps.get(sym)!.get(dateT);
      const price = e != null ? priceAt(bars, e, idxT!) : bars[Math.max(0, indexOnOrBefore(bars, dateT))]!.close;
      mark.set(sym, { i: e, price });
      value += n * price;
    }
    if (k > 0) {
      periodRets.push(value / prevValue - 1);
      ihsgEq *= ihsgClose.get(dateT)! / ihsgClose.get(timeline[rebal[k - 1]!]!)!;
    }
    stratCurve.push(value);
    ihsgCurve.push(ihsgEq);
    prevValue = value;
    if (last) break;

    // 2) Select (signal on bars ≤ close of t only).
    const candidates: { sym: string; rank: number }[] = [];
    for (const [sym, bars] of barsBySymbol) {
      const idx = idxMaps.get(sym)!.get(dateT);
      if (idx == null || idx < 30 || execIndex(sym, dateT) == null) continue;
      let rank = 0;
      if (matrix) {
        const cell = matrix.get(sym)?.get(dateT);
        if (!cell || !cell.ok) continue;
        rank = cell.rank;
        if (minRank != null && rank < minRank) continue;
      } else if (!signal(bars.slice(0, idx + 1))) continue;
      candidates.push({ sym, rank });
    }
    let chosen = candidates;
    if (maxNames != null && candidates.length > maxNames) {
      chosen = [...candidates].sort((a, b) => b.rank - a.rank).slice(0, maxNames);
    }
    const target = new Set(chosen.map((c) => c.sym));

    const sellValue = (sym: string, n: number, price: number) => {
      const gross = n * price;
      const net = gross * (1 - spreadOf(price)) * (1 - sellFee);
      costPaid += gross - net;
      traded += gross;
      sells++;
      return net;
    };
    const blockedSell = (sym: string, i: number) => {
      const bars = barsBySymbol.get(sym)!;
      return ex.autoReject && i > 0 && sellBlocked(bars[i]!, bars[i - 1]!.close);
    };
    const blockedBuy = (sym: string, i: number) => {
      const bars = barsBySymbol.get(sym)!;
      const idxT = idxMaps.get(sym)!.get(dateT)!;
      return ex.autoReject && i > 0 && buyBlocked(bars[i]!, bars[i - 1]!.close, ex.nextOpen && i > idxT);
    };

    // 3) Exits. A locked (ARB) exit is retried at the next opens until the
    //    next rebalance; its proceeds cannot fund this rebalance's buys.
    let deferred = 0;    // proceeds of delayed exits (arrive after this rebalance)
    let delayedMark = 0; // their marked value, not investable now
    const stuck = new Set<string>();
    const nextDate = timeline[rebal[k + 1]!]!;
    for (const [sym, n] of [...shares]) {
      if (target.has(sym)) continue;
      const m = mark.get(sym)!;
      if (m.i == null) { stuck.add(sym); continue; } // not traded today (suspended)
      if (!blockedSell(sym, m.i)) {
        cash += sellValue(sym, n, m.price);
        shares.delete(sym);
        continue;
      }
      const bars = barsBySymbol.get(sym)!;
      let j = m.i + 1;
      while (j < bars.length && bars[j]!.date < nextDate && blockedSell(sym, j)) j++;
      if (j < bars.length && bars[j]!.date < nextDate) {
        deferred += sellValue(sym, n, ex.nextOpen ? bars[j]!.open : bars[j]!.close);
        delayedMark += n * m.price;
        delayedSells++;
        delayDays += j - m.i;
        shares.delete(sym);
      } else {
        stuck.add(sym); // still locked: carried into the next period
      }
    }

    // 4) Resize kept names and buy new ones to an equal slice of what can be invested.
    let stuckValue = 0;
    for (const sym of stuck) stuckValue += shares.get(sym)! * mark.get(sym)!.price;
    const slice = target.size ? (value - stuckValue - delayedMark) / target.size : 0;
    const orders: { sym: string; i: number; price: number; delta: number }[] = [];
    for (const sym of target) {
      const i = execIndex(sym, dateT)!;
      const price = mark.get(sym)?.price ?? priceAt(barsBySymbol.get(sym)!, i, idxMaps.get(sym)!.get(dateT)!);
      const delta = slice - (shares.get(sym) ?? 0) * price;
      orders.push({ sym, i, price, delta });
    }
    for (const o of orders) { // trims first, to raise cash
      if (o.delta >= 0 || blockedSell(o.sym, o.i)) continue;
      cash += sellValue(o.sym, -o.delta / o.price, o.price);
      shares.set(o.sym, shares.get(o.sym)! + o.delta / o.price);
    }
    const wanted = orders.filter((o) => {
      if (o.delta <= 0) return false;
      if (!blockedBuy(o.sym, o.i)) return true;
      if (!shares.has(o.sym)) blockedBuys++;
      return false;
    });
    const need = wanted.reduce((t, o) => t + o.delta * (1 + spreadOf(o.price)) * (1 + buyFee), 0);
    const scale = need > cash ? cash / need : 1; // fees can leave a hair too little cash
    for (const o of wanted) {
      const spend = o.delta * (1 + spreadOf(o.price)) * (1 + buyFee) * scale;
      const gross = o.delta * scale;
      cash -= spend;
      costPaid += spend - gross;
      traded += gross;
      buys++;
      shares.set(o.sym, (shares.get(o.sym) ?? 0) + gross / o.price);
    }
    cash += deferred;
    holdingsCount.push(shares.size);
  }

  const periods = periodRets.length;
  const perYear = cadence === 'weekly' ? 52 : cadence === 'biweekly' ? 26 : 12;
  const annFactor = Math.sqrt(perYear);
  const years = periods / perYear;
  const equity = stratCurve[stratCurve.length - 1]!;
  const totalReturn = equity / 100 - 1;
  const cagr = years > 0 && equity > 0 ? Math.pow(equity / 100, 1 / years) - 1 : 0;
  const winRate = periods ? periodRets.filter((r) => r > 0).length / periods : 0;
  const mMean = mean(periodRets);
  const mStd = std(periodRets);
  const downside = std(periodRets.filter((r) => r < 0));
  const sharpe = mStd > 0 ? (mMean / mStd) * annFactor : 0;
  const sortino = downside > 0 ? (mMean / downside) * annFactor : 0;
  const ihsgTotal = ihsgEq / 100 - 1;
  const ihsgCagr = years > 0 ? Math.pow(ihsgEq / 100, 1 / years) - 1 : 0;
  const avgEquity = mean(stratCurve);

  const curveDates = rebal.map((i) => timeline[i]!);
  return {
    start: curveDates[0]!,
    end: curveDates[curveDates.length - 1]!,
    months: periods,
    cadence,
    equity: curveDates.map((d, i) => ({ date: d, strat: r2(stratCurve[i]!), ihsg: r2(ihsgCurve[i]!) })),
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
    execution: ex,
    trading: {
      buys,
      sells,
      costPctPerYear: years > 0 && avgEquity > 0 ? r2((costPaid / avgEquity / years) * 100) : 0,
      turnoverPctPerYear: years > 0 && avgEquity > 0 ? r2((traded / 2 / avgEquity / years) * 100) : 0,
      blockedBuys,
      delayedSells,
      avgDelayDays: delayedSells ? r2(delayDays / delayedSells) : 0
    }
  };
}
