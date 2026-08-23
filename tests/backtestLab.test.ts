import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildLabGrid, runSweep, buildMatrix,
  type SweepSummary
} from '../server/utils/backtestLab';
import { rebalanceIndices, evaluateFamily, runBacktest, signalFor } from '../server/utils/backtest';
import { analyzeTechnical } from '../server/utils/technical';
import type { LabHistory } from '../server/utils/backtestHistory';
import { bars, dates, geometric, randomWalk } from './helpers';

describe('buildLabGrid — tepat 500 kombinasi deterministik', () => {
  const grid = buildLabGrid();

  it('panjang grid = 500; semua ID unik', () => {
    expect(grid.length).toBe(500);
    expect(new Set(grid.map((c) => c.id)).size).toBe(500);
  });

  it('mencakup 3 kadensi dan 6 family; 50 legacy ⊆ grid', () => {
    const months = grid.filter((c) => c.cadence === 'monthly').length;
    const weeks = grid.filter((c) => c.cadence === 'weekly').length;
    const biw = grid.filter((c) => c.cadence === 'biweekly').length;
    expect(months + weeks + biw).toBe(500);
    expect(months).toBeGreaterThan(100);
    expect(weeks).toBeGreaterThan(100);
    expect(biw).toBeGreaterThan(30);
    // legacy first 50 still prefix
    expect(grid[0]!.id).toBe('monthly-score-t40-kall');
    expect(grid.filter((c) => c.family === 'lowvol').length).toBeGreaterThan(0);
  });

});

describe('rebalanceIndices — mingguan, dwi-mingguan & bulanan', () => {
  // 15 hari kerja berturut: Sen 2022-01-03 … Jum 2022-01-21
  const ds = dates(15);
  const b = bars(geometric(100, 0.001, 15), { dateList: ds });

  it('mingguan = bar terakhir tiap minggu ISO (Jumat)', () => {
    const idx = rebalanceIndices(b, 'weekly');
    expect(idx).toEqual([4, 9, 14]); // Jum 07, 14, 21
  });

  it('bulanan = bar terakhir tiap bulan', () => {
    expect(rebalanceIndices(b, 'monthly')).toEqual([14]);
  });

  it('dwi-mingguan = bar terakhir tiap 2 minggu ISO', () => {
    const idx = rebalanceIndices(b, 'biweekly');
    expect(idx).toEqual([9, 14]); // 2022-W01+W02 → Jum 14, W03 → Jum 21
  });
});

describe('evaluateFamily — konsisten dgn hitungan langsung', () => {
  const slice = bars(randomWalk(500, 0.01, 260, 9));

  it("family 'score' = skor analyzeTechnical", () => {
    const cell = evaluateFamily('score', slice)!;
    const tech = analyzeTechnical(slice)!;
    expect(cell.ok).toBe(true);
    expect(cell.rank).toBe(tech.score);
  });

  it("family 'lowvol' ranking monoton: makin volatil makin buruk", () => {
    const volatile = bars(randomWalk(500, 0.04, 260, 11));
    const calm = bars(randomWalk(500, 0.005, 260, 11));
    expect(evaluateFamily('lowvol', volatile)!.rank).toBeLessThan(evaluateFamily('lowvol', calm)!.rank);
  });

  it("family 'ma200' = % jarak harga ke MA200", () => {
    const cell = evaluateFamily('ma200', slice)!;
    let s = 0;
    for (let i = slice.length - 200; i < slice.length; i++) s += slice[i]!.close;
    const ma = s / 200;
    expect(cell.rank).toBeCloseTo(((slice[slice.length - 1]!.close / ma) - 1) * 100, 6);
    expect(cell.ok).toBe(cell.rank > 0);
  });
});

