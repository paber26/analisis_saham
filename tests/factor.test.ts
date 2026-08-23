import { describe, it, expect } from 'vitest';
import { computeFactors } from '../server/utils/factor';
import type { ScreenRow } from '../server/utils/store';

/** Fixture ScreenRow minimal — hanya field yang dipakai computeFactors. */
function row(code: string, f: Partial<ScreenRow>): ScreenRow {
  return {
    code,
    symbol: code + '.JK',
    name: code,
    sector: null,
    rs3m: null,
    per: null,
    pbv: null,
    roe: null,
    dividendYield: null,
    marketCap: null,
    revenueGrowth: null,
    earningsGrowth: null,
    debtToEquity: null,
    ...f
  } as ScreenRow;
}

describe('computeFactors — ranking QVM', () => {
  const rows = [
    row('AAA', { per: 5, pbv: 0.5, dividendYield: 6, roe: 25, debtToEquity: 0.2, earningsGrowth: 30, rs3m: 20, score: 90 }),
    row('BBB', { per: 50, pbv: 5, dividendYield: 0, roe: 2, debtToEquity: 3, earningsGrowth: -20, rs3m: -15, score: 20 }),
    row('CCC', { per: 12, pbv: 1.2, dividendYield: 3, roe: 12, debtToEquity: 1.0, earningsGrowth: 8, rs3m: 4, score: 55 }),
    row('DDD', { per: 20, pbv: 2, dividendYield: 2, roe: 8, debtToEquity: 1.8, earningsGrowth: 3, rs3m: -2, score: 45 }),
    row('EEE', { per: 9, pbv: 0.9, dividendYield: 4, roe: 16, debtToEquity: 0.7, earningsGrowth: 15, rs3m: 10, score: 70 })
  ];
  const out = computeFactors(rows);

  it('rank 1 untuk emiten terbaik lintas faktor, rank unik & rapat', () => {
    expect(out[0]!.qvmRank).toBe(1); // AAA unggul di value+quality+momentum
    const ranks = out.filter((r) => r.qvmRank != null).map((r) => r.qvmRank!).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3, 4, 5]);
  });

  it('sub-faktor monoton sesuai arah (Value murah=bagus, ROE tinggi=bagus)', () => {
    const aaa = out[0]!;
    const bbb = out[1]!;
    expect(aaa.value!).toBeGreaterThan(bbb.value!);
    expect(aaa.quality!).toBeGreaterThan(bbb.quality!);
    expect(aaa.momentum!).toBeGreaterThan(bbb.momentum!);
    expect(aaa.qvm!).toBeGreaterThan(bbb.qvm!);
  });

  it('semua skor faktor dalam [0,100]', () => {
    for (const r of out) {
      for (const v of [r.value, r.quality, r.momentum, r.qvm]) {
        if (v != null) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

describe('computeFactors — kasus tepi', () => {
  it('satu baris → tidak ada persentil → faktor null', () => {
    const out = computeFactors([row('AAA', { per: 10, roe: 20 })]);
    expect(out[0]!.value).toBeNull();
    expect(out[0]!.qvm).toBeNull();
    expect(out[0]!.qvmRank).toBeNull();
  });

  it('PER negatif (rugi) tidak dihitung murah — diperlakukan null', () => {
    const out = computeFactors([
      row('RUGI', { per: -5, pbv: 10 }),
      row('SEHAT', { per: 30, pbv: 1 })
    ]);
    // RUGI hanya dinilai dari PBV (buruk), SEHAT dari PER+PBV.
    // PBV rendah = persentil bagus utk SEHAT; pastikan RUGI tak menang Value via PER palsu.
    const rugi = out.find((r) => r.code === 'RUGI')!;
    const sehat = out.find((r) => r.code === 'SEHAT')!;
    expect(sehat.value!).toBeGreaterThan(rugi.value!);
  });

  it('fundamental null sepenuhnya → faktor terkait null tapi momentum tetap', () => {
    const out = computeFactors([
      row('XXX', { rs3m: 25, score: 80 }),
      row('YYY', { rs3m: -10, score: 30 })
    ]);
    expect(out.every((r) => r.value === null && r.quality === null)).toBe(true);
    expect(out[0]!.momentum!).toBeGreaterThan(out[1]!.momentum!);
  });
});
