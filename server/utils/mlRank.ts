// Pooled cross-sectional ranking model (pure): one gradient-boosted model
// trained on ALL stocks at once to rank them by expected 20-day return
// relative to IHSG. Price/volume features only — point-in-time fundamentals
// are not available, and using today's fundamentals in the past would leak.
//
// - Sampling every `step` trading days on the IHSG calendar so cross-sections
//   align across stocks; features and target are percentile-ranked within each
//   date (the model learns relative position, robust to market regimes).
// - Walk-forward by time with an embargo of `horizon` days between the last
//   training label and the test block (no overlap leakage).
// - Evaluation = rank IC (Spearman per date) with a t-stat on the effective
//   number of independent dates (labels overlap when step < horizon), plus the
//   realized top-minus-bottom quintile spread.

import { trainGbdtAsync, predictGbdt, type GbdtParams } from './gbdt';

export interface MlBar { date: string; close: number; volume: number }
export interface MlSeries { code: string; bars: MlBar[] }

export const ML_FEATURES: { key: string; label: string }[] = [
  { key: 'ret5', label: 'Return 5 hari' },
  { key: 'ret20', label: 'Return 20 hari' },
  { key: 'ret60', label: 'Return 60 hari' },
  { key: 'ret120', label: 'Return 120 hari' },
  { key: 'vol20', label: 'Volatilitas 20 hari' },
  { key: 'rsi14', label: 'RSI 14' },
  { key: 'distMa50', label: 'Jarak dari MA50' },
  { key: 'distMa200', label: 'Jarak dari MA200' },
  { key: 'absVol', label: 'Volume abnormal' },
  { key: 'logValue20', label: 'Nilai transaksi (likuiditas)' },
  { key: 'rel20', label: 'Kekuatan relatif IHSG 20h' },
  { key: 'rel60', label: 'Kekuatan relatif IHSG 60h' },
  { key: 'dd52', label: 'Jarak dari puncak 52 minggu' }
];

export interface MlRow {
  code: string;
  date: string;
  dateIdx: number;      // index in the sampled calendar
  x: number[];          // features, percentile-ranked within the date
  exRet: number | null; // realized forward log excess return vs IHSG
  y: number | null;     // exRet percentile within the date (target)
}

const MIN_HISTORY = 200;

function rsiSeries(c: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(c.length).fill(null);
  if (c.length <= period) return out;
  let g = 0;
  let l = 0;
  for (let i = 1; i <= period; i++) { const d = c[i]! - c[i - 1]!; if (d >= 0) g += d; else l -= d; }
  let ag = g / period;
  let al = l / period;
  out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < c.length; i++) {
    const d = c[i]! - c[i - 1]!;
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}

/** Raw (un-ranked) features at bar i, or null when history is too short. */
function featuresAt(c: number[], v: number[], rsi: (number | null)[], ihsgAt: (i: number) => number | null, i: number): number[] | null {
  if (i < MIN_HISTORY) return null;
  const lr = (k: number) => Math.log(c[i]! / c[i - k]!);
  const iNow = ihsgAt(i);
  const i20 = ihsgAt(i - 20);
  const i60 = ihsgAt(i - 60);
  if (iNow == null || i20 == null || i60 == null) return null;
  let s = 0;
  let s2 = 0;
  for (let k = i - 19; k <= i; k++) { const r = Math.log(c[k]! / c[k - 1]!); s += r; s2 += r * r; }
  const vol20 = Math.sqrt(Math.max(0, s2 / 20 - (s / 20) ** 2));
  let m50 = 0;
  for (let k = i - 49; k <= i; k++) m50 += c[k]!;
  m50 /= 50;
  let m200 = 0;
  for (let k = i - 199; k <= i; k++) m200 += c[k]!;
  m200 /= 200;
  let vm = 0;
  let val = 0;
  for (let k = i - 19; k <= i; k++) { vm += v[k]!; val += c[k]! * v[k]!; }
  vm /= 20;
  val /= 20;
  let hi = 0;
  for (let k = Math.max(0, i - 251); k <= i; k++) hi = Math.max(hi, c[k]!);
  return [
    lr(5), lr(20), lr(60), lr(120), vol20, rsi[i] ?? 50,
    c[i]! / m50 - 1, c[i]! / m200 - 1,
    v[i]! > 0 && vm > 0 ? Math.log(v[i]! / vm) : 0,
    val > 0 ? Math.log(val) : 0,
    lr(20) - Math.log(iNow / i20), lr(60) - Math.log(iNow / i60),
    hi > 0 ? c[i]! / hi - 1 : 0
  ];
}

