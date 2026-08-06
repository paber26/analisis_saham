// Market-level analytics aggregated from the daily screener snapshot:
// breadth (regime) and sector rotation. Needs almost no new data — it reads
// the rows already computed by the sync job.

import type { ScreenRow } from './store';

export interface Breadth {
  total: number;
  aboveMA200: number;
  aboveMA200Pct: number;
  aboveMA50Pct: number;
  advancers: number;
  decliners: number;
  avgRsi: number | null;
  newHigh52: number; // within 2% of 52w high
  newLow52: number;  // within 2% of 52w low
  strongTrend: number; // ADX >= 25
  regime: 'risk-on' | 'netral' | 'risk-off';
  regimeScore: number; // 0-100
  /**
   * Entry/exit guidance tied to the regime (Indonesian).
   * - positionSizePct: suggested max % of capital per new entry
   * - entryBias: 'agresif' | 'selektif' | 'defensif'
   */
  guidance: {
    positionSizePct: number;
    entryBias: 'agresif' | 'selektif' | 'defensif';
    advice: string;
  };
}

export interface SectorStat {
  sector: string;      // Indonesian label
  count: number;
  avgScore: number;
  avgChangePct: number;
  aboveMA200Pct: number;
  medianRsi: number | null;
  avgRs3m: number | null;
  leaders: string[];   // top 3 codes by score
}

// Yahoo GICS sector → Indonesian display label
const SECTOR_ID: Record<string, string> = {
  'Financial Services': 'Keuangan',
  'Energy': 'Energi',
  'Basic Materials': 'Barang Baku',
  'Consumer Cyclical': 'Konsumer Siklikal',
  'Consumer Defensive': 'Konsumer Primer',
  'Industrials': 'Industri',
  'Real Estate': 'Properti',
  'Technology': 'Teknologi',
  'Communication Services': 'Telko & Media',
  'Healthcare': 'Kesehatan',
  'Utilities': 'Utilitas'
};

function median(v: number[]): number | null {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round(((s[m - 1]! + s[m]!) / 2) * 100) / 100;
}
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeBreadth(rows: ScreenRow[]): Breadth {
  const total = rows.length;
  const withTrend = rows.filter((r) => r.sma200 != null);
  const aboveMA200 = withTrend.filter((r) => r.price > (r.sma200 as number)).length;
  const aboveMA50 = rows.filter((r) => r.sma50 != null && r.price > (r.sma50 as number)).length;
  const advancers = rows.filter((r) => r.changePct > 0).length;
  const decliners = rows.filter((r) => r.changePct < 0).length;
  const rsis = rows.map((r) => r.rsi).filter((x): x is number => x != null);
  const avgRsi = rsis.length ? round1(rsis.reduce((a, b) => a + b, 0) / rsis.length) : null;
  const newHigh52 = rows.filter((r) => r.pctFromHigh >= -2).length;
  const newLow52 = rows.filter((r) => r.pctFromLow <= 2).length;
  const strongTrend = rows.filter((r) => r.adx != null && r.adx >= 25).length;

  const aboveMA200Pct = withTrend.length ? round1((aboveMA200 / withTrend.length) * 100) : 0;
  const aboveMA50Pct = total ? round1((aboveMA50 / total) * 100) : 0;

  // Regime score: blend of % above MA200 (main), advancer share, avg RSI
  const advShare = advancers + decliners ? (advancers / (advancers + decliners)) * 100 : 50;
  const rsiComponent = avgRsi != null ? Math.min(100, Math.max(0, (avgRsi - 30) / 40 * 100)) : 50;
  const regimeScore = Math.round(aboveMA200Pct * 0.6 + advShare * 0.2 + rsiComponent * 0.2);
  const regime: Breadth['regime'] = regimeScore >= 60 ? 'risk-on' : regimeScore <= 40 ? 'risk-off' : 'netral';

  const guidance: Breadth['guidance'] = regime === 'risk-on'
    ? { positionSizePct: 2, entryBias: 'agresif', advice: 'Breadth kuat — momentum mendukung. Entry baru boleh dengan ukuran normal (maks 2% modal per posisi) dan stop lebih lebar (2-3×ATR).' }
    : regime === 'risk-off'
      ? { positionSizePct: 0.5, entryBias: 'defensif', advice: 'Breadth lemah — mayoritas di bawah MA200. Hindari entry baru; jika terpaksa ukuran sangat kecil (maks 0,5% modal) & stop ketat. Prioritaskan cash.' }
      : { positionSizePct: 1, entryBias: 'selektif', advice: 'Pasar campuran — pilih saham selektif (skor tinggi + di atas MA200). Ukuran posisi sedang: maks 1% modal per posisi.' };

  return {
    total, aboveMA200, aboveMA200Pct, aboveMA50Pct,
    advancers, decliners, avgRsi, newHigh52, newLow52, strongTrend,
    regime, regimeScore, guidance
  };
}

export function computeSectorRotation(rows: ScreenRow[]): SectorStat[] {
  const groups = new Map<string, ScreenRow[]>();
  for (const r of rows) {
    const label = r.sector ? SECTOR_ID[r.sector] || r.sector : 'Lainnya';
    const list = groups.get(label) || [];
    list.push(r);
    groups.set(label, list);
  }

  const stats: SectorStat[] = [];
  for (const [sector, list] of groups) {
    if (list.length < 2) continue; // ignore tiny buckets
    const avgScore = round1(list.reduce((a, b) => a + b.score, 0) / list.length);
    const avgChangePct = round2(list.reduce((a, b) => a + b.changePct, 0) / list.length);
    const withTrend = list.filter((r) => r.sma200 != null);
    const aboveMA200Pct = withTrend.length
      ? round1((withTrend.filter((r) => r.price > (r.sma200 as number)).length / withTrend.length) * 100)
      : 0;
    const medianRsi = median(list.map((r) => r.rsi).filter((x): x is number => x != null));
    const rs = list.map((r) => r.rs3m).filter((x): x is number => x != null);
    const avgRs3m = rs.length ? round2(rs.reduce((a, b) => a + b, 0) / rs.length) : null;
    const leaders = [...list].sort((a, b) => b.score - a.score).slice(0, 3).map((r) => r.code);
    stats.push({ sector, count: list.length, avgScore, avgChangePct, aboveMA200Pct, medianRsi, avgRs3m, leaders });
  }

  return stats.sort((a, b) => b.avgScore - a.avgScore);
}