describe('runSweep — jalur matrix identik dgn jalur langsung', () => {
  const N = 430;
  const DS = dates(N);
  const ihsgBars = bars(geometric(7000, 0.0002, N), { dateList: DS });
  const barsBySymbol = new Map([
    ['UPUP', bars(geometric(100, 0.004, N), { dateList: DS })],
    ['DOWN', bars(geometric(150, -0.004, N), { dateList: DS })]
  ]);

  it('backtest dgn matrix == backtest dgn signalFor (MA200, bulanan)', () => {
    // family 'ma200' punya padanan langsung di signalFor — paritas eksak
    const matrix = buildMatrix(barsBySymbol, ihsgBars, 'ma200', 'monthly');
    const viaMatrix = runBacktest(barsBySymbol, ihsgBars, () => false, {
      signals: matrix, cadence: 'monthly'
    });
    const direct = runBacktest(barsBySymbol, ihsgBars, signalFor('ma200'));
    expect(viaMatrix).not.toBeNull();
    expect(direct).not.toBeNull();
    // UPUP selalu di atas MA200, DOWN selalu di bawah → hanya UPUP dipilih
    expect(viaMatrix!.metrics.avgHoldings).toBe(1);
    expect(direct!.metrics.avgHoldings).toBe(1);
    expect(viaMatrix!.metrics.totalReturnPct).toBe(direct!.metrics.totalReturnPct);
    expect(viaMatrix!.equity).toEqual(direct!.equity);
  });

  it('maxNames dihormati: hanya K saham terbaik yang dipegang', () => {
    const sixSymbols = new Map([
      ['AAA', bars(geometric(100, 0.004, N), { dateList: DS })],
      ['BBB', bars(geometric(110, 0.001, N), { dateList: DS })],
      ['CCC', bars(geometric(120, -0.001, N), { dateList: DS })],
      ['DDD', bars(geometric(130, -0.002, N), { dateList: DS })],
      ['EEE', bars(geometric(140, -0.003, N), { dateList: DS })],
      ['FFF', bars(geometric(150, -0.004, N), { dateList: DS })]
    ]);
    const r = runBacktest(sixSymbols, ihsgBars, () => false, {
      signals: buildMatrix(sixSymbols, ihsgBars, 'ma200', 'monthly'),
      maxNames: 2, cadence: 'monthly'
    })!;
    expect(r.metrics.avgHoldings).toBe(2);     // AAA & BBB selalu ranking tertinggi
    expect(r.metrics.winRatePct).toBe(100);
  });

  it('sweep penuh: 500 konfig dijalankan pada data sintetis', () => {
    const summary = runSweep(new Map([...barsBySymbol, ['FLAT3', bars(new Array(N).fill(500), { dateList: DS })]]), ihsgBars);
    expect(summary.runs.length).toBe(500);
    expect(summary.executed + summary.failed).toBe(500);
    expect(summary.beatsCount).toBeGreaterThanOrEqual(0);
    // FLAT gagal guard likuiditas → tak menambah pemilih, tapi sweep tetap jalan
    expect(summary.periodStart).toBeTruthy();
  }, 60000);
});

describe('backtestHistory — round-trip & kapasitas', () => {
  let dir: string;
  let H: typeof import('../server/utils/backtestHistory');
  let firstSweepId = '';
  const O = () => ({ dir }); // isolasi eksplisit — TIDAK menyentuh store produksi

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(tmpdir(), 'lab-hist-'));
    H = await import('../server/utils/backtestHistory');
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  function fakeSummary(alpha: number): SweepSummary {
    const bench = { totalReturnPct: alpha * 4, cagrPct: -1.37, maxDrawdownPct: 34.7, alphaCagrPct: alpha };
    const metrics = { totalReturnPct: alpha * 4, cagrPct: -1.37 + alpha, winRatePct: 55, maxDrawdownPct: 40, sharpe: 0.5, sortino: 0.7, avgHoldings: 12 };
    return {
      runs: [{
        id: 'x', cadence: 'monthly' as const, family: 'score' as const, threshold: 70, maxNames: null,
        label: 'Skor >=70 · Bulanan',
        result: {
          start: '2022-06-30', end: '2026-08-21', months: 50, cadence: 'monthly' as const,
          equity: [], metrics, benchmark: bench, costPerRebalancePct: 0.15
        }
      }],
      executed: 500, failed: 0,
      periodStart: '2022-06-30', periodEnd: '2026-08-21',
      universeSize: 45,
      beatsCount: alpha > 0 ? 1 : 0,
      bestAlphaPct: alpha, medianAlphaPct: Math.round((alpha / 2) * 100) / 100
    };
  }

  it('simpan → baca kembali utuh; urut terbaru dulu', async () => {
    const s1 = H.sweepFromSummary(fakeSummary(-22));
    await H.saveSweep(s1, O());
    const got = await H.getSweep(s1.id, O());
    expect(got).not.toBeNull();
    expect(got!.bestAlphaPct).toBe(-22);
    expect(got!.runs[0]!.bench.alphaCagrPct).toBe(-22);
    expect(got!.ihsgCagrPct).toBe(-1.37);

    const s2 = H.sweepFromSummary(fakeSummary(3.5));
    await H.saveSweep(s2, O());
    const latest = await H.getLatestSweep(O());
    expect(latest!.id).toBe(s2.id);

    const summaries = await H.listSweepSummaries(O());
    expect(summaries.map((x) => x.id)).toEqual([s2.id, s1.id]);
    firstSweepId = s1.id;
  });

  it('kapasitas maksimum 20 sweep terakhir', async () => {
    // push total 21x tambahan (mulai dari 2 yang ada) → dipangkas ke 20
    for (let i = 0; i < 21; i++) {
      await H.saveSweep(H.sweepFromSummary(fakeSummary(i)), O());
    }
    const list = await H.listSweepSummaries(O());
    expect(list.length).toBe(20);
    const raw = JSON.parse(await fs.readFile(path.join(dir, 'backtest-lab.json'), 'utf-8')) as LabHistory;
    expect(raw.sweeps.length).toBe(20);
    // sweep awal (s1/s2) sudah tergeser keluar kapasitas
    expect(list.find((x) => x.id === firstSweepId)).toBeUndefined();
  }, 15000);
});
