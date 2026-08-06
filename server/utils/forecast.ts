// Forecasting toolkit v2 (pure TypeScript).
//
// Design principles:
// - Model LOG RETURNS, not raw prices (stationarity).
// - Models: Naive (baseline), Drift, AR(p) with automatic order via AIC,
//   Holt linear on prices, ridge regression on technical features, and an
//   inverse-RMSE weighted ENSEMBLE of models that beat naive on a validation
//   window. If nothing beats naive, the ensemble honestly degrades to naive.
// - Evaluation: 3-fold walk-forward on the last 3×60 sessions, refit per fold,
//   ensemble weights computed on a validation slice INSIDE each fold's train
//   (no look-ahead leakage).
// - Uncertainty: EWMA volatility (lambda 0.94, RiskMetrics) drives the
//   projection band and P(up) = Phi(mu/sigma).

export interface PricePoint { date: string; close: number; }

export interface Metric {
  rmse: number;
  mae: number;
  mape: number;          // %
  dirAcc: number | null; // directional accuracy %, null when undefined (naive)
}

export type ModelKey = 'naive' | 'drift' | 'ar' | 'holt' | 'reg' | 'ensemble';

export interface SeriesPoint { date: string; actual: number; pred: number | null; }
export interface ForecastPoint { date: string; mean: number; lower: number; upper: number; }

export interface ForecastResult {
  lastPrice: number;
  lastDate: string;
  series: SeriesPoint[];             // last ~180 sessions, pred = ensemble 1-step
  forecast: ForecastPoint[];         // forward path with ~80% band
  metrics: Record<ModelKey, Metric>; // over concatenated test folds
  weights: { model: string; weight: number }[]; // full-data ensemble weights
  foldStability: { period: string; dirAcc: number | null }[];
  arOrder: number;
  best: ModelKey;
  baselineDirAcc: number;            // majority up/down share on test
  nextDay: {
    direction: 'up' | 'down';
    expectedReturnPct: number;
    probUp: number;                  // %
    hitRate: number | null;          // ensemble dirAcc on test
  };
  vol: { dailyPct: number; annualPct: number; regime: 'rendah' | 'normal' | 'tinggi' };
  /** Entry/exit probabilities over the horizon (drift + EWMA vol). */
  tradeOdds: {
    stopPct: number;
    targetPct: number;
    probDownToStop: number;
    probUpToTarget: number;
    edge: 'positif' | 'negatif' | 'netral';
  };
  trainSize: number;
  testSize: number;
  horizon: number;
}

const round = (n: number, d = 2) => {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
};
function mean(v: number[]): number { return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; }
function std(v: number[]): number {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
}

// Abramowitz-Stegun 7.1.26 erf approximation → standard normal CDF
function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const Phi = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));

// ---------- Linear algebra (Gauss-Jordan inverse + ridge) ----------
function invert(m: number[][]): number[][] | null {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r]![col]!) > Math.abs(a[piv]![col]!)) piv = r;
    if (Math.abs(a[piv]![col]!) < 1e-12) return null;
    [a[col], a[piv]] = [a[piv]!, a[col]!];
    const pv = a[col]![col]!;
    for (let j = 0; j < 2 * n; j++) a[col]![j]! /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r]![col]!;
      for (let j = 0; j < 2 * n; j++) a[r]![j]! -= f * a[col]![j]!;
    }
  }
  return a.map((row) => row.slice(n));
}

/** Ridge regression with unpenalised intercept. Returns [intercept, ...coefs]. */
function ridgeFit(X: number[][], y: number[], lambda: number): number[] | null {
  const rows = X.length;
  if (rows === 0) return null;
  const p = X[0]!.length + 1;
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty: number[] = new Array(p).fill(0);
  for (let i = 0; i < rows; i++) {
    const xi = [1, ...X[i]!];
    for (let a = 0; a < p; a++) {
      Xty[a]! += xi[a]! * y[i]!;
      for (let b = 0; b < p; b++) XtX[a]![b]! += xi[a]! * xi[b]!;
    }
  }
  for (let d = 1; d < p; d++) XtX[d]![d]! += lambda;
  const inv = invert(XtX);
  if (!inv) return null;
  return Array.from({ length: p }, (_, a) => {
    let s = 0;
    for (let b = 0; b < p; b++) s += inv[a]![b]! * Xty[b]!;
    return s;
  });
}

