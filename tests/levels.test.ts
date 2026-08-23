import { describe, it, expect } from 'vitest';
import { computeLevels } from '../server/utils/levels';
import type { DailyBar } from '../server/utils/yahoo';
import { bars, geometric, dates } from './helpers';

/** Zigzag sinusoidal — menjamin adanya swing high/low dgn window ±3. */
function zigzag(n = 160): number[] {
  return Array.from({ length: n }, (_, i) => 100 + 8 * Math.sin((i * 2 * Math.PI) / 16));
}

describe('computeLevels — guards', () => {
  it('null untuk < 60 bar', () => {
    expect(computeLevels(bars(geometric(100, 0.003, 59)))).toBeNull();
  });
});

describe('computeLevels — pivot klasik', () => {
  it('pivot mengikuti rumus (H+L+C)/3 dari bar terakhir', () => {
    const b = bars(zigzag(120));
    const last: DailyBar = { ...b[b.length - 1]!, high: 204, low: 196, close: 200 };
    const bb = [...b.slice(0, -1), last];
    const lv = computeLevels(bb)!;
    // p=200 → r1=204, r2=208, s1=196, s2=192 (roundPrice ≥100 membulatkan)
    expect(lv.pivot.p).toBe(200);
    expect(lv.pivot.r1).toBe(204);
    expect(lv.pivot.r2).toBe(208);
    expect(lv.pivot.s1).toBe(196);
    expect(lv.pivot.s2).toBe(192);
  });
});

describe('computeLevels — fibonacci 52w', () => {
  it('level fib sesuai rentang high/low yang dikontrol', () => {
    const ds = dates(120);
    const raw = bars(zigzag(120), { dateList: ds });
    // paksa high52=220 & low52=70 via satu bar masing-masing
    // (natural series ~92..108, jadi ekstrem ini pasti dominan)
    const withExtremes: DailyBar[] = raw.map((bar, i) =>
      i === 10 ? { ...bar, high: 220 } : i === 40 ? { ...bar, low: 70 } : bar
    );
    const lv = computeLevels(withExtremes)!;
    const span = 220 - 70;
    const rp = (v: number) => Math.round(v); // roundPrice utk nilai >=100
    expect(lv.fib.high52).toBe(220);
    expect(lv.fib.low52).toBe(70);
    expect(lv.fib.l382).toBe(rp(220 - 0.382 * span)); // 162.7 → 163
    expect(lv.fib.l500).toBe(rp(220 - 0.5 * span));   // 145
    expect(lv.fib.l618).toBe(rp(220 - 0.618 * span)); // 127.3 → 127
  });
});

describe('computeLevels — rencana trade ATR', () => {
  const lv = computeLevels(bars(zigzag(160)))!;

  it('struktur plan valid: stop < entry ≤ target', () => {
    expect(lv.plan.stop).toBeGreaterThan(0);
    expect(lv.plan.stop).toBeLessThan(lv.plan.entry);
    expect(lv.plan.target).toBeGreaterThanOrEqual(lv.plan.entry);
  });

  it('rr & persen stop/target konsisten', () => {
    expect(lv.plan.rr).toBeGreaterThanOrEqual(0);
    expect(lv.plan.stopPct).toBeGreaterThan(0);
    const riskPct = ((lv.plan.entry - lv.plan.stop) / lv.plan.entry) * 100;
    expect(Math.abs(riskPct - lv.plan.stopPct)).toBeLessThan(1); // toleransi pembulatan
  });

  it('regime salah satu dari enum', () => {
    expect(['breakout', 'pullback', 'range']).toContain(lv.plan.regime);
  });

  it('support di bawah harga (desc), resistance di atas (asc)', () => {
    const price = lv.plan.entry;
    for (let i = 0; i < lv.supports.length; i++) {
      expect(lv.supports[i]!.price).toBeLessThan(price);
      if (i > 0) expect(lv.supports[i]!.price).toBeLessThanOrEqual(lv.supports[i - 1]!.price);
      expect(lv.supports[i]!.touches).toBeGreaterThanOrEqual(1);
    }
    for (let i = 0; i < lv.resistances.length; i++) {
      expect(lv.resistances[i]!.price).toBeGreaterThan(price);
      if (i > 0) expect(lv.resistances[i]!.price).toBeGreaterThanOrEqual(lv.resistances[i - 1]!.price);
    }
  });

  it('atr positif dan atrPct masuk akal', () => {
    expect(lv.atr).toBeGreaterThan(0);
    expect(lv.atrPct).toBeGreaterThan(0);
    expect(lv.atrPct).toBeLessThan(50);
  });
});