/** Percentile ranks (0..1, mid-rank for ties) of a numeric array. */
export function pctRank(vals: number[]): number[] {
  const idx = vals.map((v, i) => i).sort((a, b) => vals[a]! - vals[b]!);
  const out = new Array<number>(vals.length);
  let k = 0;
  while (k < idx.length) {
    let j = k;
    while (j + 1 < idx.length && vals[idx[j + 1]!] === vals[idx[k]!]) j++;
    const r = vals.length > 1 ? ((k + j) / 2) / (vals.length - 1) : 0.5;
    for (let m = k; m <= j; m++) out[idx[m]!] = r;
    k = j + 1;
  }
  return out;
}

export function spearman(a: number[], b: number[]): number | null {
  if (a.length < 3) return null;
  const ra = pctRank(a);
  const rb = pctRank(b);
  const ma = ra.reduce((s, v) => s + v, 0) / ra.length;
  const mb = rb.reduce((s, v) => s + v, 0) / rb.length;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i]! - ma) * (rb[i]! - mb);
    da += (ra[i]! - ma) ** 2;
    db += (rb[i]! - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : null;
}

/**
 * Build the pooled, date-aligned dataset. Rows for the latest calendar date
 * carry exRet = null (to be scored, not trained on).
 */
export function buildDataset(series: MlSeries[], ihsg: { date: string; close: number }[], horizon = 20, step = 5, minPerDate = 20): { rows: MlRow[]; dates: string[] } {
  const cal = ihsg.filter((p) => p.close > 0).map((p) => p.date).sort();
  const ihsgClose = new Map(ihsg.map((p) => [p.date, p.close]));
  // Sampled dates: every `step` days counted back from the latest, so the latest date is always included.
  const sampled = new Set<string>();
  for (let k = cal.length - 1; k >= 0; k -= step) sampled.add(cal[k]!);
  const dates = cal.filter((d) => sampled.has(d));
  const dateIdx = new Map(dates.map((d, i) => [d, i]));
  const latest = dates[dates.length - 1];

  const raw: { code: string; date: string; f: number[]; exRet: number | null }[] = [];
  for (const s of series) {
    const bars = s.bars.filter((b) => b.close > 0);
    const c = bars.map((b) => b.close);
    const v = bars.map((b) => b.volume || 0);
    const rsi = rsiSeries(c);
    const ihsgAt = (i: number) => (i >= 0 && i < bars.length ? ihsgClose.get(bars[i]!.date) ?? null : null);
    for (let i = MIN_HISTORY; i < bars.length; i++) {
      const d = bars[i]!.date;
      if (!sampled.has(d)) continue;
      const f = featuresAt(c, v, rsi, ihsgAt, i);
      if (!f || f.some((x) => !isFinite(x))) continue;
      let exRet: number | null = null;
      if (i + horizon < bars.length) {
        const iNow = ihsgAt(i);
        const iFwd = ihsgAt(i + horizon);
        if (iNow != null && iFwd != null) exRet = Math.log(c[i + horizon]! / c[i]!) - Math.log(iFwd / iNow);
      }
      if (exRet == null && d !== latest) continue; // unlabeled & not scoreable
      raw.push({ code: s.code, date: d, f, exRet });
    }
  }

  // Rank features (and target) within each date.
  const byDate = new Map<string, typeof raw>();
  for (const r of raw) { const g = byDate.get(r.date); if (g) g.push(r); else byDate.set(r.date, [r]); }
  const rows: MlRow[] = [];
  for (const [d, group] of byDate) {
    if (group.length < minPerDate) continue;
    const nF = group[0]!.f.length;
    const cols = Array.from({ length: nF }, (_, j) => pctRank(group.map((g) => g.f[j]!)));
    const labeled = group.filter((g) => g.exRet != null);
    const yRank = labeled.length >= minPerDate ? pctRank(labeled.map((g) => g.exRet!)) : null;
    let li = 0;
    group.forEach((g, gi) => {
      const y = g.exRet != null && yRank ? yRank[li++]! : null;
      rows.push({ code: g.code, date: d, dateIdx: dateIdx.get(d)!, x: cols.map((col) => col[gi]!), exRet: g.exRet, y });
    });
  }
  rows.sort((a, b) => a.dateIdx - b.dateIdx || (a.code < b.code ? -1 : 1));
  return { rows, dates };
}

