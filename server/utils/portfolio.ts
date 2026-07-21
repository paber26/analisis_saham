// Portfolio analytics: valuation, correlation matrix, and risk (volatility,
// 1-day VaR, max drawdown, beta vs IHSG). Pure functions over daily bars.

import type { DailyBar } from './yahoo';
import type { Holding } from './store';

export interface Position {
  symbol: string;
  code: string;
  lots: number;
  shares: number;
  avgPrice: number;
  price: number;
  cost: number;
  value: number;
  pnl: number;
  pnlPct: number;
  weightPct: number;
}

export interface PortfolioAnalysis {
  positions: Position[];
  totalCost: number;
  totalValue: number;
  totalPnl: number;
  totalPnlPct: number;
  risk: {
    volDailyPct: number;
    volAnnualPct: number;
    var95Pct: number;
    var95Rp: number;
    maxDrawdownPct: number;
    beta: number | null;
  } | null;
  correlation: { symbols: string[]; matrix: number[][] } | null;
  warnings: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function mean(v: number[]): number { return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; }
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

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = mean(a);
  const mb = mean(b);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i]! - ma;
    const db = b[i]! - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  if (va === 0 || vb === 0) return 0;
  return cov / Math.sqrt(va * vb);
}

// Align two return maps on shared dates
function align(x: Map<string, number>, y: Map<string, number>): [number[], number[]] {
  const ax: number[] = [];
  const ay: number[] = [];
  for (const [d, v] of x) {
    const w = y.get(d);
    if (w !== undefined) { ax.push(v); ay.push(w); }
  }
  return [ax, ay];
}

export function analyzePortfolio(
  holdings: Holding[],
  barsBySymbol: Map<string, DailyBar[]>,
  ihsgBars: DailyBar[]
): PortfolioAnalysis {
  // ---- Valuation ----
  const raw = holdings.map((h) => {
    const bars = barsBySymbol.get(h.symbol) || [];
    const price = bars.length ? bars[bars.length - 1]!.close : 0;
    const shares = h.lots * 100;
    const cost = shares * h.avgPrice;
    const value = shares * price;
    return { h, price, shares, cost, value };
  });
  const totalCost = raw.reduce((a, b) => a + b.cost, 0);
  const totalValue = raw.reduce((a, b) => a + b.value, 0);

  const positions: Position[] = raw.map((r) => ({
    symbol: r.h.symbol,
    code: r.h.symbol.replace('.JK', ''),
    lots: r.h.lots,
    shares: r.shares,
    avgPrice: r.h.avgPrice,
    price: round2(r.price),
    cost: Math.round(r.cost),
    value: Math.round(r.value),
    pnl: Math.round(r.value - r.cost),
    pnlPct: r.cost > 0 ? round2(((r.value - r.cost) / r.cost) * 100) : 0,
    weightPct: totalValue > 0 ? round2((r.value / totalValue) * 100) : 0
  })).sort((a, b) => b.value - a.value);

  const totalPnl = Math.round(totalValue - totalCost);
  const totalPnlPct = totalCost > 0 ? round2((totalPnl / totalCost) * 100) : 0;

  const warnings: string[] = [];

  // ---- Returns per symbol (only those with data) ----
  const retMaps = new Map<string, Map<string, number>>();
  for (const h of holdings) {
    const bars = barsBySymbol.get(h.symbol);
    if (bars && bars.length > 30) retMaps.set(h.symbol, returnsMap(bars));
  }
  const symbolsWithData = positions.filter((p) => retMaps.has(p.symbol));

  // ---- Correlation matrix ----
  let correlation: PortfolioAnalysis['correlation'] = null;
  if (symbolsWithData.length >= 2) {
    const syms = symbolsWithData.map((p) => p.code);
    const matrix: number[][] = [];
    for (let i = 0; i < symbolsWithData.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < symbolsWithData.length; j++) {
        if (i === j) { row.push(1); continue; }
        const [a, b] = align(retMaps.get(symbolsWithData[i]!.symbol)!, retMaps.get(symbolsWithData[j]!.symbol)!);
        const c = round2(pearson(a, b));
        row.push(c);
        if (i < j && c > 0.7) warnings.push(`Korelasi tinggi ${syms[i]}–${syms[j]} (${c}) — diversifikasi rendah.`);
      }
      matrix.push(row);
    }
    correlation = { symbols: syms, matrix };
  }

  // ---- Portfolio risk ----
  let risk: PortfolioAnalysis['risk'] = null;
  if (symbolsWithData.length >= 1 && totalValue > 0) {
    // common dates across all held symbols (with data)
    const maps = symbolsWithData.map((p) => retMaps.get(p.symbol)!);
    const weights = symbolsWithData.map((p) => p.value / totalValue);
    const wSum = weights.reduce((a, b) => a + b, 0) || 1;
    const wNorm = weights.map((w) => w / wSum);

    const commonDates: string[] = [];
    for (const d of maps[0]!.keys()) {
      if (maps.every((m) => m.has(d))) commonDates.push(d);
    }
    commonDates.sort();

    if (commonDates.length >= 20) {
      const portRet = commonDates.map((d) => maps.reduce((acc, m, k) => acc + wNorm[k]! * m.get(d)!, 0));
      const volDaily = std(portRet);
      // Max drawdown on the equity curve
      let peak = 1;
      let equity = 1;
      let maxDd = 0;
      for (const r of portRet) {
        equity *= Math.exp(r);
        peak = Math.max(peak, equity);
        maxDd = Math.max(maxDd, (peak - equity) / peak);
      }
      // Beta vs IHSG
      let beta: number | null = null;
      const ihsgRet = returnsMap(ihsgBars);
      const portByDate = new Map<string, number>(commonDates.map((d, i) => [d, portRet[i]!]));
      const [pp, ii] = align(portByDate, ihsgRet);
      if (pp.length >= 20) {
        const mi = mean(ii);
        const mp = mean(pp);
        let cov = 0; let vi = 0;
        for (let k = 0; k < pp.length; k++) { cov += (pp[k]! - mp) * (ii[k]! - mi); vi += (ii[k]! - mi) ** 2; }
        beta = vi > 0 ? round2(cov / vi) : null;
      }
      const volDailyPct = round2(volDaily * 100);
      risk = {
        volDailyPct,
        volAnnualPct: round2(volDaily * Math.sqrt(252) * 100),
        var95Pct: round2(1.645 * volDaily * 100),
        var95Rp: Math.round(1.645 * volDaily * totalValue),
        maxDrawdownPct: round2(maxDd * 100),
        beta
      };
    }
  }

  const big = positions.find((p) => p.weightPct > 40);
  if (big) warnings.push(`Konsentrasi tinggi: ${big.code} ${big.weightPct}% dari portofolio.`);

  return {
    positions,
    totalCost: Math.round(totalCost),
    totalValue: Math.round(totalValue),
    totalPnl,
    totalPnlPct,
    risk,
    correlation,
    warnings
  };
}
