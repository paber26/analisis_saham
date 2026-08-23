import { describe, it, expect } from 'vitest';
import { runForecast, type PricePoint } from '../server/utils/forecast';
import { dates, randomWalk } from './helpers';

function points(n: number, seed = 7): PricePoint[] {
  const ds = dates(n);
  return randomWalk(5000, 0.015, n, seed).map((c, i) => ({ date: ds[i]!, close: c }));
}

describe('runForecast — guards & struktur', () => {
  it('null untuk < 150 titik', () => {
    expect(runForecast(points(149))).toBeNull();
  });

  it('hasil lengkap pada seri 300 titik (jalur 1 fold)', () => {
    const r = runForecast(points(300), 10)!;
    expect(r).not.toBeNull();
    expect(r.forecast).toHaveLength(10);
    expect(Object.keys(r.metrics).sort()).toEqual(['ar', 'drift', 'ensemble', 'holt', 'naive', 'reg']);
    // Walk-forward jujur: train + test = seluruh data, tanpa overlap
    expect(r.trainSize + r.testSize).toBe(300);
    expect(r.trainSize).toBeGreaterThanOrEqual(120);
    expect(r.testSize).toBeGreaterThan(0);
  });

  it('deterministik — dua run identik', () => {
    const a = JSON.stringify(runForecast(points(300)));
    const b = JSON.stringify(runForecast(points(300)));
    expect(a).toBe(b);
  });
});

describe('runForecast — pita probabilitas', () => {
  it('lower ≤ mean ≤ upper di semua horizon', () => {
    const r = runForecast(points(300), 14)!;
    for (const f of r.forecast) {
      expect(f.lower).toBeLessThanOrEqual(f.mean);
      expect(f.mean).toBeLessThanOrEqual(f.upper);
    }
  });

  it('lebar pita tumbuh monoton dgn √h', () => {
    const r = runForecast(points(300), 14)!;
    for (let i = 1; i < r.forecast.length; i++) {
      const wPrev = r.forecast[i - 1]!.upper - r.forecast[i - 1]!.lower;
      const wCur = r.forecast[i]!.upper - r.forecast[i]!.lower;
      expect(wCur).toBeGreaterThanOrEqual(wPrev - 0.02); // toleransi pembulatan
    }
  });

  it('probUp ∈ [0,100] dan konsisten dgn arah expected return', () => {
    const r = runForecast(points(300))!;
    expect(r.nextDay.probUp).toBeGreaterThanOrEqual(0);
    expect(r.nextDay.probUp).toBeLessThanOrEqual(100);
    if (r.nextDay.direction === 'up') expect(r.nextDay.expectedReturnPct).toBeGreaterThanOrEqual(0);
    else expect(r.nextDay.expectedReturnPct).toBeLessThanOrEqual(0);
  });

  it('tradeOdds: stop < target; edge enum valid', () => {
    const r = runForecast(points(300))!;
    expect(r.tradeOdds.stopPct).toBeGreaterThan(0);
    expect(r.tradeOdds.targetPct).toBeGreaterThan(r.tradeOdds.stopPct);
    expect(['positif', 'negatif', 'netral']).toContain(r.tradeOdds.edge);
    expect(['rendah', 'normal', 'tinggi']).toContain(r.vol.regime);
    expect(r.vol.annualPct).toBeGreaterThan(0);
  });
});

describe('runForecast — tanggal forward & bobot ensemble', () => {
  it('tanggal forecast = hari kerja setelah tanggal terakhir (tanpa weekend)', () => {
    const r = runForecast(points(300), 10)!;
    let prev = new Date(r.lastDate + 'T00:00:00Z');
    for (const f of r.forecast) {
      const d = new Date(f.date + 'T00:00:00Z');
      expect(d.getTime()).toBeGreaterThan(prev.getTime());
      expect(d.getUTCDay()).not.toBe(0);
      expect(d.getUTCDay()).not.toBe(6);
      prev = d;
    }
  });

  it('bobot ensemble (bila ada) menjumlah ≈100 dan modelnya valid', () => {
    const r = runForecast(points(300))!;
    const total = r.weights.reduce((a, b) => a + b.weight, 0);
    if (r.weights.length > 0) {
      expect(Math.abs(total - 100)).toBeLessThan(1);
      for (const w of r.weights) expect(w.weight).toBeGreaterThan(0);
    } else {
      // fallback jujur ke naive
      expect(total).toBe(0);
    }
  });

  it('prediksi seri kontinu: sekali mulai, tidak null lagi', () => {
    const r = runForecast(points(300))!;
    const idxFirst = r.series.findIndex((p) => p.pred != null);
    expect(idxFirst).toBeGreaterThanOrEqual(0);
    for (let i = idxFirst; i < r.series.length; i++) {
      expect(r.series[i]!.pred).not.toBeNull();
    }
  });
});