// ---------- Indicators for regression features ----------
function rsiSeries(closes: number[], period = 14): (number | null)[] {
  const n = closes.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < period + 1) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i]! - closes[i - 1]!;
    if (d >= 0) gain += d; else loss -= d;
  }
  let ag = gain / period;
  let al = loss / period;
  out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < n; i++) {
    const d = closes[i]! - closes[i - 1]!;
    ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
    al = (al * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}
function emaArr(v: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = v[0] ?? 0;
  out.push(prev);
  for (let i = 1; i < v.length; i++) { prev = v[i]! * k + prev * (1 - k); out.push(prev); }
  return out;
}
function macdHistSeries(closes: number[]): number[] {
  const e12 = emaArr(closes, 12);
  const e26 = emaArr(closes, 26);
  const macd = closes.map((_, i) => e12[i]! - e26[i]!);
  const sig = emaArr(macd, 9);
  return macd.map((m, i) => m - sig[i]!);
}
function smaAt(v: number[], p: number, end: number): number {
  let s = 0;
  for (let i = end - p + 1; i <= end; i++) s += v[i]!;
  return s / p;
}

// ---------- Holt's linear ----------
function holtRun(prices: number[], alpha: number, beta: number) {
  const n = prices.length;
  let level = prices[0]!;
  let trend = prices[1]! - prices[0]!;
  const fc: number[] = new Array(n).fill(NaN); // fc[t] = 1-step forecast for t
  for (let t = 1; t < n; t++) {
    fc[t] = level + trend;
    const prevLevel = level;
    level = alpha * prices[t]! + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  return { fc, level, trend };
}
function optimizeHolt(prices: number[], fitEnd: number) {
  let best = { alpha: 0.5, beta: 0.1, rmse: Infinity };
  for (let a = 0.1; a <= 0.9; a += 0.1) {
    for (let b = 0.05; b <= 0.6; b += 0.05) {
      const { fc } = holtRun(prices, a, b);
      let se = 0;
      let cnt = 0;
      for (let t = 2; t <= fitEnd; t++) if (!isNaN(fc[t]!)) { se += (fc[t]! - prices[t]!) ** 2; cnt++; }
      const rmse = cnt ? Math.sqrt(se / cnt) : Infinity;
      if (rmse < best.rmse) best = { alpha: a, beta: b, rmse };
    }
  }
  return best;
}

// ---------- Feature engineering (regression model) ----------
const FEATURE_START = 30;
interface FeatRow { idx: number; f: number[]; y: number } // y = log return of idx+1

function buildFeatures(prices: number[], rets: number[]) {
  const n = prices.length;
  const rsi = rsiSeries(prices, 14);
  const macdH = macdHistSeries(prices);
  const rows: FeatRow[] = [];
  for (let t = FEATURE_START; t < n - 1; t++) {
    const rv = rsi[t];
    if (rv == null) continue;
    let mom5 = 0;
    for (let k = t - 4; k <= t; k++) mom5 += rets[k]!;
    rows.push({
      idx: t,
      f: [rets[t]!, rets[t - 1]!, mom5, (rv - 50) / 50, macdH[t]! / prices[t]!, prices[t]! / smaAt(prices, 10, t) - 1],
      y: rets[t + 1]!
    });
  }
  let lastRow: number[] | null = null;
  const tl = n - 1;
  if (rsi[tl] != null) {
    let mom5 = 0;
    for (let k = tl - 4; k <= tl; k++) mom5 += rets[k]!;
    lastRow = [rets[tl]!, rets[tl - 1]!, mom5, (rsi[tl]! - 50) / 50, macdH[tl]! / prices[tl]!, prices[tl]! / smaAt(prices, 10, tl) - 1];
  }
  return { rows, lastRow };
}

// ---------- AR(p) on returns, order by AIC ----------
interface ARModel { p: number; c: number; phi: number[] }
function fitAR(rets: number[], fitEnd: number, maxP = 5): ARModel | null {
  let best: (ARModel & { aic: number }) | null = null;
  for (let p = 1; p <= maxP; p++) {
    const X: number[][] = [];
    const y: number[] = [];
    for (let t = p + 1; t <= fitEnd; t++) {
      const row: number[] = [];
      for (let j = 1; j <= p; j++) row.push(rets[t - j]!);
      X.push(row);
      y.push(rets[t]!);
    }
    if (X.length < p * 5 + 20) continue;
    const beta = ridgeFit(X, y, 1e-4);
    if (!beta) continue;
    let sse = 0;
    for (let i = 0; i < X.length; i++) {
      let f = beta[0]!;
      for (let j = 0; j < p; j++) f += beta[j + 1]! * X[i]![j]!;
      sse += (f - y[i]!) ** 2;
    }
    const aic = X.length * Math.log(sse / X.length + 1e-12) + 2 * (p + 1);
    if (!best || aic < best.aic) best = { p, c: beta[0]!, phi: beta.slice(1), aic };
  }
  return best;
}
function arPred(m: ARModel, rets: number[], t: number): number {
  let f = m.c;
  for (let j = 1; j <= m.p; j++) f += m.phi[j - 1]! * (rets[t - j] ?? 0);
  return f;
}

// ---------- EWMA volatility (RiskMetrics lambda = 0.94) ----------
function ewmaSigmaSeries(rets: number[], lambda = 0.94): number[] {
  const n = rets.length;
  const out: number[] = new Array(n).fill(0);
  const seedLen = Math.min(30, n - 1);
  const seed = std(rets.slice(1, 1 + seedLen)) || 0.01;
  let v = seed * seed;
  for (let t = 1; t < n; t++) {
    v = lambda * v + (1 - lambda) * rets[t]! * rets[t]!;
    out[t] = Math.sqrt(v);
  }
  out[0] = seed;
  return out;
}

// ---------- Model bundle fitted on data up to fitEnd (inclusive target) ----------
type RetPredFn = (t: number) => number;
interface FittedModels {
  drift: RetPredFn;
  ar: RetPredFn | null;
  arOrder: number;
  arModel: ARModel | null;
  holt: RetPredFn;
  holtState: { level: number; trend: number };
  reg: RetPredFn | null;
  regPredRow: ((f: number[]) => number) | null;
}

function fitModels(prices: number[], rets: number[], rows: FeatRow[], rowByTarget: Map<number, FeatRow>, fitEnd: number): FittedModels {
  // Drift
  const mu = mean(rets.slice(1, fitEnd + 1));
  const drift: RetPredFn = () => mu;

  // AR(p)
  const arModel = fitAR(rets, fitEnd);
  const ar: RetPredFn | null = arModel ? (t) => arPred(arModel, rets, t) : null;

  // Holt (params fit on ≤ fitEnd, recursion itself is walk-forward)
  const hp = optimizeHolt(prices, fitEnd);
  const hr = holtRun(prices, hp.alpha, hp.beta);
  const holt: RetPredFn = (t) => {
    const f = hr.fc[t];
    if (f == null || isNaN(f) || f <= 0) return 0;
    return Math.log(f / prices[t - 1]!);
  };

  // Ridge regression on features
  const tr = rows.filter((r) => r.idx + 1 <= fitEnd);
  let reg: RetPredFn | null = null;
  let regPredRow: ((f: number[]) => number) | null = null;
  if (tr.length >= 60) {
    const k = tr[0]!.f.length;
    const mus = new Array(k).fill(0);
    const sds = new Array(k).fill(1);
    for (let c = 0; c < k; c++) {
      const col = tr.map((r) => r.f[c]!);
      mus[c] = mean(col);
      sds[c] = std(col) || 1;
    }
    const applyZ = (f: number[]) => f.map((v, c) => (v - mus[c]) / sds[c]);
    const beta = ridgeFit(tr.map((r) => applyZ(r.f)), tr.map((r) => r.y), 1.0);
    if (beta) {
      regPredRow = (f) => {
        const z = applyZ(f);
        let s = beta[0]!;
        for (let j = 0; j < z.length; j++) s += beta[j + 1]! * z[j]!;
        return s;
      };
      reg = (t) => {
        const row = rowByTarget.get(t);
        return row ? regPredRow!(row.f) : 0;
      };
    }
  }

  return { drift, ar, arOrder: arModel?.p ?? 0, arModel, holt, holtState: { level: hr.level, trend: hr.trend }, reg, regPredRow };
}

// Validation RMSE (return space) for weighting
function valRmse(pred: RetPredFn | null, rets: number[], vs: number, ve: number): number {
  if (!pred) return Infinity;
  let se = 0;
  let c = 0;
  for (let t = vs; t < ve; t++) { se += (pred(t) - rets[t]!) ** 2; c++; }
  return c ? Math.sqrt(se / c) : Infinity;
}

interface Weights { entries: { key: 'drift' | 'ar' | 'holt' | 'reg'; w: number }[] } // empty => naive-only

function computeWeights(m: FittedModels, rets: number[], vs: number, ve: number): Weights {
  let seN = 0;
  let cN = 0;
  for (let t = vs; t < ve; t++) { seN += rets[t]! ** 2; cN++; }
  const rmseNaive = cN ? Math.sqrt(seN / cN) : Infinity;
  const cand: { key: 'drift' | 'ar' | 'holt' | 'reg'; r: number }[] = [
    { key: 'drift', r: valRmse(m.drift, rets, vs, ve) },
    { key: 'ar', r: valRmse(m.ar, rets, vs, ve) },
    { key: 'holt', r: valRmse(m.holt, rets, vs, ve) },
    { key: 'reg', r: valRmse(m.reg, rets, vs, ve) }
  ];
  const winners = cand.filter((c) => isFinite(c.r) && c.r < rmseNaive * 0.999);
  if (!winners.length) return { entries: [] };
  const raw = winners.map((c) => ({ key: c.key, w: 1 / (c.r * c.r) }));
  const tot = raw.reduce((a, b) => a + b.w, 0);
  return { entries: raw.map((e) => ({ key: e.key, w: e.w / tot })) };
}

function ensemblePred(m: FittedModels, w: Weights, t: number): number {
  if (!w.entries.length) return 0; // naive
  let s = 0;
  for (const e of w.entries) {
    const fn = e.key === 'drift' ? m.drift : e.key === 'ar' ? m.ar : e.key === 'holt' ? m.holt : m.reg;
    s += e.w * (fn ? fn(t) : 0);
  }
  return s;
}

function metricFromRets(predRet: Map<number, number>, prices: number[], targets: number[], withDir: boolean): Metric {
  let se = 0;
  let ae = 0;
  let ape = 0;
  let hit = 0;
  let cnt = 0;
  let dcnt = 0;
  for (const t of targets) {
    const rp = predRet.get(t) ?? 0;
    const pp = prices[t - 1]! * Math.exp(rp);
    const e = pp - prices[t]!;
    se += e * e;
    ae += Math.abs(e);
    ape += Math.abs(e / prices[t]!);
    cnt++;
    if (withDir) {
      const aDir = Math.sign(prices[t]! - prices[t - 1]!);
      const pDir = Math.sign(rp);
      // Only count sessions where the model actually voiced a direction —
      // a zero prediction (naive fallback) expresses no view, not a miss.
      if (aDir !== 0 && pDir !== 0) { dcnt++; if (pDir === aDir) hit++; }
    }
  }
  return {
    rmse: round(Math.sqrt(se / Math.max(1, cnt))),
    mae: round(ae / Math.max(1, cnt)),
    mape: round((ape / Math.max(1, cnt)) * 100),
    dirAcc: withDir && dcnt ? round((hit / dcnt) * 100, 1) : null
  };
}

function businessDaysAfter(lastDate: string, count: number): string[] {
  const out: string[] = [];
  const d = new Date(lastDate + 'T00:00:00Z');
  while (out.length < count) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().split('T')[0]!);
  }
  return out;
}

