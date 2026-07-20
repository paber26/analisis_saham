// Forecasting toolkit (Tier 1, pure TypeScript).
// Models: Naive (baseline), Holt linear (trend), Ridge regression on technical
// features. Evaluated with a chronological train/test split and walk-forward
// one-step-ahead predictions — no shuffling, no look-ahead leakage.

export interface PricePoint { date: string; close: number; }

export interface Metric {
  rmse: number;
  mae: number;
  mape: number;       // %
  dirAcc: number | null; // directional accuracy %, null for models w/o direction
}

export interface SeriesPoint {
  date: string;
  actual: number;
  holt: number | null; // out-of-sample one-step prediction
  reg: number | null;
}

export interface ForecastPoint { date: string; mean: number; lower: number; upper: number; }

export interface ForecastResult {
  lastPrice: number;
  lastDate: string;
  series: SeriesPoint[];
  forecast: ForecastPoint[];
  metrics: { naive: Metric; holt: Metric; reg: Metric };
  baselineDirAcc: number; // majority up/down rate on test (bar for direction)
  best: 'naive' | 'holt' | 'reg';
  nextDay: { direction: 'up' | 'down'; expectedReturnPct: number; hitRate: number | null };
  trainSize: number;
  testSize: number;
  horizon: number;
}

const round = (n: number, d = 2) => {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
};

function mean(v: number[]): number {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}
function std(v: number[]): number {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
}

// ---------- Indicator series (for regression features) ----------
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
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < n; i++) {
    const d = closes[i]! - closes[i - 1]!;
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
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
  const signal = emaArr(macd, 9);
  return macd.map((m, i) => m - signal[i]!);
}
function smaAt(v: number[], p: number, end: number): number {
  let s = 0;
  for (let i = end - p + 1; i <= end; i++) s += v[i]!;
  return s / p;
}

// ---------- Holt's linear (double exponential smoothing) ----------
function holtRun(prices: number[], alpha: number, beta: number) {
  const n = prices.length;
  let level = prices[0]!;
  let trend = prices[1]! - prices[0]!;
  const fc: number[] = new Array(n).fill(NaN); // fc[t] = one-step forecast for t (made at t-1)
  for (let t = 1; t < n; t++) {
    fc[t] = level + trend;
    const prevLevel = level;
    level = alpha * prices[t]! + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  return { fc, level, trend };
}

function optimizeHolt(prices: number[], trainEnd: number) {
  let best = { alpha: 0.5, beta: 0.1, rmse: Infinity };
  for (let a = 0.1; a <= 0.9; a += 0.1) {
    for (let b = 0.05; b <= 0.6; b += 0.05) {
      const { fc } = holtRun(prices, a, b);
      let se = 0;
      let cnt = 0;
      for (let t = 2; t <= trainEnd; t++) {
        if (!isNaN(fc[t]!)) { se += (fc[t]! - prices[t]!) ** 2; cnt++; }
      }
      const rmse = cnt ? Math.sqrt(se / cnt) : Infinity;
      if (rmse < best.rmse) best = { alpha: a, beta: b, rmse };
    }
  }
  return best;
}

// ---------- Small linear algebra for ridge regression ----------
function invert(m: number[][]): number[][] | null {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r]![col]!) > Math.abs(a[piv]![col]!)) piv = r;
    if (Math.abs(a[piv]![col]!) < 1e-12) return null;
    [a[col], a[piv]] = [a[piv]!, a[col]!];
    const pivVal = a[col]![col]!;
    for (let j = 0; j < 2 * n; j++) a[col]![j]! /= pivVal;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r]![col]!;
      for (let j = 0; j < 2 * n; j++) a[r]![j]! -= factor * a[col]![j]!;
    }
  }
  return a.map((row) => row.slice(n));
}

// Ridge regression with intercept (intercept not penalised). X: rows of features
// WITHOUT intercept; features already standardised.
function ridgeFit(X: number[][], y: number[], lambda: number): number[] | null {
  const rows = X.length;
  if (rows === 0) return null;
  const k = X[0]!.length;
  const p = k + 1;
  // Augment with intercept column
  const Xa = X.map((r) => [1, ...r]);
  // X'X
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const Xty: number[] = new Array(p).fill(0);
  for (let i = 0; i < rows; i++) {
    const xi = Xa[i]!;
    for (let a = 0; a < p; a++) {
      Xty[a]! += xi[a]! * y[i]!;
      for (let b = 0; b < p; b++) XtX[a]![b]! += xi[a]! * xi[b]!;
    }
  }
  for (let d = 1; d < p; d++) XtX[d]![d]! += lambda; // skip intercept
  const inv = invert(XtX);
  if (!inv) return null;
  const beta: number[] = new Array(p).fill(0);
  for (let a = 0; a < p; a++) {
    let s = 0;
    for (let b = 0; b < p; b++) s += inv[a]![b]! * Xty[b]!;
    beta[a] = s;
  }
  return beta; // [intercept, ...coefs]
}

