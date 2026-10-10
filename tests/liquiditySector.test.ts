import { describe, it, expect } from 'vitest';
import { analyzeTechnical, liquidityTier, tradedValueStats, type Bar } from '../server/utils/technical';
import { computeFactors, MIN_SECTOR_PEERS } from '../server/utils/factor';
import type { ScreenRow } from '../server/utils/store';
import { passesLiquidity, fmtTradedValue } from '../app/utils/liquidity';
import { randomWalk } from './helpers';

const mkBars = (closes: number[], volume: (i: number) => number): Bar[] =>
  closes.map((c, i) => ({ close: c, high: c * 1.01, low: c * 0.99, volume: volume(i) }));

describe('likuiditas — nilai transaksi & tier', () => {
  it('avgValue = rata-rata close × volume 20 sesi terakhir', () => {
    const bars = mkBars(Array(40).fill(1000), (i) => (i < 20 ? 1 : 2_000_000)); // 20 sesi terakhir: Rp2 M/hari
    expect(tradedValueStats(bars)).toEqual({ avgValue: 2e9, zeroDays: 0 });
  });

  it('menghitung hari tanpa transaksi', () => {
    const bars = mkBars(Array(30).fill(500), (i) => (i % 5 === 0 ? 0 : 10_000_000));
    expect(tradedValueStats(bars).zeroDays).toBe(4);
  });

  it('tier: <1M tipis, 1–5M sedang, ≥5M likuid, ≥3 hari kosong = tipis', () => {
    expect(liquidityTier(5e8, 0)).toBe('tipis');
    expect(liquidityTier(1e9, 0)).toBe('sedang');
    expect(liquidityTier(4.9e9, 2)).toBe('sedang');
    expect(liquidityTier(5e9, 0)).toBe('likuid');
    expect(liquidityTier(50e9, 3)).toBe('tipis');
    expect(liquidityTier(null, 0)).toBeNull();
  });

  it('analyzeTechnical menyertakan avgValue20 & liquidity', () => {
    const closes = randomWalk(1000, 0.02, 120, 3);
    const t = analyzeTechnical(mkBars(closes, () => 10_000_000))!;
    expect(t.avgValue20).toBeGreaterThan(5e9);
    expect(t.liquidity).toBe('likuid');
    const thin = analyzeTechnical(mkBars(closes, (i) => (i % 4 === 0 ? 0 : 1000)))!;
    expect(thin.liquidity).toBe('tipis');
  });
});

describe('filter likuiditas di UI', () => {
  it('no_tipis membuang tipis; likuid hanya likuid; data kosong lolos', () => {
    expect(passesLiquidity({ liquidity: 'tipis' }, 'no_tipis')).toBe(false);
    expect(passesLiquidity({ liquidity: 'sedang' }, 'no_tipis')).toBe(true);
    expect(passesLiquidity({ liquidity: 'sedang' }, 'likuid')).toBe(false);
    expect(passesLiquidity({ liquidity: 'likuid' }, 'likuid')).toBe(true);
    expect(passesLiquidity({ liquidity: null }, 'likuid')).toBe(true); // snapshot lama
    expect(passesLiquidity({ liquidity: 'tipis' }, '')).toBe(true);
  });
  it('format nilai transaksi', () => {
    expect(fmtTradedValue(2.5e9)).toBe('Rp 2,5 M');
    expect(fmtTradedValue(1.2e12)).toBe('Rp 1,2 T');
    expect(fmtTradedValue(850e6)).toBe('Rp 850 jt');
    expect(fmtTradedValue(null)).toBe('—');
  });
});

function row(code: string, f: Partial<ScreenRow> & Record<string, unknown>): ScreenRow {
  return {
    code, symbol: code + '.JK', name: code, sector: null, rs3m: null,
    per: null, pbv: null, roe: null, dividendYield: null, marketCap: null,
    revenueGrowth: null, earningsGrowth: null, debtToEquity: null, ...f
  } as ScreenRow;
}

describe('faktor relatif sektor', () => {
  // Bank: PBV wajar ~1–3x; Tambang: PBV ~0.5–1x. Lintas pasar, bank selalu "mahal".
  const banks = [1.0, 1.5, 2.0, 2.5, 3.0].map((pbv, i) => row(`BNK${i}`, { sector: 'Financial Services', pbv }));
  const miners = [0.5, 0.6, 0.7, 0.8, 0.9].map((pbv, i) => row(`MIN${i}`, { sector: 'Basic Materials', pbv }));

  it('bank termurah di sektornya dapat Value tinggi walau PBV-nya > semua tambang', () => {
    const out = computeFactors([...banks, ...miners]);
    const cheapestBank = out.find((r) => r.code === 'BNK0')!;
    const priciestMiner = out.find((r) => r.code === 'MIN4')!;
    expect(cheapestBank.value).toBe(90);
    expect(priciestMiner.value).toBe(10);
    expect(cheapestBank.sectorRelative).toBe(true);
  });

  it(`sektor < ${MIN_SECTOR_PEERS} emiten → fallback ke universe`, () => {
    const small = [row('X1', { sector: 'Utilities', pbv: 0.4 }), row('X2', { sector: 'Utilities', pbv: 4 })];
    const out = computeFactors([...banks, ...small]);
    const x1 = out.find((r) => r.code === 'X1')!;
    expect(x1.sectorRelative).toBe(false);
    expect(x1.value).toBeGreaterThan(90); // termurah se-universe
  });

  it('peringkat QVM melewati saham tipis (skor tetap ada)', () => {
    const out = computeFactors([
      row('TIP', { pbv: 0.3, roe: 30, score: 95, liquidity: 'tipis' }),
      row('LIQ', { pbv: 1.0, roe: 15, score: 60, liquidity: 'likuid' }),
      row('OLD', { pbv: 2.0, roe: 5, score: 30 }) // snapshot lama tanpa data likuiditas
    ]);
    const tip = out.find((r) => r.code === 'TIP')!;
    expect(tip.qvm).not.toBeNull();
    expect(tip.qvmRank).toBeNull();
    expect(out.find((r) => r.code === 'LIQ')!.qvmRank).toBe(1);
    expect(out.find((r) => r.code === 'OLD')!.qvmRank).toBe(2);
  });
});
