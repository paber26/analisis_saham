import { describe, it, expect } from 'vitest';
import {
  lgamma, studentTCdf, studentTQuantile, fitGarchT, garchStepVars, garchFilter, calibrateBands, Z80
} from '../server/utils/volatility';
import { runForecast, type PricePoint } from '../server/utils/forecast';
import { rng, dates } from './helpers';

/** Simulate GARCH(1,1) with standardized Student-t innovations (integer nu). */
function simGarch(n: number, p: { omega: number; alpha: number; beta: number; nu: number }, seed = 11): number[] {
  const u = rng(seed);
  const norm = () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
  const r: number[] = [];
  let h = p.omega / (1 - p.alpha - p.beta);
  for (let t = 0; t < n; t++) {
    let chi = 0;
    for (let k = 0; k < p.nu; k++) { const z = norm(); chi += z * z; }
    const z = (norm() / Math.sqrt(chi / p.nu)) * Math.sqrt((p.nu - 2) / p.nu);
    const e = Math.sqrt(h) * z;
    r.push(e);
    h = p.omega + p.alpha * e * e + p.beta * h;
  }
  return r;
}
const TRUE = { omega: 0.015 ** 2 * (1 - 0.98), alpha: 0.08, beta: 0.9, nu: 6 };

describe('distribusi Student-t', () => {
  it('kuantil cocok dengan tabel', () => {
    expect(studentTQuantile(0.9, 5)).toBeCloseTo(1.4759, 3);
    expect(studentTQuantile(0.975, 10)).toBeCloseTo(2.2281, 3);
    expect(studentTQuantile(0.9, 1e7)).toBeCloseTo(Z80, 3); // ν besar → normal
  });
  it('CDF simetris & monoton; lgamma benar', () => {
    expect(studentTCdf(0, 4)).toBeCloseTo(0.5, 10);
    expect(studentTCdf(1.5, 4) + studentTCdf(-1.5, 4)).toBeCloseTo(1, 10);
    expect(studentTCdf(2, 4)).toBeGreaterThan(studentTCdf(1, 4));
    expect(lgamma(5)).toBeCloseTo(Math.log(24), 10);
    expect(lgamma(0.5)).toBeCloseTo(0.5 * Math.log(Math.PI), 10);
  });
});

describe('GARCH(1,1)-t — estimasi', () => {
  const r = simGarch(4000, TRUE);
  const fit = fitGarchT(r)!;

  it('memulihkan parameter dari data simulasi', () => {
    expect(fit).not.toBeNull();
    expect(Math.abs(fit.alpha - TRUE.alpha)).toBeLessThan(0.04);
    expect(Math.abs(fit.beta - TRUE.beta)).toBeLessThan(0.05);
    expect(Math.abs(fit.persistence - 0.98)).toBeLessThan(0.03);
    expect(fit.nu).toBeGreaterThan(3.5);
    expect(fit.nu).toBeLessThan(12);
    expect(Math.sqrt(fit.longRunVar)).toBeCloseTo(0.015, 2);
  });

  it('proyeksi varians kembali ke rata-rata jangka panjang', () => {
    const v = garchStepVars(fit, 4 * fit.longRunVar, 400);
    expect(v[0]).toBeCloseTo(4 * fit.longRunVar, 12);
    expect(v[399]! / fit.longRunVar).toBeCloseTo(1, 1);
    expect(v[1]!).toBeLessThan(v[0]!);
  });

  it('filter: h[t] hanya memakai return sebelum t', () => {
    const e = [0.01, -0.02, 0.03];
    const h = garchFilter({ omega: 1e-6, alpha: 0.1, beta: 0.8 }, e, 1e-4);
    expect(h).toHaveLength(4);
    expect(h[1]).toBeCloseTo(1e-6 + 0.1 * 0.0001 + 0.8 * 1e-4, 15);
  });

  it('null untuk data pendek / datar', () => {
    expect(fitGarchT(r.slice(0, 200))).toBeNull();
    expect(fitGarchT(new Array(500).fill(0))).toBeNull();
  });
});

describe('kalibrasi pita 80%', () => {
  const r = simGarch(1500, TRUE, 21);
  const rets = [0, ...r];
  // EWMA sigma setelah melihat rets[t] (sama dengan forecast.ts)
  const ewma: number[] = new Array(rets.length).fill(0);
  let v = 0.015 ** 2;
  for (let t = 1; t < rets.length; t++) { v = 0.94 * v + 0.06 * rets[t]! ** 2; ewma[t] = Math.sqrt(v); }
  ewma[0] = 0.015;
  const start = 700;
  const pre = fitGarchT(rets.slice(1, start + 1))!;

  it('cakupan out-of-sample pita terkalibrasi ≈ 80%', () => {
    const c = calibrateBands(rets, ewma, pre, start, 14)!;
    expect(c.q80).toHaveLength(14);
    expect(c.q80.every((q) => q > 0.5 && q < 3)).toBe(true);
    expect(c.calibratedCoverage!).toBeGreaterThan(70);
    expect(c.calibratedCoverage!).toBeLessThan(90);
    expect(c.ewmaCoverage).not.toBeNull();
    expect(c.garchCoverage).not.toBeNull();
  });

  it('tanpa GARCH → kalibrasi memakai EWMA; jendela terlalu kecil → null', () => {
    const c = calibrateBands(rets, ewma, null, start, 14)!;
    expect(c.garchCoverage).toBeNull();
    expect(c.calibratedCoverage).not.toBeNull();
    expect(calibrateBands(rets, ewma, pre, rets.length - 50, 14)).toBeNull();
  });
});

describe('runForecast memakai GARCH + pita terkalibrasi', () => {
  const r = simGarch(1250, TRUE, 5);
  const ds = dates(1251);
  let p = 5000;
  const pts: PricePoint[] = [{ date: ds[0]!, close: p }, ...r.map((x, i) => ({ date: ds[i + 1]!, close: (p = p * Math.exp(x)) }))];

  it('model GARCH, info kalibrasi lengkap, pita melebar monoton', () => {
    const res = runForecast(pts, 14)!;
    expect(res.vol.model).toBe('GARCH(1,1)-t');
    expect(res.vol.garch!.persistence).toBeGreaterThan(0.9);
    expect(res.vol.calibration!.nominal).toBe(80);
    expect(res.vol.calibration!.calibratedCoverage!).toBeGreaterThan(65);
    let prevW = 0;
    for (const f of res.forecast) {
      expect(f.lower).toBeLessThanOrEqual(f.mean);
      expect(f.mean).toBeLessThanOrEqual(f.upper);
      const w = Math.log(f.upper / f.lower);
      expect(w).toBeGreaterThanOrEqual(prevW - 1e-3); // pembulatan harga
      prevW = w;
    }
    expect(res.nextDay.probUp).toBeGreaterThan(0);
    expect(res.nextDay.probUp).toBeLessThan(100);
  });

  it('deterministik', () => {
    expect(JSON.stringify(runForecast(pts, 14))).toBe(JSON.stringify(runForecast(pts, 14)));
  });

  it('seri pendek (< 250 return) → fallback EWMA', () => {
    const res = runForecast(pts.slice(0, 220), 14)!;
    expect(res.vol.model).toBe('EWMA');
    expect(res.vol.garch).toBeNull();
  });
});
