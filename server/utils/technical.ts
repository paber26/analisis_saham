// Technical analysis toolkit used by the stock screener.
// Pure functions over a chronological (oldest -> newest) price series.

export interface Bar {
  close: number;
  high: number;
  low: number;
  volume: number;
}

export type SignalTone = 'bull' | 'bear' | 'warn' | 'neutral';
export interface TechSignal {
  label: string;
  tone: SignalTone;
}

export interface TechResult {
  price: number;
  changePct: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
  stochK: number | null;
  stochD: number | null;
  bbPercentB: number | null;
  bbBandwidth: number | null;
  atrPct: number | null;
  volRatio: number | null;
  high52: number;
  low52: number;
  pctFromHigh: number;
  pctFromLow: number;
  score: number;
  rating: 'Kuat' | 'Menarik' | 'Netral' | 'Lemah';
  signals: TechSignal[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function smaAt(v: number[], period: number, end: number): number | null {
  if (end < period - 1) return null;
  let sum = 0;
  for (let i = end - period + 1; i <= end; i++) sum += v[i]!;
  return sum / period;
}
function sma(v: number[], period: number): number | null {
  return smaAt(v, period, v.length - 1);
}

// Wilder's RSI on the last value.
function rsi(v: number[], period = 14): number | null {
  if (v.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = v[i]! - v[i - 1]!;
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < v.length; i++) {
    const d = v[i]! - v[i - 1]!;
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function emaSeries(v: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = v[0] ?? 0;
  out.push(prev);
  for (let i = 1; i < v.length; i++) {
    prev = v[i]! * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function macdSeries(v: number[]) {
  const ema12 = emaSeries(v, 12);
  const ema26 = emaSeries(v, 26);
  const macdLine = v.map((_, i) => ema12[i]! - ema26[i]!);
  const signalLine = emaSeries(macdLine, 9);
  const hist = macdLine.map((m, i) => m - signalLine[i]!);
  return { macdLine, signalLine, hist };
}

// Stochastic oscillator (%K, %D) on the last bar.
function stochastic(highs: number[], lows: number[], closes: number[], kP = 14, dP = 3) {
  const len = closes.length;
  if (len < kP + dP) return null;
  const kSeries: number[] = [];
  for (let i = kP - 1; i < len; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - kP + 1; j <= i; j++) { hh = Math.max(hh, highs[j]!); ll = Math.min(ll, lows[j]!); }
    kSeries.push(hh === ll ? 50 : ((closes[i]! - ll) / (hh - ll)) * 100);
  }
  const k = kSeries[kSeries.length - 1]!;
  let d = 0;
  for (let i = kSeries.length - dP; i < kSeries.length; i++) d += kSeries[i]!;
  d /= dP;
  const kPrev = kSeries[kSeries.length - 2] ?? k;
  return { k, d, kPrev };
}

// Bollinger Bands (20, 2σ): %B position and bandwidth (squeeze indicator).
function bollinger(closes: number[], period = 20, mult = 2) {
  const len = closes.length;
  if (len < period) return null;
  const slice = closes.slice(len - period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = mean + mult * sd;
  const lower = mean - mult * sd;
  const price = closes[len - 1]!;
  const percentB = upper === lower ? 0.5 : (price - lower) / (upper - lower);
  const bandwidth = mean === 0 ? 0 : (upper - lower) / mean;
  return { percentB, bandwidth };
}

// Average True Range (Wilder, 14) — volatility.
function atr(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  const len = closes.length;
  if (len < period + 1) return null;
  const tr: number[] = [];
  for (let i = 1; i < len; i++) {
    tr.push(Math.max(highs[i]! - lows[i]!, Math.abs(highs[i]! - closes[i - 1]!), Math.abs(lows[i]! - closes[i - 1]!)));
  }
  let a = 0;
  for (let i = 0; i < period; i++) a += tr[i]!;
  a /= period;
  for (let i = period; i < tr.length; i++) a = (a * (period - 1) + tr[i]!) / period;
  return a;
}

// ADX / DMI (Wilder, 14) — trend strength & direction.
function dmi(highs: number[], lows: number[], closes: number[], period = 14) {
  const len = closes.length;
  if (len < period * 2 + 1) return null;
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  for (let i = 1; i < len; i++) {
    const up = highs[i]! - highs[i - 1]!;
    const dn = lows[i - 1]! - lows[i]!;
    plusDM.push(up > dn && up > 0 ? up : 0);
    minusDM.push(dn > up && dn > 0 ? dn : 0);
    tr.push(Math.max(highs[i]! - lows[i]!, Math.abs(highs[i]! - closes[i - 1]!), Math.abs(lows[i]! - closes[i - 1]!)));
  }
  const smooth = (arr: number[]) => {
    const out: number[] = new Array(arr.length).fill(0);
    let s = 0;
    for (let i = 0; i < period; i++) s += arr[i]!;
    out[period - 1] = s;
    for (let i = period; i < arr.length; i++) out[i] = out[i - 1]! - out[i - 1]! / period + arr[i]!;
    return out;
  };
  const trS = smooth(tr);
  const plusS = smooth(plusDM);
  const minusS = smooth(minusDM);
  const dx: number[] = new Array(tr.length).fill(0);
  for (let i = period - 1; i < tr.length; i++) {
    const pDI = trS[i]! ? (100 * plusS[i]!) / trS[i]! : 0;
    const mDI = trS[i]! ? (100 * minusS[i]!) / trS[i]! : 0;
    const denom = pDI + mDI;
    dx[i] = denom ? (100 * Math.abs(pDI - mDI)) / denom : 0;
  }
  const seedStart = period - 1;
  if (tr.length < seedStart + period) return null;
  let adx = 0;
  for (let i = seedStart; i < seedStart + period; i++) adx += dx[i]!;
  adx /= period;
  for (let i = seedStart + period; i < tr.length; i++) adx = (adx * (period - 1) + dx[i]!) / period;
  const last = tr.length - 1;
  const plusDI = trS[last]! ? (100 * plusS[last]!) / trS[last]! : 0;
  const minusDI = trS[last]! ? (100 * minusS[last]!) / trS[last]! : 0;
  return { adx, plusDI, minusDI };
}

/**
 * Full technical analysis + transparent 0-100 buy score.
 * Weights: Trend 35, Momentum 35, Volume/Volatility 15, Position 15.
 */
export function analyzeTechnical(bars: Bar[]): TechResult | null {
  const n = bars.length;
  if (n < 30) return null;

  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const vols = bars.map((b) => b.volume);

  const price = closes[n - 1]!;
  const prevClose = closes[n - 2]!;
  const changePct = prevClose > 0 ? round2(((price - prevClose) / prevClose) * 100) : 0;

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const rsiVal = rsi(closes, 14);

  const { macdLine, signalLine, hist } = macdSeries(closes);
  const macd = macdLine[n - 1]!;
  const macdSignal = signalLine[n - 1]!;
  const macdHist = hist[n - 1]!;
  const bullishCross = macdHist > 0 && (hist[n - 2] ?? 0) <= 0;
  const bearishCross = macdHist < 0 && (hist[n - 2] ?? 0) >= 0;

  const stoch = stochastic(highs, lows, closes);
  const bb = bollinger(closes);
  const atrVal = atr(highs, lows, closes);
  const dmiVal = dmi(highs, lows, closes);

  let volRatio: number | null = null;
  if (n >= 21) {
    let s = 0;
    for (let i = n - 21; i < n - 1; i++) s += vols[i]!;
    const avg = s / 20;
    volRatio = avg > 0 ? round2(vols[n - 1]! / avg) : null;
  }

  const win = Math.min(252, n);
  const high52 = Math.max(...highs.slice(n - win));
  const low52 = Math.min(...lows.slice(n - win));
  const pctFromHigh = high52 > 0 ? round2(((price - high52) / high52) * 100) : 0;
  const pctFromLow = low52 > 0 ? round2(((price - low52) / low52) * 100) : 0;

  const sma50Now = smaAt(closes, 50, n - 1);
  const sma200Now = smaAt(closes, 200, n - 1);
  const sma50Prev = smaAt(closes, 50, n - 8);
  const sma200Prev = smaAt(closes, 200, n - 8);
  const goldenCross = sma50Now != null && sma200Now != null && sma50Prev != null && sma200Prev != null && sma50Now > sma200Now && sma50Prev <= sma200Prev;
  const deathCross = sma50Now != null && sma200Now != null && sma50Prev != null && sma200Prev != null && sma50Now < sma200Now && sma50Prev >= sma200Prev;

  const signals: TechSignal[] = [];
  let score = 0;

  // --- Trend (35) ---
  if (sma200 != null) {
    if (price > sma200) { score += 14; signals.push({ label: 'Di atas MA200', tone: 'bull' }); }
    else signals.push({ label: 'Di bawah MA200', tone: 'bear' });
  }
  if (sma50 != null && sma200 != null && sma50 > sma200) score += 9;
  if (sma20 != null && price > sma20) score += 5;
  if (dmiVal) {
    if (dmiVal.adx >= 25 && dmiVal.plusDI > dmiVal.minusDI) { score += 7; signals.push({ label: `Tren kuat (ADX ${Math.round(dmiVal.adx)})`, tone: 'bull' }); }
    else if (dmiVal.adx >= 25 && dmiVal.minusDI > dmiVal.plusDI) signals.push({ label: `Downtrend kuat (ADX ${Math.round(dmiVal.adx)})`, tone: 'bear' });
  }
  if (goldenCross) signals.push({ label: 'Golden Cross', tone: 'bull' });
  if (deathCross) signals.push({ label: 'Death Cross', tone: 'bear' });

  // --- Momentum (35) ---
  if (rsiVal != null) {
    if (rsiVal >= 35 && rsiVal < 40) { score += 14; signals.push({ label: `RSI ${Math.round(rsiVal)} (zona beli)`, tone: 'bull' }); }
    else if (rsiVal >= 40 && rsiVal <= 60) score += 11;
    else if (rsiVal > 60 && rsiVal <= 70) score += 7;
    else if (rsiVal >= 30 && rsiVal < 35) { score += 9; signals.push({ label: `RSI ${Math.round(rsiVal)}`, tone: 'warn' }); }
    else if (rsiVal < 30) { score += 6; signals.push({ label: `RSI ${Math.round(rsiVal)} (oversold)`, tone: 'warn' }); }
    else if (rsiVal > 70) { score += 2; signals.push({ label: `RSI ${Math.round(rsiVal)} (overbought)`, tone: 'bear' }); }
  }
  if (macd > macdSignal) score += 9;
  if (bullishCross) { score += 4; signals.push({ label: 'MACD golden cross', tone: 'bull' }); }
  if (bearishCross) signals.push({ label: 'MACD bearish cross', tone: 'bear' });
  if (stoch) {
    if (stoch.k < 20 && stoch.k > stoch.d) { score += 8; signals.push({ label: 'Stoch oversold naik', tone: 'bull' }); }
    else if (stoch.k > stoch.d && stoch.k < 80) score += 5;
    else if (stoch.k > 80) signals.push({ label: 'Stoch overbought', tone: 'bear' });
  }

  // --- Volume & Volatility (15) ---
  if (volRatio != null && volRatio >= 1.5) { score += 8; signals.push({ label: `Volume ${volRatio}x`, tone: 'bull' }); }
  else if (volRatio != null && volRatio >= 1.1) score += 5;
  if (bb) {
    if (bb.percentB > 1) { score += 7; signals.push({ label: 'Breakout Bollinger', tone: 'bull' }); }
    else if (bb.bandwidth < 0.1) { score += 4; signals.push({ label: 'BB squeeze', tone: 'warn' }); }
    else if (bb.percentB < 0) score += 2;
  }

  // --- Position (15) ---
  if (pctFromHigh >= -8) { score += 10; signals.push({ label: 'Dekat 52w high', tone: 'bull' }); }
  else if (pctFromLow <= 8) { score += 2; signals.push({ label: 'Dekat 52w low', tone: 'bear' }); }
  if (n >= 6 && price > closes[n - 6]!) score += 5;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const rating: TechResult['rating'] = score >= 70 ? 'Kuat' : score >= 55 ? 'Menarik' : score >= 40 ? 'Netral' : 'Lemah';

  return {
    price: round2(price),
    changePct,
    sma20: sma20 != null ? round2(sma20) : null,
    sma50: sma50 != null ? round2(sma50) : null,
    sma200: sma200 != null ? round2(sma200) : null,
    rsi: rsiVal != null ? round2(rsiVal) : null,
    macd: round2(macd),
    macdSignal: round2(macdSignal),
    macdHist: round2(macdHist),
    adx: dmiVal ? round2(dmiVal.adx) : null,
    plusDI: dmiVal ? round2(dmiVal.plusDI) : null,
    minusDI: dmiVal ? round2(dmiVal.minusDI) : null,
    stochK: stoch ? round2(stoch.k) : null,
    stochD: stoch ? round2(stoch.d) : null,
    bbPercentB: bb ? round2(bb.percentB) : null,
    bbBandwidth: bb ? round2(bb.bandwidth) : null,
    atrPct: atrVal != null && price > 0 ? round2((atrVal / price) * 100) : null,
    volRatio,
    high52: round2(high52),
    low52: round2(low52),
    pctFromHigh,
    pctFromLow,
    score,
    rating,
    signals
  };
}
