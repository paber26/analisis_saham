// Multi-factor (Quality–Value–Momentum) scoring over the screener universe.
// Pure & cross-sectional: each factor is a 0–100 percentile rank of the stock
// vs its peers in the same result set, then Value/Quality/Momentum are the mean
// of their sub-metrics and QVM is the mean of the three. Higher = better.
//
// Derived entirely from fields already present on ScreenRow (no new fetches):
//   Value    ← PER (low), PBV (low), Dividend Yield (high)
//   Quality  ← ROE (high), DER (low), Earnings Growth (high)
//   Momentum ← RS 3m vs IHSG (high), technical score (high)

import type { ScreenRow } from './store';

export interface FactorScores {
  value: number | null;
  quality: number | null;
  momentum: number | null;
  qvm: number | null;
  qvmRank: number | null; // 1 = best; null when qvm can't be computed
}

export type ScoredRow = ScreenRow & FactorScores;

// Percentile rank (0–100) of each value among the non-null numbers.
// direction 'high' = larger is better; 'low' = smaller is better.
// Returns an array aligned to input; null stays null (excluded from the factor).
function percentile(values: (number | null)[], direction: 'high' | 'low'): (number | null)[] {
  const nums = values.filter((v): v is number => v != null && isFinite(v));
  const n = nums.length;
  if (n < 2) return values.map(() => null);
  const sorted = [...nums].sort((a, b) => a - b);
  return values.map((v) => {
    if (v == null || !isFinite(v)) return null;
    // mid-rank percentile: (# strictly less + 0.5·# equal) / n
    let less = 0;
    let equal = 0;
    for (const s of sorted) {
      if (s < v) less++;
      else if (s === v) equal++;
    }
    const pct = ((less + 0.5 * equal) / n) * 100;
    return direction === 'high' ? pct : 100 - pct;
  });
}

function avg(parts: (number | null)[]): number | null {
  const ok = parts.filter((p): p is number => p != null && isFinite(p));
  if (!ok.length) return null;
  return Math.round((ok.reduce((a, b) => a + b, 0) / ok.length) * 10) / 10;
}

export function computeFactors(rows: ScreenRow[]): ScoredRow[] {
  // Value inputs — a non-positive PER/PBV means loss-making / negative book,
  // which shouldn't count as "cheap": treat as null (rely on other sub-metrics).
  const perP = percentile(rows.map((r) => (r.per != null && r.per > 0 ? r.per : null)), 'low');
  const pbvP = percentile(rows.map((r) => (r.pbv != null && r.pbv > 0 ? r.pbv : null)), 'low');
  const dyP = percentile(rows.map((r) => r.dividendYield), 'high');

  // Quality inputs
  const roeP = percentile(rows.map((r) => r.roe), 'high');
  const derP = percentile(rows.map((r) => (r.debtToEquity != null && r.debtToEquity >= 0 ? r.debtToEquity : null)), 'low');
  const egP = percentile(rows.map((r) => r.earningsGrowth), 'high');

  // Momentum inputs
  const rsP = percentile(rows.map((r) => r.rs3m), 'high');
  const scoreP = percentile(rows.map((r) => (typeof r.score === 'number' ? r.score : null)), 'high');

  const scored: ScoredRow[] = rows.map((r, i) => {
    const value = avg([perP[i]!, pbvP[i]!, dyP[i]!]);
    const quality = avg([roeP[i]!, derP[i]!, egP[i]!]);
    const momentum = avg([rsP[i]!, scoreP[i]!]);
    const qvm = avg([value, quality, momentum]);
    return { ...r, value, quality, momentum, qvm, qvmRank: null };
  });

  // Dense rank by QVM (desc). Rows without a QVM keep null rank.
  const ranked = scored
    .filter((r) => r.qvm != null)
    .sort((a, b) => (b.qvm as number) - (a.qvm as number));
  ranked.forEach((r, idx) => { r.qvmRank = idx + 1; });

  return scored;
}
