import { getQuery, defineEventHandler, createError } from 'h3';
import { fetchDailyBars } from '../../utils/yahoo';
import { analyzeTechnical } from '../../utils/technical';
import { shortHash, tradingDay } from '../../utils/cacheKey';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface RegimePoint { date: string; close: number; ma20: number | null; ma50: number | null }
export interface RegimeResponse {
  date: string;
  price: number;
  changePct: number;
  score: number;
  rating: string;
  sma20: number | null; sma50: number | null; sma200: number | null;
  rsi: number | null; adx: number | null;
  pctFromHigh: number;
  ret1m: number | null; ret3m: number | null; ret6m: number | null;
  aboveMa50: boolean; ma50AboveMa200: boolean;
  regime: 'bull' | 'bear' | 'sideways';
  label: string;
  confidence: number;      // 0..100 heuristic
  stance: { cutloss: string; note: string };
  action: { verdict: string; tone: 'emerald' | 'rose' | 'amber'; detail: string; allocation: string };
  series: RegimePoint[];   // last ~130 bars up to T, for charting
}

function smaSeries(v: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i]!;
    if (i >= period) sum -= v[i - period]!;
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

function rangeForDate(dateT: string): '2y' | '5y' | '10y' {
  const yearsAgo = (Date.now() - new Date(dateT).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (yearsAgo <= 0.8) return '2y';
  if (yearsAgo <= 3.8) return '5y';
  return '10y';
}

// IHSG regime (bull / bear / sideways) as of a past date — no lookahead.
const cached = defineCachedFunction(
  async (date: string): Promise<RegimeResponse> => {
    const fetched = await fetchDailyBars('^JKSE', rangeForDate(date), false);
    const upto = (fetched?.bars || []).filter((b) => b.date <= date);
    if (upto.length < 60) throw createError({ statusCode: 400, statusMessage: 'histori IHSG tidak cukup untuk tanggal ini' });

    const tech = analyzeTechnical(upto);
    if (!tech) throw createError({ statusCode: 500, statusMessage: 'gagal menganalisa IHSG' });

    const closes = upto.map((b) => b.close);
    const n = closes.length - 1;
    const ret = (k: number) => (n - k >= 0 ? (closes[n]! / closes[n - k]! - 1) * 100 : null);
    const ret1m = ret(21), ret3m = ret(63), ret6m = ret(126);

    const price = tech.price, ma50 = tech.sma50, ma200 = tech.sma200;
    const aboveMa50 = ma50 != null && price > ma50;
    const ma50AboveMa200 = ma50 != null && ma200 != null && ma50 > ma200;

    // Classification: combine MA structure + 3-month momentum.
    let regime: RegimeResponse['regime'] = 'sideways';
    if (aboveMa50 && ma50AboveMa200 && (ret3m ?? 0) > 1) regime = 'bull';
    else if (!aboveMa50 && ma50 != null && ma200 != null && ma50 < ma200 && (ret3m ?? 0) < -1) regime = 'bear';

    // Confidence: how many signals agree.
    let bull = 0, bear = 0;
    if (aboveMa50) bull++; else bear++;
    if (ma50AboveMa200) bull++; else bear++;
    if ((ret3m ?? 0) > 0) bull++; else bear++;
    if ((ret1m ?? 0) > 0) bull++; else bear++;
    if ((tech.rsi ?? 50) > 50) bull++; else bear++;
    const confidence = Math.round((Math.max(bull, bear) / 5) * 100);

    const label = regime === 'bull' ? 'Pasar Menanjak (Bull)' : regime === 'bear' ? 'Pasar Menurun (Bear)' : 'Pasar Menyamping (Sideways)';
    const stance = regime === 'bull'
      ? { cutloss: 'Longgar (−12% s/d trailing 12–15%)', note: 'Tren naik — biarkan pemenang jalan; stop ketat rawan whipsaw & memangkas return.' }
      : regime === 'bear'
      ? { cutloss: 'Ketat (−5% atau trailing 8%)', note: 'Tren turun — prioritaskan jaga modal; memotong rugi dini terbukti unggul (alpha positif).' }
      : { cutloss: 'Moderat (−8%)', note: 'Pasar menyamping paling menyulitkan stop; waspada whipsaw, seleksi saham lebih penting.' };

    // Market-timing verdict: worth entering, be selective, or step aside to cash.
    const action = regime === 'bull'
      ? { verdict: 'LAYAK MASUK', tone: 'emerald' as const, detail: 'Tren naik & struktur MA positif — akumulasi bertahap boleh lebih agresif; ikuti tren.', allocation: '80–100% saham' }
      : regime === 'bear'
      ? { verdict: 'KELUAR / TUNGGU DI KAS', tone: 'rose' as const, detail: 'Tren turun — kurangi eksposur, prioritaskan kas, dan tunggu konfirmasi pembalikan sebelum masuk lagi.', allocation: '0–30% saham (banyak kas)' }
      : { verdict: 'MASUK SELEKTIF', tone: 'amber' as const, detail: 'Pasar menyamping — hanya saham terkuat, posisi lebih kecil, siap cut-loss cepat bila salah arah.', allocation: '30–60% saham' };

    const ma20s = smaSeries(closes, 20), ma50s = smaSeries(closes, 50);
    const tail = 130;
    const start = Math.max(0, upto.length - tail);
    const series: RegimePoint[] = [];
    for (let i = start; i < upto.length; i++) series.push({ date: upto[i]!.date, close: upto[i]!.close, ma20: ma20s[i]!, ma50: ma50s[i]! });

    return {
      date, price, changePct: tech.changePct, score: tech.score, rating: tech.rating,
      sma20: tech.sma20, sma50: tech.sma50, sma200: tech.sma200, rsi: tech.rsi, adx: tech.adx,
      pctFromHigh: tech.pctFromHigh, ret1m, ret3m, ret6m, aboveMa50, ma50AboveMa200,
      regime, label, confidence, stance, action, series
    };
  },
  { maxAge: 60 * 60 * 24 * 30, swr: true, name: 'sim-regime', getKey: (date: string) => `${date}:${shortHash('jkse')}:${tradingDay()}` }
);

export default defineEventHandler(async (event): Promise<RegimeResponse> => {
  const query = getQuery(event);
  const date = (query.date as string) || '';
  if (!DATE_RE.test(date)) throw createError({ statusCode: 400, statusMessage: 'date wajib format YYYY-MM-DD' });
  if (date >= new Date().toISOString().split('T')[0]!) throw createError({ statusCode: 400, statusMessage: 'date harus di masa lalu' });
  return cached(date);
});
