import { describe, it, expect } from 'vitest';
import { touchProb, tradeEdge, runForecast, type PricePoint } from '../server/utils/forecast';
import { previousCloseOf } from '../server/utils/yahoo';
import { dates, randomWalk } from './helpers';

// Standard normal CDF reference (independent of the implementation's erf).
function phi(x: number): number {
  // Zelen & Severo 26.2.17
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

// Seeded Monte Carlo of a fine-grained drifted random walk in log-price.
function mcTouch(barrier: number, mu: number, sigma: number, horizon: number, paths = 20000, sub = 50): number {
  let s = 12345; // mulberry32
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) + 0.5) / 4294967296;
  };
  const dt = 1 / sub;
  let hits = 0;
  for (let p = 0; p < paths; p++) {
    let x = 0;
    for (let k = 0; k < horizon * sub; k++) {
      const z = Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
      x += mu * dt + sigma * Math.sqrt(dt) * z;
      if (barrier > 0 ? x >= barrier : x <= barrier) { hits++; break; }
    }
  }
  return hits / paths;
}

describe('touchProb — peluang menyentuh level dalam horizon', () => {
  it('tanpa drift = 2 × peluang berakhir di luar level (reflection principle)', () => {
    const sigma = 0.0205, h = 14, b = Math.log(1.0616);
    const terminalAbove = 1 - phi(b / (sigma * Math.sqrt(h)));
    expect(touchProb(b, 0, sigma, h)).toBeCloseTo(2 * terminalAbove, 3);
    expect(touchProb(-b, 0, sigma, h)).toBeCloseTo(2 * terminalAbove, 3);
  });

  it('kasus ADRO di layar: target +6,16% bukan 80% (bug lama = P tidak tercapai)', () => {
    const sigma = 0.0205, mu = -0.0004, h = 14;
    const pTarget = touchProb(Math.log(1.0616), mu, sigma, h);
    const pStop = touchProb(Math.log(1 - 0.041), mu, sigma, h);
    expect(pTarget).toBeLessThan(0.5);
    expect(pTarget).toBeGreaterThan(0.3);
    expect(pStop).toBeGreaterThan(pTarget); // stop lebih dekat & drift negatif
  });

  it('cocok dengan Monte Carlo saat ada drift (naik & turun)', () => {
    const sigma = 0.02, h = 14;
    for (const mu of [0.003, -0.003]) {
      expect(touchProb(0.06, mu, sigma, h)).toBeCloseTo(mcTouch(0.06, mu, sigma, h), 1);
      expect(touchProb(-0.04, mu, sigma, h)).toBeCloseTo(mcTouch(-0.04, mu, sigma, h), 1);
    }
  });

  it('monoton: level makin jauh → peluang makin kecil; drift searah menaikkan', () => {
    const s = 0.02;
    expect(touchProb(0.08, 0, s, 14)).toBeLessThan(touchProb(0.04, 0, s, 14));
    expect(touchProb(0.06, 0.002, s, 14)).toBeGreaterThan(touchProb(0.06, 0, s, 14));
    expect(touchProb(-0.06, 0.002, s, 14)).toBeLessThan(touchProb(-0.06, 0, s, 14));
  });

  it('selalu dalam [0,1], termasuk kasus ekstrem / sigma 0', () => {
    for (const [b, mu, s] of [[0.05, 0.5, 0.001], [-0.05, -0.5, 0.001], [0.05, 0, 0], [0.05, 0.01, 0]] as const) {
      const p = touchProb(b, mu, s, 14);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    expect(touchProb(0.05, 0.01, 0, 14)).toBe(1); // drift saja sudah sampai
    expect(touchProb(0.05, 0, 0, 14)).toBe(0);
  });
});

describe('tradeEdge — ekspektasi berbobot payoff', () => {
  it('tanpa drift dengan stop 2σ / target 3σ → netral (bukan otomatis negatif)', () => {
    const s = 0.02, h = 14;
    const pS = touchProb(Math.log(1 - 2 * s), 0, s, h);
    const pT = touchProb(Math.log(1 + 3 * s), 0, s, h);
    expect(pS).toBeGreaterThan(pT);
    expect(tradeEdge(pS, pT, 4, 6)).toBe('netral');
  });

  it('drift kuat positif → positif; negatif → negatif', () => {
    const s = 0.02, h = 14;
    const odds = (mu: number) => tradeEdge(
      touchProb(Math.log(0.96), mu, s, h), touchProb(Math.log(1.06), mu, s, h), 4, 6);
    expect(odds(0.004)).toBe('positif');
    expect(odds(-0.004)).toBe('negatif');
  });
});

describe('runForecast.tradeOdds — terintegrasi', () => {
  it('tren naik kuat → P(target) > P(stop) dan edge positif', () => {
    const ds = dates(400);
    const noise = randomWalk(1, 0.01, 400, 5);
    const pts: PricePoint[] = ds.map((d, i) => ({ date: d, close: 1000 * Math.exp(0.004 * i) * noise[i]! }));
    const r = runForecast(pts, 14)!;
    expect(r.tradeOdds.probUpToTarget).toBeGreaterThan(r.tradeOdds.probDownToStop);
    expect(r.tradeOdds.edge).toBe('positif');
  });

  it('random walk → kedua peluang wajar (tidak ada 80%+ palsu)', () => {
    const ds = dates(300);
    const pts = randomWalk(5000, 0.015, 300, 3).map((c, i) => ({ date: ds[i]!, close: c }));
    const r = runForecast(pts, 14)!;
    expect(r.tradeOdds.probUpToTarget).toBeLessThan(70);
    expect(r.tradeOdds.probDownToStop).toBeLessThan(85);
  });
});

describe('previousCloseOf — penutupan sesi sebelumnya', () => {
  it('ambil close kedua terakhir, bukan close awal rentang', () => {
    const closes = [1730, 1800, 2400, 2550, 2580]; // setahun lalu … hari ini
    expect(previousCloseOf(closes, 2580)).toBe(2550);
    expect(((2580 - previousCloseOf(closes, 2580)) / 2550) * 100).toBeCloseTo(1.18, 2);
  });

  it('fallback bila data kurang / tidak valid', () => {
    expect(previousCloseOf([2580], 2580)).toBe(2580);
    expect(previousCloseOf([], 100)).toBe(100);
    expect(previousCloseOf([0, 2580], 2580)).toBe(2580);
  });
});
