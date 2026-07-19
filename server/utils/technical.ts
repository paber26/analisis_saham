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

// Simple moving average ending at `end` (inclusive). null if not enough data.
function smaAt(v: number[], period: number, end: number): number | null {
  if (end < period - 1) return null;
  let sum = 0;
  for (let i = end - period + 1; i <= end; i++) sum += v[i]!;
  return sum / period;
}

function sma(v: number[], period: number): number | null {
  return smaAt(v, period, v.length - 1);
}

// Wilder's RSI on the last value of the series.
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
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Exponential moving average series (seeded with the first value).
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

/**
 * Run the full technical analysis and produce a transparent 0-100 buy score.
 * Weights: Trend 40, Momentum 35, Volume/Position 25.
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
  const macdHistPrev = hist[n - 2] ?? 0;
  const bullishCross = macdHist > 0 && macdHistPrev <= 0;
  const bearishCross = macdHist < 0 && macdHistPrev >= 0;

  // Volume ratio: last volume vs average of previous 20 sessions
  let volRatio: number | null = null;
  if (n >= 21) {
    let s = 0;
    for (let i = n - 21; i < n - 1; i++) s += vols[i]!;
    const avg = s / 20;
    volRatio = avg > 0 ? round2(vols[n - 1]! / avg) : null;
  }

  // 52-week window (last ~252 trading days)
  const win = Math.min(252, n);
  const high52 = Math.max(...highs.slice(n - win));
  const low52 = Math.min(...lows.slice(n - win));
  const pctFromHigh = high52 > 0 ? round2(((price - high52) / high52) * 100) : 0;
  const pctFromLow = low52 > 0 ? round2(((price - low52) / low52) * 100) : 0;

  // Golden / death cross (recent = crossed within the last ~7 sessions)
  const sma50Now = smaAt(closes, 50, n - 1);
  const sma200Now = smaAt(closes, 200, n - 1);
  const sma50Prev = smaAt(closes, 50, n - 8);
  const sma200Prev = smaAt(closes, 200, n - 8);
  const goldenCross =
    sma50Now != null && sma200Now != null && sma50Prev != null && sma200Prev != null &&
    sma50Now > sma200Now && sma50Prev <= sma200Prev;
  const deathCross =
    sma50Now != null && sma200Now != null && sma50Prev != null && sma200Prev != null &&
    sma50Now < sma200Now && sma50Prev >= sma200Prev;

  const signals: TechSignal[] = [];
  let score = 0;

  // --- Trend (max 40) ---
  if (sma200 != null) {
    if (price > sma200) { score += 18; signals.push({ label: 'Di atas MA200', tone: 'bull' }); }
    else { signals.push({ label: 'Di bawah MA200', tone: 'bear' }); }
  }
  if (sma50 != null && sma200 != null && sma50 > sma200) score += 12;
  if (sma20 != null && price > sma20) score += 10;

  // --- Momentum (max 35) ---
  if (rsiVal != null) {
    if (rsiVal >= 35 && rsiVal < 45) { score += 18; signals.push({ label: `RSI ${Math.round(rsiVal)} (zona beli)`, tone: 'bull' }); }
    else if (rsiVal >= 45 && rsiVal <= 60) { score += 14; }
    else if (rsiVal > 60 && rsiVal <= 70) { score += 8; }
    else if (rsiVal < 35 && rsiVal >= 30) { score += 12; signals.push({ label: `RSI ${Math.round(rsiVal)}`, tone: 'warn' }); }
    else if (rsiVal < 30) { score += 8; signals.push({ label: `RSI ${Math.round(rsiVal)} (oversold)`, tone: 'warn' }); }
    else if (rsiVal > 70) { score += 2; signals.push({ label: `RSI ${Math.round(rsiVal)} (overbought)`, tone: 'bear' }); }
  }
  if (macd > macdSignal) score += 12;
  if (bullishCross) { score += 5; signals.push({ label: 'MACD golden cross', tone: 'bull' }); }
  if (bearishCross) { signals.push({ label: 'MACD bearish cross', tone: 'bear' }); }

  // --- Volume / Position (max 25) ---
  if (volRatio != null && volRatio >= 1.5) { score += 10; signals.push({ label: `Volume ${volRatio}x`, tone: 'bull' }); }
  else if (volRatio != null && volRatio >= 1.1) { score += 6; }
  if (pctFromHigh >= -8) { score += 10; signals.push({ label: 'Dekat 52w high', tone: 'bull' }); }
  else if (pctFromLow <= 8) { score += 3; signals.push({ label: 'Dekat 52w low', tone: 'bear' }); }
  if (n >= 6 && price > closes[n - 6]!) score += 5;

  if (goldenCross) signals.push({ label: 'Golden Cross', tone: 'bull' });
  if (deathCross) signals.push({ label: 'Death Cross', tone: 'bear' });

  score = Math.max(0, Math.min(100, Math.round(score)));
  const rating: TechResult['rating'] =
    score >= 70 ? 'Kuat' : score >= 55 ? 'Menarik' : score >= 40 ? 'Netral' : 'Lemah';

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
