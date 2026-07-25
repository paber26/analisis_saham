// Ordinary Least Squares multiple linear regression — pure TypeScript, no deps.
//
// Solves β = (XᵀX)⁻¹ Xᵀy via Gauss-Jordan matrix inversion, then reports the
// usual diagnostics (R², adjusted R², standard errors, t-stats, p-values).
// p-values use a normal approximation to the t-distribution (fine for the
// sample sizes here; avoids shipping a t-distribution table).

export interface RegressionTerm {
  name: string;
  coef: number;
  stdErr: number;
  tStat: number;
  pValue: number;
}
export interface RegressionResult {
  n: number;              // observations
  k: number;              // predictors (excluding intercept)
  r2: number;
  adjR2: number;
  terms: RegressionTerm[]; // [intercept, ...predictors]
  sigma: number;           // residual standard error
}

function transpose(m: number[][]): number[][] {
  const rows = m.length, cols = m[0]?.length ?? 0;
  const t: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) t[j]![i] = m[i]![j]!;
  return t;
}

function matMul(a: number[][], b: number[][]): number[][] {
  const n = a.length, m = b[0]!.length, p = b.length;
  const out: number[][] = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++)
    for (let k = 0; k < p; k++) {
      const aik = a[i]![k]!;
      if (aik === 0) continue;
      for (let j = 0; j < m; j++) out[i]![j] += aik * b[k]![j]!;
    }
  return out;
}

function matVec(a: number[][], v: number[]): number[] {
  return a.map((row) => row.reduce((s, x, j) => s + x * v[j]!, 0));
}

/** Invert a square matrix via Gauss-Jordan with partial pivoting. Null if singular. */
export function invert(mat: number[][]): number[][] | null {
  const n = mat.length;
  const a = mat.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    // pivot
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r]![col]!) > Math.abs(a[piv]![col]!)) piv = r;
    if (Math.abs(a[piv]![col]!) < 1e-12) return null; // singular
    [a[col], a[piv]] = [a[piv]!, a[col]!];
    const pv = a[col]![col]!;
    for (let j = 0; j < 2 * n; j++) a[col]![j]! /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r]![col]!;
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) a[r]![j]! -= f * a[col]![j]!;
    }
  }
  return a.map((r) => r.slice(n));
}

// Standard normal CDF (Abramowitz-Stegun 7.1.26) → two-sided p-value proxy.
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}
function twoSidedP(z: number): number {
  return 2 * (1 - normCdf(Math.abs(z)));
}

/**
 * Fit y ~ features (intercept added automatically).
 * @param rows   feature rows (each length = featureNames.length)
 * @param y      response, same length as rows
 * @param featureNames labels for the predictors
 */
export function ols(rows: number[][], y: number[], featureNames: string[]): RegressionResult | null {
  const n = rows.length;
  const k = featureNames.length;
  if (n < k + 2) return null; // need more observations than parameters

  // Design matrix with leading intercept column.
  const X = rows.map((r) => [1, ...r]);
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const XtXinv = invert(XtX);
  if (!XtXinv) return null;
  const beta = matVec(XtXinv, matVec(Xt, y)); // (XᵀX)⁻¹ Xᵀy

  // Residuals & variance.
  const yHat = matVec(X, beta);
  const resid = y.map((yi, i) => yi - yHat[i]!);
  const rss = resid.reduce((s, e) => s + e * e, 0);
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const tss = y.reduce((s, v) => s + (v - yMean) ** 2, 0) || 1e-12;
  const r2 = 1 - rss / tss;
  const dof = n - (k + 1);
  const adjR2 = 1 - (1 - r2) * ((n - 1) / Math.max(1, dof));
  const sigma2 = rss / Math.max(1, dof);
  const sigma = Math.sqrt(sigma2);

  const labels = ['intercept', ...featureNames];
  const terms: RegressionTerm[] = beta.map((b, j) => {
    const se = Math.sqrt(Math.max(0, sigma2 * XtXinv[j]![j]!));
    const tStat = se > 0 ? b / se : 0;
    return { name: labels[j]!, coef: b, stdErr: se, tStat, pValue: twoSidedP(tStat) };
  });

  return { n, k, r2, adjR2, terms, sigma };
}

/** Predict y for one feature row using a fitted result. */
export function predict(result: RegressionResult, features: number[]): number {
  return result.terms.reduce((sum, t, j) => sum + t.coef * (j === 0 ? 1 : features[j - 1] ?? 0), 0);
}
