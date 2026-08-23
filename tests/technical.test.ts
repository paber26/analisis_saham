import { describe, it, expect } from 'vitest';
import { analyzeTechnical } from '../server/utils/technical';
import { bars, geometric, randomWalk } from './helpers';

const RATING_RANK = { Kuat: 4, Menarik: 3, Netral: 2, Lemah: 1 } as const;

describe('analyzeTechnical — guards', () => {
  it('null untuk data < 30 bar', () => {
    expect(analyzeTechnical(bars(geometric(100, 0.005, 29)))).toBeNull();
  });

  it('null untuk harga flat/suspensi (guard likuiditas)', () => {
    const flat = new Array(120).fill(500);
    // variasikan sedikit di awal agar lolos cek panjang, tapi 60 hari terakhir flat
    const closes = [...geometric(100, 0.01, 60), ...flat];
    expect(analyzeTechnical(bars(closes))).toBeNull();
  });
});

describe('analyzeTechnical — indikator inti', () => {
  const closes = Array.from({ length: 300 }, (_, i) => i + 1); // ramp 1..300
  const t = analyzeTechnical(bars(closes))!;

  it('SMA20 = rata-rata 20 close terakhir', () => {
    const expected = (281 + 300) / 2; // mean(281..300)
    expect(t!.sma20).toBeCloseTo(expected, 1);
  });

  it('RSI = 100 pada uptrend murni (tanpa loss)', () => {
    const up = analyzeTechnical(bars(geometric(100, 0.01, 250)))!;
    expect(up.rsi).toBe(100);
  });

  it('RSI = 0 pada downtrend murni', () => {
    const down = analyzeTechnical(bars(geometric(100, -0.01, 250)))!;
    expect(down.rsi).toBe(0);
  });

  it('changePct konsisten dgn dua close terakhir', () => {
    const b = bars(geometric(100, 0.005, 100));
    const t2 = analyzeTechnical(b)!;
    const exp = ((b[99]!.close - b[98]!.close) / b[98]!.close) * 100;
    expect(t2.changePct).toBeCloseTo(exp, 1);
  });

  it('high52/low52 = max/min high & low pada window', () => {
    const b = bars(geometric(100, 0.005, 260));
    const t2 = analyzeTechnical(b)!;
    const win = b.slice(-252);
    expect(t2.high52).toBe(Math.round(Math.max(...win.map((x) => x.high)) * 100) / 100);
    expect(t2.low52).toBe(Math.round(Math.min(...win.map((x) => x.low)) * 100) / 100);
  });
});

describe('analyzeTechnical — skor & sinyal', () => {
  it('skor selalu dalam [0,100] untuk berbagai rezim', () => {
    for (const seed of [1, 7, 13, 42, 99]) {
      for (const sigma of [0.005, 0.02, 0.04]) {
        const t = analyzeTechnical(bars(randomWalk(1000, sigma, 260, seed)));
        expect(t).not.toBeNull();
        expect(t!.score).toBeGreaterThanOrEqual(0);
        expect(t!.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('uptrend dinilai lebih baik daripada downtrend', () => {
    const up = analyzeTechnical(bars(geometric(100, 0.006, 260)))!;
    const down = analyzeTechnical(bars(geometric(200, -0.006, 260)))!;
    expect(RATING_RANK[up.rating]).toBeGreaterThan(RATING_RANK[down.rating]);
    expect(up.signals.some((s) => s.label === 'Di atas MA200' && s.tone === 'bull')).toBe(true);
    expect(down.trade.action).not.toBe('beli');
  });

  it('volume spike terdeteksi pada volRatio', () => {
    const b = bars(geometric(100, 0.002, 100), { volume: 1_000_000 });
    b[b.length - 1]!.volume = 3_000_000; // ~3x rata-rata 20 hari sebelumnya
    const t = analyzeTechnical(b)!;
    expect(t.volRatio).toBeGreaterThan(2.5);
    expect(t.signals.some((s) => s.tone === 'bull' && s.label.includes('Volume'))).toBe(true);
  });

  it('trade signal punya struktur lengkap', () => {
    const t = analyzeTechnical(bars(randomWalk(500, 0.015, 260, 11)))!;
    expect(['beli', 'tahan', 'ambil-untung', 'cut-loss', 'hindari']).toContain(t.trade.action);
    expect([1, 2, 3]).toContain(t.trade.conviction);
    expect(t.trade.entryAdvice.length).toBeGreaterThan(5);
    expect(t.trade.exitAdvice.length).toBeGreaterThan(5);
  });
});
