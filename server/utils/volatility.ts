// Volatility toolkit for the forecaster (pure TypeScript, no deps).
//
// - GARCH(1,1) with Student-t innovations, fitted by maximum likelihood
//   (Nelder–Mead on unconstrained params, variance targeting for omega).
//   Captures volatility clustering and fat tails that EWMA + normal miss.
// - Multi-step variance forecast (mean-reverting to the long-run variance).
// - Student-t CDF / quantile (regularized incomplete beta).
// - Split-conformal band calibration: the band width for horizon h is the
//   empirical 80% quantile of |realized h-day return| / predicted h-day sigma
//   over a walk-forward window, so the band covers ~80% of outcomes
//   historically instead of assuming normality. Coverage is reported
//   out-of-sample (scale fitted on the first half, measured on the second).

export interface GarchFit {
  omega: number;
  alpha: number;
  beta: number;
  nu: number;          // Student-t degrees of freedom (> 2)
  mean: number;        // mean daily log return used to demean
  logLik: number;
  persistence: number; // alpha + beta
  longRunVar: number;  // omega / (1 - alpha - beta)
}

// ---------- special functions ----------
const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

export function lgamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < 8; i++) a += LANCZOS[i]! / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// Continued fraction for the incomplete beta (Numerical Recipes betacf).
function betacf(a: number, b: number, x: number): number {
  const EPS = 1e-14;
  const FPMIN = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function incBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** CDF of the (non-standardized) Student-t with nu degrees of freedom. */
export function studentTCdf(t: number, nu: number): number {
  if (!isFinite(nu) || nu > 1e6) return normCdf(t);
  const p = 0.5 * incBeta(nu / (nu + t * t), nu / 2, 0.5);
  return t >= 0 ? 1 - p : p;
}

/** Quantile of the Student-t (bisection on the CDF; |t| <= 1e3). */
export function studentTQuantile(p: number, nu: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  let lo = -1e3;
  let hi = 1e3;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, nu) < p) lo = mid; else hi = mid;
    if (hi - lo < 1e-10) break;
  }
  return (lo + hi) / 2;
}

function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
export const normCdf = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));

// ---------- Nelder–Mead (minimize) ----------
function nelderMead(f: (x: number[]) => number, x0: number[], step = 0.5, maxIter = 300, tol = 1e-8): { x: number[]; fx: number } {
  const n = x0.length;
  let simplex = [x0, ...x0.map((_, i) => x0.map((v, j) => (j === i ? v + step : v)))];
  let values = simplex.map(f);
  for (let iter = 0; iter < maxIter; iter++) {
    const order = values.map((v, i) => i).sort((a, b) => values[a]! - values[b]!);
    simplex = order.map((i) => simplex[i]!);
    values = order.map((i) => values[i]!);
    if (Math.abs(values[n]! - values[0]!) < tol * (Math.abs(values[0]!) + tol)) break;
    const centroid = x0.map((_, j) => simplex.slice(0, n).reduce((s, p) => s + p[j]!, 0) / n);
    const at = (t: number) => centroid.map((c, j) => c + t * (simplex[n]![j]! - c));
    const xr = at(-1);
    const fr = f(xr);
    if (fr < values[0]!) {
      const xe = at(-2);
      const fe = f(xe);
      if (fe < fr) { simplex[n] = xe; values[n] = fe; } else { simplex[n] = xr; values[n] = fr; }
    } else if (fr < values[n - 1]!) {
      simplex[n] = xr; values[n] = fr;
    } else {
      const xc = fr < values[n]! ? at(-0.5) : at(0.5);
      const fc = f(xc);
      if (fc < Math.min(fr, values[n]!)) { simplex[n] = xc; values[n] = fc; } else {
        for (let i = 1; i <= n; i++) {
          simplex[i] = simplex[i]!.map((v, j) => simplex[0]![j]! + 0.5 * (v - simplex[0]![j]!));
          values[i] = f(simplex[i]!);
        }
      }
    }
  }
  let best = 0;
  for (let i = 1; i <= n; i++) if (values[i]! < values[best]!) best = i;
  return { x: simplex[best]!, fx: values[best]! };
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));
const MAX_PERSIST = 0.999;
const NU_MIN = 2.05;
const NU_SPAN = 48; // nu in (2.05, 50.05)

/**
 * Conditional variance path for returns r[0..m-1] (already demeaned).
 * Returns h of length m+1: h[t] = variance forecast for r[t] made with info
 * up to t-1; h[m] = next-step forecast.
 */
export function garchFilter(fit: Pick<GarchFit, 'omega' | 'alpha' | 'beta'>, e: number[], h0: number): number[] {
  const h = new Array<number>(e.length + 1);
  h[0] = h0;
  for (let t = 0; t < e.length; t++) h[t + 1] = fit.omega + fit.alpha * e[t]! * e[t]! + fit.beta * h[t]!;
  return h;
}

/**
 * Fit GARCH(1,1)-t on daily log returns. Returns null when there is too little
 * data, the likelihood is degenerate, or the fit is (near) non-stationary.
 */
