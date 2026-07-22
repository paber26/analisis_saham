// Single-stock risk metrics for the analysis hub: annualized volatility,
// 1-day 95% parametric VaR, max drawdown over the window, and beta vs IHSG.
// Pure functions over daily bars — same conventions as portfolio.ts.

import type { DailyBar } from './yahoo';

export interface StockRisk {
  volDailyPct: number;      // daily return stdev (%)
  volAnnualPct: number;     // annualized (×√252) volatility (%)
  var95Pct: number;         // 1-day 95% parametric VaR magnitude (%)
  maxDrawdownPct: number;   // largest peak-to-trough drop over window (%)
  beta: number | null;      // slope vs IHSG daily returns
  rating: 'Rendah' | 'Sedang' | 'Tinggi';
  n: number;                // sample size (daily returns)
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
function std(v: number[]): number {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
}

// date -> log return
function returnsMap(bars: DailyBar[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1]!.close;
    if (prev > 0) m.set(bars[i]!.date, Math.log(bars[i]!.close / prev));
  }
  return m;
}

function ratingOf(volAnnualPct: number): StockRisk['rating'] {
  if (volAnnualPct < 25) return 'Rendah';
  if (volAnnualPct <= 45) return 'Sedang';
  return 'Tinggi';
}

export function computeStockRisk(bars: DailyBar[], ihsgBars: DailyBar[] | null): StockRisk | null {
  if (!bars || bars.length < 30) return null;

  const rmap = returnsMap(bars);
  const rets = Array.from(rmap.values());
  if (rets.length < 20) return null;

  const volDaily = std(rets);

  // Max drawdown on the close-price equity curve.
  let peak = bars[0]!.close;
  let maxDd = 0;
  for (const b of bars) {
    peak = Math.max(peak, b.close);
    if (peak > 0) maxDd = Math.max(maxDd, (peak - b.close) / peak);
  }

  // Beta vs IHSG (aligned on shared dates).
  let beta: number | null = null;
  if (ihsgBars && ihsgBars.length > 30) {
    const imap = returnsMap(ihsgBars);
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [d, r] of rmap) {
      const ir = imap.get(d);
      if (ir !== undefined) { xs.push(r); ys.push(ir); }
    }
    if (xs.length >= 20) {
      const mx = mean(xs);
      const my = mean(ys);
      let cov = 0;
      let vi = 0;
      for (let k = 0; k < xs.length; k++) { cov += (xs[k]! - mx) * (ys[k]! - my); vi += (ys[k]! - my) ** 2; }
      beta = vi > 0 ? round2(cov / vi) : null;
    }
  }

  const volAnnualPct = round2(volDaily * Math.sqrt(252) * 100);
  return {
    volDailyPct: round2(volDaily * 100),
    volAnnualPct,
    var95Pct: round2(1.645 * volDaily * 100),
    maxDrawdownPct: round2(maxDd * 100),
    beta,
    rating: ratingOf(volAnnualPct),
    n: rets.length,
  };
}