// ---------- Feature engineering ----------
const FEATURE_START = 30; // need history for RSI/MACD

function buildFeatures(prices: number[]) {
  const n = prices.length;
  const rets: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) rets[i] = Math.log(prices[i]! / prices[i - 1]!);
  const rsi = rsiSeries(prices, 14);
  const macdH = macdHistSeries(prices);

  const rows: { idx: number; f: number[]; y: number }[] = [];
  // target index t+1; features use info up to t
  for (let t = FEATURE_START; t < n - 1; t++) {
    const rsiv = rsi[t];
    if (rsiv == null) continue;
    const mom5 = rets.slice(t - 4, t + 1).reduce((a, b) => a + b, 0);
    const sma10 = smaAt(prices, 10, t);
    const f = [
      rets[t]!,
      rets[t - 1]!,
      mom5,
      (rsiv - 50) / 50,
      macdH[t]! / prices[t]!,
      prices[t]! / sma10 - 1
    ];
    rows.push({ idx: t, f, y: rets[t + 1]! });
  }
  // Feature row to predict the NEXT (unobserved) day, using the last index
  let lastRow: number[] | null = null;
  const tl = n - 1;
  if (rsi[tl] != null) {
    const mom5 = rets.slice(tl - 4, tl + 1).reduce((a, b) => a + b, 0);
    const sma10 = smaAt(prices, 10, tl);
    lastRow = [rets[tl]!, rets[tl - 1]!, mom5, (rsi[tl]! - 50) / 50, macdH[tl]! / prices[tl]!, prices[tl]! / sma10 - 1];
  }
  return { rows, lastRow };
}

function standardize(rows: number[][], trainCount: number) {
  const k = rows[0]!.length;
  const mu = new Array(k).fill(0);
  const sd = new Array(k).fill(1);
  for (let c = 0; c < k; c++) {
    const col = rows.slice(0, trainCount).map((r) => r[c]!);
    mu[c] = mean(col);
    sd[c] = std(col) || 1;
  }
  const apply = (r: number[]) => r.map((v, c) => (v - mu[c]) / sd[c]);
  return { apply };
}

