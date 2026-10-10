import { describe, it, expect } from 'vitest';
import { trainGbdt, trainGbdtAsync, predictGbdt } from '../server/utils/gbdt';
import { buildDataset, walkForward, scoreLatest, spearman, pctRank, ML_FEATURES, type MlSeries } from '../server/utils/mlRank';
import { rng, dates } from './helpers';

describe('GBDT', () => {
  const u = rng(5);
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < 3000; i++) {
    const x = [u(), u(), u()];
    X.push(x);
    y.push(Math.sin(6 * x[0]!) + (x[1]! > 0.5 ? 1 : 0) + 0.1 * (u() - 0.5)); // x[2] = noise
  }
  const m = trainGbdt(X, y, { nTrees: 200, learningRate: 0.1, maxDepth: 3, minLeaf: 20 });

  it('mempelajari fungsi nonlinier (R² tinggi di data uji)', () => {
    const u2 = rng(99);
    let sse = 0;
    let sst = 0;
    const ys: number[] = [];
    const ps: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const x = [u2(), u2(), u2()];
      ys.push(Math.sin(6 * x[0]!) + (x[1]! > 0.5 ? 1 : 0));
      ps.push(predictGbdt(m, x));
    }
    const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
    ys.forEach((v, i) => { sse += (v - ps[i]!) ** 2; sst += (v - mean) ** 2; });
    expect(1 - sse / sst).toBeGreaterThan(0.9);
  });

  it('versi async (memberi giliran event loop) menghasilkan model yang identik', async () => {
    const ma = await trainGbdtAsync(X, y, { nTrees: 200, learningRate: 0.1, maxDepth: 3, minLeaf: 20 });
    expect(predictGbdt(ma, [0.3, 0.7, 0.1])).toBe(predictGbdt(m, [0.3, 0.7, 0.1]));
  });

  it('importance terkonsentrasi di fitur informatif, deterministik', () => {
    expect(m.importance[2]!).toBeLessThan(0.05);
    expect(m.importance[0]! + m.importance[1]!).toBeGreaterThan(0.95);
    const m2 = trainGbdt(X, y, { nTrees: 200, learningRate: 0.1, maxDepth: 3, minLeaf: 20 });
    expect(predictGbdt(m2, [0.3, 0.7, 0.1])).toBe(predictGbdt(m, [0.3, 0.7, 0.1]));
  });
});

describe('peringkat & korelasi', () => {
  it('pctRank menangani nilai sama; spearman monoton = 1', () => {
    expect(pctRank([10, 20, 20, 30])).toEqual([0, 0.5, 0.5, 1]);
    expect(spearman([1, 2, 3, 4], [10, 40, 90, 160])).toBeCloseTo(1, 10);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 10);
  });
});

/** Universe sintetis: momentum = drift per saham yang berubah perlahan (persisten). */
function universe(nStocks: number, n: number, momentum: boolean, seed: number): { series: MlSeries[]; ihsg: { date: string; close: number }[] } {
  const u = rng(seed);
  const norm = () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
  const ds = dates(n);
  const mkt: number[] = [0];
  for (let t = 1; t < n; t++) mkt.push(0.008 * norm());
  let lvl = 7000;
  const ihsg = ds.map((d, t) => ({ date: d, close: (lvl *= Math.exp(mkt[t]!)) }));
  const series: MlSeries[] = [];
  for (let s = 0; s < nStocks; s++) {
    let drift = 0;
    let px = 1000 + 100 * s;
    const bars = ds.map((d, t) => {
      if (momentum) drift = 0.985 * drift + 0.0006 * norm();
      if (t > 0) px *= Math.exp(mkt[t]! + drift + 0.018 * norm());
      return { date: d, close: px, volume: 1e6 * (0.5 + u()) };
    });
    series.push({ code: `S${s}`, bars });
  }
  return { series, ihsg };
}

describe('model peringkat gabungan (pooled)', () => {
  const P = { nTrees: 80, learningRate: 0.08 };

  it('pasar dengan momentum → IC positif & signifikan, kuintil atas mengungguli bawah', async () => {
    const { series, ihsg } = universe(60, 900, true, 1);
    const { rows } = buildDataset(series, ihsg);
    expect(rows[0]!.x).toHaveLength(ML_FEATURES.length);
    const ev = (await walkForward(rows, 20, 5, 4, 13, P))!;
    expect(ev.meanIC).toBeGreaterThan(0.05);
    expect(ev.significant).toBe(true);
    expect(ev.spreadPct).toBeGreaterThan(0);
  });

  it('random walk murni → tidak mengklaim sinyal', async () => {
    const { series, ihsg } = universe(60, 900, false, 2);
    const ev = (await walkForward(buildDataset(series, ihsg).rows, 20, 5, 4, 13, P))!;
    expect(Math.abs(ev.meanIC)).toBeLessThan(0.06);
    expect(ev.significant).toBe(false);
  });

  it('scoreLatest: skor 0–100 untuk tanggal terakhir + importance fitur', async () => {
    const { series, ihsg } = universe(40, 700, true, 3);
    const { rows } = buildDataset(series, ihsg);
    const res = (await scoreLatest(rows, P))!;
    expect(res.date).toBe(ihsg[ihsg.length - 1]!.date);
    const vals = Object.values(res.scores);
    expect(vals).toHaveLength(40);
    expect(Math.min(...vals)).toBe(0);
    expect(Math.max(...vals)).toBe(100);
    expect(res.importance).toHaveLength(ML_FEATURES.length);
  });

  it('dataset: baris tanggal terakhir tidak berlabel; label hanya bila 20 hari ke depan tersedia', () => {
    const { series, ihsg } = universe(25, 500, false, 4);
    const { rows, dates: ds } = buildDataset(series, ihsg);
    const last = ds.length - 1;
    expect(rows.filter((r) => r.dateIdx === last).every((r) => r.exRet == null && r.y == null)).toBe(true);
    expect(rows.filter((r) => r.dateIdx < last).every((r) => r.y != null)).toBe(true);
  });
});
