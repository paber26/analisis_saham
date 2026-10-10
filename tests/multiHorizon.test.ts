import { describe, it, expect } from 'vitest';
import { alignExoReturns, driversFor } from '../server/utils/exogenous';
import { runForecast, type PricePoint } from '../server/utils/forecast';
import { rng, dates } from './helpers';

describe('alignExoReturns — aturan anti look-ahead', () => {
  const stock = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-09'];
  const exo = [
    { date: '2026-01-02', close: 100 },
    { date: '2026-01-05', close: 110 },
    { date: '2026-01-06', close: 121 },
    { date: '2026-01-08', close: 133.1 } // stock tutup tgl 08 (libur)
  ];

  it('lag 0 (IHSG): pakai penutupan di tanggal yang sama', () => {
    const r = alignExoReturns(stock, exo, 0);
    expect(r[0]).toBeNull();
    expect(r[1]).toBeCloseTo(Math.log(121 / 110), 12);
    expect(r[2]).toBeCloseTo(0, 12);                    // 07: belum ada data baru
    expect(r[3]).toBeCloseTo(Math.log(133.1 / 121), 12); // 09: ambil tgl 08 (forward-fill)
  });

  it('lag 1 (komoditas/FX): hanya penutupan SEBELUM tanggal saham', () => {
    const r = alignExoReturns(stock, exo, 1);
    // 05 → level 02; 06 → level 05; 07 → level 06; 09 → level 08
    expect(r[1]).toBeCloseTo(Math.log(110 / 100), 12);
    expect(r[2]).toBeCloseTo(Math.log(121 / 110), 12);
    expect(r[3]).toBeCloseTo(Math.log(133.1 / 121), 12);
  });
});

describe('driversFor — pemetaan komoditas', () => {
  it('saham batubara dapat batubara + USD/IDR; bank hanya USD/IDR', () => {
    expect(driversFor('ADRO').map((d) => d.key)).toEqual(['coal', 'usdidr']);
    expect(driversFor('AALI.JK').map((d) => d.key)).toEqual(['vegoil', 'usdidr']);
    expect(driversFor('INCO').map((d) => d.key)).toEqual(['copper', 'gold', 'usdidr']);
    expect(driversFor('BBCA').map((d) => d.key)).toEqual(['usdidr']);
  });
});

/** Stock driven by a persistent commodity trend; commodity is published after IDX close. */
function synth(n: number, opts: { phi: number; sameDay: boolean; seed: number }) {
  const u = rng(opts.seed);
  const norm = () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
  const ds = dates(n);
  const c: number[] = [0];
  for (let t = 1; t < n; t++) c.push(opts.phi * c[t - 1]! + 0.004 * norm());
  let px = 4000;
  let cx = 100;
  let ix = 7000;
  const stock: PricePoint[] = [];
  const comm: { date: string; close: number }[] = [];
  const ihsg: { date: string; close: number }[] = [];
  for (let t = 0; t < n; t++) {
    const drive = opts.sameDay ? c[t]! : t > 0 ? c[t - 1]! : 0;
    const idx = 0.006 * norm();
    if (t > 0) px *= Math.exp(1.5 * drive + 0.5 * idx + 0.012 * norm());
    cx *= Math.exp(c[t]!);
    ix *= Math.exp(idx);
    stock.push({ date: ds[t]!, close: px, volume: 1e6 * (1 + u()) });
    comm.push({ date: ds[t]!, close: cx });
    ihsg.push({ date: ds[t]!, close: ix });
  }
  return { stock, comm, ihsg };
}
const coal = driversFor('ADRO')[0]!;

describe('runForecast — fitur eksternal & multi-horizon', () => {
  it('komoditas yang benar-benar prediktif → model 5 hari unggul signifikan atas baseline', () => {
    const { stock, comm, ihsg } = synth(1250, { phi: 0.95, sameDay: false, seed: 3 });
    const r = runForecast(stock, 14, { ihsg, drivers: [{ driver: coal, points: comm }] })!;
    expect(r.features.find((f) => f.label === coal.label)?.available).toBe(true);
    expect(r.features.find((f) => f.label === 'IHSG')?.available).toBe(true);
    expect(r.features.find((f) => f.label === 'Volume')?.available).toBe(true);
    const h5 = r.multiHorizon.find((m) => m.h === 5)!;
    expect(h5.hitRate!).toBeGreaterThan(h5.baselineHitRate! + 5);
    expect(h5.significant).toBe(true);
    expect(h5.probBeatIhsg).not.toBeNull();
    expect(r.multiHorizon.map((m) => m.h)).toEqual([5, 10, 20]);
  });

  it('tanpa kebocoran: komoditas yang terbit SETELAH tutup IDX tidak bisa dipakai', () => {
    // Saham bergerak bersama komoditas di hari yang sama, komoditas tanpa persistensi:
    // dengan lag 1 informasinya belum tersedia → tidak ada keunggulan.
    const { stock, comm, ihsg } = synth(1250, { phi: 0, sameDay: true, seed: 9 });
    const r = runForecast(stock, 14, { ihsg, drivers: [{ driver: coal, points: comm }] })!;
    expect(r.metrics.reg.dirAcc!).toBeLessThan(60);
    for (const m of r.multiHorizon) expect(m.significant).toBe(false);
  });

  it('tanpa data eksternal: tetap jalan, probBeatIhsg null, grup fitur ditandai tidak tersedia', () => {
    const { stock } = synth(800, { phi: 0.5, sameDay: false, seed: 4 });
    const r = runForecast(stock.map(({ date, close }) => ({ date, close })), 14)!;
    expect(r.features.find((f) => f.label === 'Volume')?.available).toBe(false);
    expect(r.features.find((f) => f.label === 'IHSG')?.available).toBe(false);
    for (const m of r.multiHorizon) expect(m.probBeatIhsg).toBeNull();
    for (const m of r.multiHorizon) {
      expect(m.probUp).toBeGreaterThan(0);
      expect(m.probUp).toBeLessThan(100);
    }
  });
});