const MODEL_LABEL: Record<string, string> = { drift: 'Drift', ar: 'AR', holt: 'Holt', reg: 'Regresi' };

export function runForecast(points: PricePoint[], horizon = 14): ForecastResult | null {
  const clean = points.filter((p) => p.close > 0);
  const n = clean.length;
  if (n < 150) return null;

  const prices = clean.map((p) => p.close);
  const dates = clean.map((p) => p.date);

  // Log returns aligned to price index: rets[t] = ln(P[t]/P[t-1]), rets[0]=0
  const rets: number[] = new Array(n).fill(0);
  for (let t = 1; t < n; t++) rets[t] = Math.log(prices[t]! / prices[t - 1]!);

  const sigma = ewmaSigmaSeries(rets);
  const { rows, lastRow } = buildFeatures(prices, rets);
  const rowByTarget = new Map<number, FeatRow>(rows.map((r) => [r.idx + 1, r]));

  // ----- Fold layout -----
  const folds: { ts: number; te: number }[] = [];
  if (n >= 420) {
    for (let k = 3; k >= 1; k--) folds.push({ ts: n - 60 * k, te: n - 60 * (k - 1) });
  } else {
    folds.push({ ts: Math.max(Math.floor(n * 0.8), 120), te: n });
  }
  const testTargets: number[] = [];
  for (const f of folds) for (let t = f.ts; t < f.te; t++) testTargets.push(t);

  // ----- Walk-forward evaluation -----
  const keys: ('drift' | 'ar' | 'holt' | 'reg')[] = ['drift', 'ar', 'holt', 'reg'];
  const preds: Record<string, Map<number, number>> = { naive: new Map(), drift: new Map(), ar: new Map(), holt: new Map(), reg: new Map(), ensemble: new Map() };
  const foldStability: { period: string; dirAcc: number | null }[] = [];

  for (const f of folds) {
    const valLen = Math.min(60, Math.floor(f.ts / 5));
    const vs = f.ts - valLen;
    const mVal = fitModels(prices, rets, rows, rowByTarget, vs - 1);
    const w = computeWeights(mVal, rets, vs, f.ts);
    const mTest = fitModels(prices, rets, rows, rowByTarget, f.ts - 1);

    let hit = 0;
    let dcnt = 0;
    for (let t = f.ts; t < f.te; t++) {
      preds.naive!.set(t, 0);
      preds.drift!.set(t, mTest.drift(t));
      preds.ar!.set(t, mTest.ar ? mTest.ar(t) : 0);
      preds.holt!.set(t, mTest.holt(t));
      preds.reg!.set(t, mTest.reg ? mTest.reg(t) : 0);
      const ens = ensemblePred(mTest, w, t);
      preds.ensemble!.set(t, ens);
      const aDir = Math.sign(prices[t]! - prices[t - 1]!);
      if (aDir !== 0 && w.entries.length) { dcnt++; if (Math.sign(ens) === aDir) hit++; }
    }
    foldStability.push({
      period: `${dates[f.ts]!.slice(5)}–${dates[f.te - 1]!.slice(5)}`,
      dirAcc: dcnt ? round((hit / dcnt) * 100, 1) : null
    });
  }

  const metrics: Record<ModelKey, Metric> = {
    naive: metricFromRets(preds.naive!, prices, testTargets, false),
    drift: metricFromRets(preds.drift!, prices, testTargets, true),
    ar: metricFromRets(preds.ar!, prices, testTargets, true),
    holt: metricFromRets(preds.holt!, prices, testTargets, true),
    reg: metricFromRets(preds.reg!, prices, testTargets, true),
    ensemble: metricFromRets(preds.ensemble!, prices, testTargets, true)
  };

  let ups = 0;
  let downs = 0;
  for (const t of testTargets) {
    if (prices[t]! > prices[t - 1]!) ups++;
    else if (prices[t]! < prices[t - 1]!) downs++;
  }
  const baselineDirAcc = ups + downs ? round((Math.max(ups, downs) / (ups + downs)) * 100, 1) : 50;

  let best: ModelKey = 'naive';
  (Object.keys(metrics) as ModelKey[]).forEach((k) => { if (metrics[k].rmse < metrics[best].rmse) best = k; });

  // ----- Full-data fit for forward projection -----
  const valLenF = Math.min(60, Math.floor(n / 5));
  const vsF = n - valLenF;
  const mValF = fitModels(prices, rets, rows, rowByTarget, vsF - 1);
  const wF = computeWeights(mValF, rets, vsF, n);
  const mFull = fitModels(prices, rets, rows, rowByTarget, n - 1);

  // Next-day expected return (ensemble incl. regression via lastRow)
  let mu1 = 0;
  if (wF.entries.length) {
    for (const e of wF.entries) {
      let r = 0;
      if (e.key === 'drift') r = mFull.drift(n);
      else if (e.key === 'ar') r = mFull.arModel ? arPred(mFull.arModel, rets, n) : 0;
      else if (e.key === 'holt') {
        const f1 = mFull.holtState.level + mFull.holtState.trend;
        r = f1 > 0 ? Math.log(f1 / prices[n - 1]!) : 0;
      } else if (e.key === 'reg') {
        r = mFull.regPredRow && lastRow ? mFull.regPredRow(lastRow) : 0;
      }
      mu1 += e.w * r;
    }
  }

  const sigmaNow = sigma[n - 1]! || 0.01;
  const probUp = round(Phi(mu1 / sigmaNow) * 100, 1);

  // ----- Forward path (multi-step capable models: drift, ar, holt) -----
  const pathKeys = wF.entries.filter((e) => e.key !== 'reg');
  const pathTot = pathKeys.reduce((a, b) => a + b.w, 0);
  const P0 = prices[n - 1]!;
  const retBuf = [...rets];
  const fwdDates = businessDaysAfter(dates[n - 1]!, horizon);
  const forecast: ForecastPoint[] = [];
  let cum = 0;
  let holtPrev = P0;
  for (let h = 1; h <= horizon; h++) {
    let rh = 0;
    if (pathTot > 0) {
      for (const e of pathKeys) {
        let r = 0;
        if (e.key === 'drift') r = mFull.drift(n);
        else if (e.key === 'ar') r = mFull.arModel ? arPred(mFull.arModel, retBuf, n - 1 + h) : 0;
        else if (e.key === 'holt') {
          const ph = Math.max(mFull.holtState.level + h * mFull.holtState.trend, 0.05 * P0);
          r = Math.log(ph / holtPrev);
        }
        rh += (e.w / pathTot) * r;
      }
    }
    holtPrev = Math.max(mFull.holtState.level + h * mFull.holtState.trend, 0.05 * P0);
    retBuf.push(rh);
    cum += rh;
    const band = 1.2816 * sigmaNow * Math.sqrt(h); // ~80% two-sided
    forecast.push({
      date: fwdDates[h - 1]!,
      mean: round(P0 * Math.exp(cum)),
      lower: round(P0 * Math.exp(cum - band)),
      upper: round(P0 * Math.exp(cum + band))
    });
  }

  // ----- Volatility regime -----
  const sigWindow = sigma.slice(Math.max(1, n - 252)).filter((s) => s > 0).sort((a, b) => a - b);
  const sigMed = sigWindow.length ? sigWindow[Math.floor(sigWindow.length / 2)]! : sigmaNow;
  const ratio = sigMed > 0 ? sigmaNow / sigMed : 1;
  const regime: 'rendah' | 'normal' | 'tinggi' = ratio < 0.85 ? 'rendah' : ratio > 1.25 ? 'tinggi' : 'normal';

  // ----- Entry/exit probabilities over horizon -----
  // Drift-adjusted lognormal probabilities (uses mu1 & sigmaNow above).
  const stopPct = round(2 * sigmaNow * 100, 2);   // ≈2σ below
  const targetPct = round(3 * sigmaNow * 100, 2); // ≈3σ above
  const muH = mu1 * horizon;
  const sigmaH = sigmaNow * Math.sqrt(horizon);
  const probDownToStop = sigmaH > 0 ? round(Phi((Math.log(1 - stopPct / 100) - muH) / sigmaH) * 100, 1) : 50;
  const probUpToTarget = sigmaH > 0 ? round(Phi((Math.log(1 + targetPct / 100) - muH) / sigmaH) * 100, 1) : 50;
  const edge: 'positif' | 'negatif' | 'netral' =
    probUpToTarget - probDownToStop >= 10 ? 'positif' :
      probDownToStop - probUpToTarget >= 10 ? 'negatif' : 'netral';

  // ----- Chart series (test window) -----
  const winStart = Math.max(0, n - Math.max(180, testTargets.length));
  const series: SeriesPoint[] = [];
  for (let t = winStart; t < n; t++) {
    const has = preds.ensemble!.has(t);
    series.push({
      date: dates[t]!,
      actual: round(prices[t]!),
      pred: has ? round(prices[t - 1]! * Math.exp(preds.ensemble!.get(t)!)) : null
    });
  }

  const weights = wF.entries.map((e) => ({
    model: e.key === 'ar' ? `AR(${mFull.arOrder || mValF.arOrder})` : MODEL_LABEL[e.key]!,
    weight: round(e.w * 100, 1)
  }));

  return {
    lastPrice: round(P0),
    lastDate: dates[n - 1]!,
    series,
    forecast,
    metrics,
    weights,
    foldStability,
    arOrder: mFull.arOrder,
    best,
    baselineDirAcc,
    nextDay: {
      direction: mu1 >= 0 ? 'up' : 'down',
      expectedReturnPct: round((Math.exp(mu1) - 1) * 100, 2),
      probUp,
      hitRate: metrics.ensemble.dirAcc
    },
    vol: {
      dailyPct: round(sigmaNow * 100, 2),
      annualPct: round(sigmaNow * Math.sqrt(252) * 100, 1),
      regime
    },
    tradeOdds: {
      stopPct,
      targetPct,
      probDownToStop,
      probUpToTarget,
      edge
    },
    trainSize: folds[0]!.ts,
    testSize: testTargets.length,
    horizon
  };
}