export function fitGarchT(returns: number[]): GarchFit | null {
  const r = returns.filter((x) => isFinite(x));
  const m = r.length;
  if (m < 250) return null;
  const mean = r.reduce((a, b) => a + b, 0) / m;
  const e = r.map((x) => x - mean);
  const v0 = e.reduce((a, b) => a + b * b, 0) / m;
  if (!(v0 > 0)) return null;

  const unpack = (x: number[]) => {
    const p = MAX_PERSIST * sigmoid(x[0]!);
    const s = sigmoid(x[1]!);
    const nu = NU_MIN + NU_SPAN * sigmoid(x[2]!);
    return { alpha: p * s, beta: p * (1 - s), omega: v0 * (1 - p), nu };
  };
  const negLL = (x: number[]) => {
    const { alpha, beta, omega, nu } = unpack(x);
    const c = lgamma((nu + 1) / 2) - lgamma(nu / 2) - 0.5 * Math.log(Math.PI * (nu - 2));
    let h = v0;
    let ll = 0;
    for (let t = 0; t < m; t++) {
      if (!(h > 0) || !isFinite(h)) return 1e12;
      ll += c - 0.5 * Math.log(h) - ((nu + 1) / 2) * Math.log(1 + (e[t]! * e[t]!) / ((nu - 2) * h));
      h = omega + alpha * e[t]! * e[t]! + beta * h;
    }
    return isFinite(ll) ? -ll : 1e12;
  };

  const x0 = [logit(0.95 / MAX_PERSIST), logit(0.08 / 0.95), logit((8 - NU_MIN) / NU_SPAN)];
  const { x, fx } = nelderMead(negLL, x0, 0.6, 400);
  if (!isFinite(fx) || fx >= 1e12) return null;
  const { alpha, beta, omega, nu } = unpack(x);
  const persistence = alpha + beta;
  if (persistence >= MAX_PERSIST - 1e-4) return null; // effectively IGARCH — no mean reversion
  return { omega, alpha, beta, nu, mean, logLik: -fx, persistence, longRunVar: omega / (1 - persistence) };
}

/** Per-step variance forecasts V_1..V_H from next-step variance hNext. */
export function garchStepVars(fit: Pick<GarchFit, 'persistence' | 'longRunVar'>, hNext: number, H: number): number[] {
  const out: number[] = [];
  let decay = 1;
  for (let k = 1; k <= H; k++) {
    out.push(fit.longRunVar + decay * (hNext - fit.longRunVar));
    decay *= fit.persistence;
  }
  return out;
}

// ---------- conformal band calibration ----------
export const Z80 = 1.2815515655446004; // two-sided 80% normal quantile

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

export interface BandCalibration {
  /** q80[h-1] = 80% quantile of |z| at horizon h, in units of predicted h-day sigma. */
  q80: number[];
  /** Coverage (%) of a plain ±1.28σ normal band at the target horizon — EWMA vs GARCH. */
  ewmaCoverage: number | null;
  garchCoverage: number | null;
  /** Out-of-sample coverage (%) of the calibrated band at the target horizon. */
  calibratedCoverage: number | null;
  windowSize: number;
}

/**
 * Walk-forward calibration. For each origin t in [start, n-1-h], the predicted
 * cumulative sigma for the next h returns uses ONLY information up to t
 * (GARCH params fitted before `start`, variance filtered forward; EWMA is
 * recursive), and is compared with the realized h-day log return.
 *
 * @param rets      log returns aligned to prices (rets[0] = 0)
 * @param ewmaSigma ewmaSigma[t] = EWMA sigma after observing rets[t]
 * @param garch     params fitted on rets[1..start] (or null → EWMA only)
 */
export function calibrateBands(rets: number[], ewmaSigma: number[], garch: GarchFit | null, start: number, H: number): BandCalibration | null {
  const n = rets.length;
  const lastOrigin = n - 1 - H;
  const windowSize = lastOrigin - start + 1;
  if (start < 1 || windowSize < 60) return null;

  // GARCH variance path with pre-window params: hNext[t] = forecast for rets[t+1].
  let hNext: number[] | null = null;
  if (garch) {
    const e = rets.slice(1).map((x) => x - garch.mean);
    const h = garchFilter(garch, e, garch.longRunVar); // h[i] forecasts e[i] = rets[i+1]
    hNext = h; // hNext[t] = h[t] → variance of rets[t+1] given info up to t
  }

  // Prefix sums of returns for fast h-day realized returns.
  const cum = new Array<number>(n).fill(0);
  for (let t = 1; t < n; t++) cum[t] = cum[t - 1]! + rets[t]!;

  const zG: number[][] = Array.from({ length: H }, () => []);
  const zE: number[][] = Array.from({ length: H }, () => []);
  for (let t = start; t <= n - 2; t++) {
    const stepVars = garch && hNext ? garchStepVars(garch, hNext[t]!, H) : null;
    let accVar = 0;
    for (let h = 1; h <= H && t + h <= n - 1; h++) {
      const realized = cum[t + h]! - cum[t]!;
      if (stepVars) {
        accVar += stepVars[h - 1]!;
        zG[h - 1]!.push(Math.abs(realized) / Math.sqrt(accVar));
      }
      const se = ewmaSigma[t]! * Math.sqrt(h);
      if (se > 0) zE[h - 1]!.push(Math.abs(realized) / se);
    }
  }

  const chosen = garch ? zG : zE;
  const q80 = chosen.map((zs) => {
    const s = [...zs].sort((a, b) => a - b);
    return s.length >= 30 ? quantile(s, 0.8) : Z80;
  });

  const cover = (zs: number[], q: number) => (zs.length ? Math.round((zs.filter((z) => z <= q).length / zs.length) * 1000) / 10 : null);
  // Honest coverage at the target horizon: scale from the first half, measured on the second.
  const zH = chosen[H - 1]!;
  const half = Math.floor(zH.length / 2);
  let calibratedCoverage: number | null = null;
  if (half >= 30) {
    const qFirst = quantile([...zH.slice(0, half)].sort((a, b) => a - b), 0.8);
    calibratedCoverage = cover(zH.slice(half), qFirst);
  }

  return {
    q80,
    ewmaCoverage: cover(zE[H - 1]!, Z80),
    garchCoverage: garch ? cover(zG[H - 1]!, Z80) : null,
    calibratedCoverage,
    windowSize
  };
}
