import { describe, it, expect } from 'vitest';
import { analyzePortfolio } from '../server/utils/portfolio';
import type { Holding } from '../server/utils/store';
import type { DailyBar } from '../server/utils/yahoo';
import { bars, dates, geometric, randomWalk, scaledReturns } from './helpers';

const N = 80;
const DS = dates(N);

function ihsgBars(): DailyBar[] {
  return bars(geometric(7000, 0.0005, N), { dateList: DS });
}

describe('analyzePortfolio — valuasi', () => {
  it('PnL, bobot, dan total sesuai hitungan langsung', () => {
    const closes = geometric(100, 0.001, N);
    const bySym = new Map([['BBCA', bars(closes, { dateList: DS })]]);
    // close terakhir = 100 * 1.001^79
    const a = analyzePortfolio([{ symbol: 'BBCA', lots: 2, avgPrice: 100 }], bySym, ihsgBars());
    expect(a.positions).toHaveLength(1);
    const p = a.positions[0]!;
    const lastClose = closes[closes.length - 1]!;
    expect(p.shares).toBe(200);
    expect(p.cost).toBe(20000);
    expect(p.price).toBe(Math.round(lastClose * 100) / 100);
    expect(p.value).toBe(Math.round(200 * lastClose));
    expect(p.pnl).toBe(Math.round(Math.round(200 * lastClose) - 20000));
    expect(p.pnlPct).toBeCloseTo((p.price / 100 - 1) * 100, 0);
    expect(p.weightPct).toBe(100);
    expect(a.totalValue).toBe(p.value);
  });

  it('portofolio kosong → nilai nol tanpa risiko/korelasi', () => {
    const a = analyzePortfolio([], new Map(), ihsgBars());
    expect(a.totalValue).toBe(0);
    expect(a.risk).toBeNull();
    expect(a.correlation).toBeNull();
  });
});

describe('analyzePortfolio — korelasi', () => {
  it('matriks simetris, diagonal 1, rentang [-1,1]; seri identik → warning korelasi', () => {
    const closes = geometric(500, 0.002, N);
    const bySym = new Map<string, DailyBar[]>([
      ['BBCA', bars(closes, { dateList: DS })],
      ['BBRI', bars(closes.map((c) => c * 2), { dateList: DS })] // return identik
    ]);
    const holdings: Holding[] = [
      { symbol: 'BBCA', lots: 1, avgPrice: 500 },
      { symbol: 'BBRI', lots: 1, avgPrice: 1000 }
    ];
    const a = analyzePortfolio(holdings, bySym, ihsgBars());
    expect(a.correlation).not.toBeNull();
    const m = a.correlation!.matrix;
    for (let i = 0; i < m.length; i++) {
      expect(m[i]![i]).toBe(1);
      for (let j = 0; j < m.length; j++) {
        expect(m[i]![j]).toBe(m[j]![i]);
        expect(m[i]![j]).toBeGreaterThanOrEqual(-1.01);
        expect(m[i]![j]).toBeLessThanOrEqual(1.01);
      }
    }
    expect(a.warnings.some((w) => w.includes('Korelasi tinggi'))).toBe(true);
  });
});

describe('analyzePortfolio — risiko', () => {
  it('beta tepat 1.5 saat return portofolio = 1.5× IHSG; VaR konsisten dgn vol harian', () => {
    // IHSG diberi noise agar variansi return bermakna (bukan nol numerik)
    const ihsgCloses = randomWalk(7000, 0.008, N, 21);
    const ihsg = bars(ihsgCloses, { dateList: DS });
    // saham dengan log-return 1.5× IHSG → beta wajar 1.5
    const lev = bars(scaledReturns(ihsgCloses, 1.5), { dateList: DS });
    const bySym = new Map([['LEVR', lev]]);
    const a = analyzePortfolio([{ symbol: 'LEVR', lots: 1, avgPrice: lev[0]!.close }], bySym, ihsg);
    expect(a.risk).not.toBeNull();
    expect(a.risk!.beta).toBeCloseTo(1.5, 1);
    expect(a.risk!.var95Pct).toBeCloseTo(1.645 * a.risk!.volDailyPct, 1);
    // var95Rp dihitung dari vol mentah (belum dibulatkan) → toleransi proporsional
    const expVarRp = 1.645 * (a.risk!.volDailyPct / 100) * a.totalValue;
    expect(Math.abs(a.risk!.var95Rp - expVarRp)).toBeLessThan(a.totalValue * 0.001);
    expect(a.risk!.volAnnualPct).toBeGreaterThan(a.risk!.volDailyPct);
    expect(a.risk!.maxDrawdownPct).toBeGreaterThanOrEqual(0);
  });

  it('konsentrasi >40% memicu warning', () => {
    const bySym = new Map([['SOLO', bars(geometric(100, 0.001, N), { dateList: DS })]]);
    const a = analyzePortfolio(
      [
        { symbol: 'SOLO', lots: 10, avgPrice: 100 },
        { symbol: 'NIHIL', lots: 1, avgPrice: 100 } // tanpa data harga → tak masuk retMaps
      ],
      bySym,
      ihsgBars()
    );
    expect(a.warnings.some((w) => w.includes('Konsentrasi'))).toBe(true);
  });
});
