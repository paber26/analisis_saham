// Strategy backtest engine — cross-sectional, monthly-rebalanced, equal-weight.
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
  months: number;
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

// Month-end indices in a chronological bar array (last trading day of each month)
function monthEndIndices(bars: DailyBar[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const cur = bars[i]!.date.slice(0, 7); // YYYY-MM
    const next = bars[i + 1]?.date.slice(0, 7);
    if (next !== cur) out.push(i); // last bar of its month
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

export function runBacktest(
  barsBySymbol: Map<string, DailyBar[]>,
  ihsgBars: DailyBar[],
  signal: SignalFn,
  opts: { costPct?: number } = {}
): BacktestResult | null {
  if (ihsgBars.length < 260) return null;
  const cost = opts.costPct ?? 0.15; // % of turnover per rebalance

  const timeline = ihsgBars.map((b) => b.date);
  const ihsgClose = new Map(ihsgBars.map((b) => [b.date, b.close]));

  // Per-stock date -> index (for slicing without look-ahead) and date -> close
  const idxMaps = new Map<string, Map<string, number>>();
  for (const [sym, bars] of barsBySymbol) {
    idxMaps.set(sym, new Map(bars.map((b, i) => [b.date, i])));
  }

  // Rebalance points: month-ends where IHSG has >=200 prior bars (MA200 warm-up)
  const allMonthEnds = monthEndIndices(ihsgBars);
  const rebal = allMonthEnds.filter((i) => i >= 200);
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

    const selected: { sym: string; ret: number }[] = [];
    for (const [sym, bars] of barsBySymbol) {
      const im = idxMaps.get(sym)!;
      const idx = im.get(dateT);
      const idxNext = im.get(dateNext);
      if (idx == null || idxNext == null || idx < 30) continue;
      if (signal(bars.slice(0, idx + 1))) {
        selected.push({ sym, ret: bars[idxNext]!.close / bars[idx]!.close - 1 });
      }
    }

    const holdings = new Set(selected.map((s) => s.sym));
    holdingsCount.push(holdings.size);

    // Equal-weight portfolio return (cash = 0% when nothing selected)
    let pr = selected.length ? mean(selected.map((s) => s.ret)) : 0;

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

  const months = monthlyRets.length;
  const years = months / 12;
  const totalReturn = equity / 100 - 1;
  const cagr = years > 0 ? Math.pow(equity / 100, 1 / years) - 1 : 0;
  const winRate = months ? monthlyRets.filter((r) => r > 0).length / months : 0;
  const mMean = mean(monthlyRets);
  const mStd = std(monthlyRets);
  const downside = std(monthlyRets.filter((r) => r < 0).map((r) => r));
  const sharpe = mStd > 0 ? (mMean / mStd) * Math.sqrt(12) : 0;
  const sortino = downside > 0 ? (mMean / downside) * Math.sqrt(12) : 0;

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
    months,
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