// ---------- Metrics ----------
function computeMetrics(pred: number[], actual: number[], prevActual: number[], withDir: boolean): Metric {
  const n = pred.length;
  let se = 0;
  let ae = 0;
  let ape = 0;
  let dirHit = 0;
  let dirCnt = 0;
  for (let i = 0; i < n; i++) {
    const e = pred[i]! - actual[i]!;
    se += e * e;
    ae += Math.abs(e);
    if (actual[i] !== 0) ape += Math.abs(e / actual[i]!);
    if (withDir) {
      const pDir = Math.sign(pred[i]! - prevActual[i]!);
      const aDir = Math.sign(actual[i]! - prevActual[i]!);
      if (aDir !== 0) { dirCnt++; if (pDir === aDir) dirHit++; }
    }
  }
  return {
    rmse: round(Math.sqrt(se / n)),
    mae: round(ae / n),
    mape: round((ape / n) * 100),
    dirAcc: withDir && dirCnt ? round((dirHit / dirCnt) * 100, 1) : null
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

/**
 * Main entry: build models, backtest, and forecast `horizon` business days.
 */
export function runForecast(points: PricePoint[], horizon = 14): ForecastResult | null {
  const clean = points.filter((p) => p.close > 0);
  if (clean.length < 150) return null;

  const prices = clean.map((p) => p.close);
  const dates = clean.map((p) => p.date);
  const n = prices.length;
  const trainEnd = Math.floor(n * 0.8); // last index of train (inclusive)
  const testStart = trainEnd + 1;
  const trainSize = trainEnd + 1;
  const testSize = n - testStart;

  // ----- Holt -----
  const { alpha, beta } = optimizeHolt(prices, trainEnd);
  const holt = holtRun(prices, alpha, beta);
  const holtResiduals: number[] = [];
  for (let t = 2; t <= trainEnd; t++) if (!isNaN(holt.fc[t]!)) holtResiduals.push(holt.fc[t]! - prices[t]!);
  const resStd = std(holtResiduals) || 1;

  // ----- Regression -----
  const { rows, lastRow } = buildFeatures(prices);
  const trainRows = rows.filter((r) => r.idx + 1 <= trainEnd);
  const stdz = standardize(rows.map((r) => r.f), trainRows.length || rows.length);
  const Xtrain = trainRows.map((r) => stdz.apply(r.f));
  const yTrain = trainRows.map((r) => r.y);
  const beta_ = ridgeFit(Xtrain, yTrain, 1.0);

  // Predicted next-day close for each row (out-of-sample where idx in test)
  const regPredClose = new Map<number, number>(); // target index (idx+1) -> predicted close
  if (beta_) {
    for (const r of rows) {
      const z = stdz.apply(r.f);
      let yhat = beta_[0]!;
      for (let j = 0; j < z.length; j++) yhat += beta_[j + 1]! * z[j]!;
      regPredClose.set(r.idx + 1, prices[r.idx]! * Math.exp(yhat));
    }
  }

  // ----- Backtest metrics on the test window -----
  const naiveP: number[] = [];
  const holtP: number[] = [];
  const regP: number[] = [];
  const act: number[] = [];
  const prev: number[] = [];
  let ups = 0;
  for (let t = testStart; t < n; t++) {
    act.push(prices[t]!);
    prev.push(prices[t - 1]!);
    naiveP.push(prices[t - 1]!);            // random walk
    holtP.push(isNaN(holt.fc[t]!) ? prices[t - 1]! : holt.fc[t]!);
    regP.push(regPredClose.get(t) ?? prices[t - 1]!);
    if (prices[t]! > prices[t - 1]!) ups++;
  }
  const metrics = {
    naive: computeMetrics(naiveP, act, prev, false),
    holt: computeMetrics(holtP, act, prev, true),
    reg: computeMetrics(regP, act, prev, true)
  };
  const baselineDirAcc = testSize ? round((Math.max(ups, testSize - ups) / testSize) * 100, 1) : 50;

  // Best model by RMSE
  let best: 'naive' | 'holt' | 'reg' = 'naive';
  if (metrics.holt.rmse <= metrics.naive.rmse && metrics.holt.rmse <= metrics.reg.rmse) best = 'holt';
  else if (metrics.reg.rmse <= metrics.naive.rmse && metrics.reg.rmse <= metrics.holt.rmse) best = 'reg';

  // ----- Forward forecast (Holt trend + widening band) -----
  const fwdDates = businessDaysAfter(dates[n - 1]!, horizon);
  const forecast: ForecastPoint[] = fwdDates.map((d, i) => {
    const h = i + 1;
    const meanV = holt.level + h * holt.trend;
    const band = 1.28 * resStd * Math.sqrt(h); // ~80% interval
    return { date: d, mean: round(meanV), lower: round(Math.max(0, meanV - band)), upper: round(meanV + band) };
  });

  // ----- Next-day directional call (regression) -----
  let expectedReturnPct = 0;
  if (beta_ && lastRow) {
    const z = stdz.apply(lastRow);
    let yhat = beta_[0]!;
    for (let j = 0; j < z.length; j++) yhat += beta_[j + 1]! * z[j]!;
    expectedReturnPct = round((Math.exp(yhat) - 1) * 100, 2);
  }
  const nextDay = {
    direction: (expectedReturnPct >= 0 ? 'up' : 'down') as 'up' | 'down',
    expectedReturnPct,
    hitRate: metrics.reg.dirAcc
  };

  // ----- Chart series: last ~180 actual + out-of-sample predictions -----
  const windowStart = Math.max(0, n - 180);
  const series: SeriesPoint[] = [];
  for (let t = windowStart; t < n; t++) {
    const inTest = t >= testStart;
    series.push({
      date: dates[t]!,
      actual: round(prices[t]!),
      holt: inTest && !isNaN(holt.fc[t]!) ? round(holt.fc[t]!) : null,
      reg: inTest && regPredClose.has(t) ? round(regPredClose.get(t)!) : null
    });
  }

  return {
    lastPrice: round(prices[n - 1]!),
    lastDate: dates[n - 1]!,
    series,
    forecast,
    metrics,
    baselineDirAcc,
    best,
    nextDay,
    trainSize,
    testSize,
    horizon
  };
}