export interface MlEvaluation {
  meanIC: number;
  icStd: number;
  nDates: number;
  nEff: number;
  tStat: number;
  significant: boolean;     // t > 2 on the effective sample
  spreadPct: number;        // mean realized excess return, top − bottom quintile (%, per horizon)
  topBeatPct: number;       // % of top-quintile picks that beat IHSG
  blocks: number;
}

/** Walk-forward evaluation over the last `blocks` × `perBlock` sampled dates. */
export async function walkForward(rows: MlRow[], horizon = 20, step = 5, blocks = 4, perBlock = 13, params: Partial<GbdtParams> = {}): Promise<MlEvaluation | null> {
  const labeled = rows.filter((r) => r.y != null);
  const allDates = [...new Set(labeled.map((r) => r.dateIdx))].sort((a, b) => a - b);
  const testDates = allDates.slice(-blocks * perBlock);
  if (testDates.length < blocks * 4) return null;
  const embargo = Math.ceil(horizon / step);
  const ics: number[] = [];
  const spreads: number[] = [];
  let topN = 0;
  let topBeat = 0;
  let doneBlocks = 0;
  for (let b = 0; b < blocks; b++) {
    const blk = testDates.slice(b * perBlock, (b + 1) * perBlock);
    if (!blk.length) continue;
    const train = labeled.filter((r) => r.dateIdx <= blk[0]! - embargo);
    if (train.length < 2000) continue;
    const model = await trainGbdtAsync(train.map((r) => r.x), train.map((r) => r.y!), params);
    doneBlocks++;
    for (const d of blk) {
      const test = labeled.filter((r) => r.dateIdx === d);
      if (test.length < 10) continue;
      const pred = test.map((r) => predictGbdt(model, r.x));
      const ic = spearman(pred, test.map((r) => r.exRet!));
      if (ic != null) ics.push(ic);
      const order = pred.map((p, i) => i).sort((a, c) => pred[c]! - pred[a]!);
      const q = Math.max(1, Math.floor(test.length / 5));
      const top = order.slice(0, q).map((i) => test[i]!.exRet!);
      const bot = order.slice(-q).map((i) => test[i]!.exRet!);
      spreads.push(top.reduce((s, v) => s + v, 0) / q - bot.reduce((s, v) => s + v, 0) / q);
      topN += top.length;
      topBeat += top.filter((v) => v > 0).length;
    }
  }
  if (ics.length < 8) return null;
  const meanIC = ics.reduce((s, v) => s + v, 0) / ics.length;
  const icStd = Math.sqrt(ics.reduce((s, v) => s + (v - meanIC) ** 2, 0) / Math.max(1, ics.length - 1));
  const nEff = Math.max(2, Math.floor((ics.length * step) / horizon));
  const tStat = icStd > 0 ? meanIC / (icStd / Math.sqrt(nEff)) : 0;
  const r = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
  return {
    meanIC: r(meanIC),
    icStd: r(icStd),
    nDates: ics.length,
    nEff,
    tStat: r(tStat, 2),
    significant: tStat > 2,
    spreadPct: r((spreads.reduce((s, v) => s + v, 0) / spreads.length) * 100, 2),
    topBeatPct: r((topBeat / Math.max(1, topN)) * 100, 1),
    blocks: doneBlocks
  };
}

/** Train on all labeled rows and score the latest cross-section (0–100 percentile). */
export async function scoreLatest(rows: MlRow[], params: Partial<GbdtParams> = {}) {
  const labeled = rows.filter((r) => r.y != null);
  const latestIdx = Math.max(...rows.map((r) => r.dateIdx));
  const latest = rows.filter((r) => r.dateIdx === latestIdx && r.exRet == null);
  if (labeled.length < 2000 || latest.length < 10) return null;
  const model = await trainGbdtAsync(labeled.map((r) => r.x), labeled.map((r) => r.y!), params);
  const pred = latest.map((r) => predictGbdt(model, r.x));
  const pr = pctRank(pred);
  const scores: Record<string, number> = {};
  latest.forEach((r, i) => { scores[r.code] = Math.round(pr[i]! * 100); });
  const importance = ML_FEATURES.map((f, i) => ({ key: f.key, label: f.label, weight: Math.round((model.importance[i] ?? 0) * 1000) / 10 }))
    .sort((a, b) => b.weight - a.weight);
  return { date: latest[0]!.date, scores, importance, nTrain: labeled.length };
}
