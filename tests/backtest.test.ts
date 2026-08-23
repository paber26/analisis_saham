import { describe, it, expect } from 'vitest';
import { runBacktest, signalFor } from '../server/utils/backtest';
import type { DailyBar } from '../server/utils/yahoo';
import { bars, dates, geometric } from './helpers';

// ~20 bulan kalender hari kerja → cukup untuk ≥6 rebalance setelah warm-up MA200
const N = 430;
const DS = dates(N);

function ihsg(): DailyBar[] {
  return bars(geometric(7000, 0.0002, N), { dateList: DS });
}

describe('runBacktest — guards', () => {
  it('null bila IHSG < 260 bar', () => {
    const short = bars(geometric(7000, 0.0002, 259), { dateList: DS });
    expect(runBacktest(new Map(), short, signalFor('ma200', 70))).toBeNull();
  });

  it('null bila rebalance < 6 bulan (universe terlalu pendek)', () => {
    // n=290: month-ends setelah warm-up idx≥200 ≈ 3 < 6
    const n = 290;
    const ds = dates(n);
    const bench = bars(geometric(7000, 0.0002, n), { dateList: ds });
    const bySym = new Map([['AAA', bars(geometric(100, 0.002, n), { dateList: ds })]]);
    expect(runBacktest(bySym, bench, signalFor('ma200', 70))).toBeNull();
  });
});

describe('runBacktest — sinyal tanpa look-ahead', () => {
  it('threshold mustahil (score≥101) → tidak pernah hold, equity datar 100', () => {
    const bySym = new Map<string, DailyBar[]>([
      ['UPUP', bars(geometric(100, 0.004, N), { dateList: DS })],
      ['DOWN', bars(geometric(100, -0.004, N), { dateList: DS })]
    ]);
    const r = runBacktest(bySym, ihsg(), signalFor('score', 101))!;
    expect(r).not.toBeNull();
    expect(r.metrics.avgHoldings).toBe(0);
    expect(r.metrics.totalReturnPct).toBe(0);
    expect(r.metrics.maxDrawdownPct).toBe(0);
    expect(r.equity.every((p) => p.strat === 100)).toBe(true);
  });
});

describe('runBacktest — strategi ma200 pada universe terdefinisi', () => {
  // UPUP selalu di atas MA200-nya (geometrik naik), DOWN selalu di bawah.
  const bySym = new Map<string, DailyBar[]>([
    ['UPUP', bars(geometric(100, 0.004, N), { dateList: DS })],
    ['DOWN', bars(geometric(150, -0.004, N), { dateList: DS })]
  ]);
  const r = runBacktest(bySym, ihsg(), signalFor('ma200', 70))!;

  it('hanya saham uptrend yang terpilih tiap rebalance', () => {
    expect(r).not.toBeNull();
    expect(r.metrics.avgHoldings).toBe(1);
    expect(r.metrics.winRatePct).toBe(100); // naik stabil tiap bulan
  });

  it('mengalahkan benchmark flat; metrik lengkap & konsisten', () => {
    expect(r.benchmark.totalReturnPct).toBeCloseTo(
      r.equity[r.equity.length - 1]!.ihsg - 100,
      0
    );
    expect(r.metrics.totalReturnPct).toBeGreaterThan(r.benchmark.totalReturnPct);
    expect(r.months).toBeGreaterThanOrEqual(6);
    expect(r.equity).toHaveLength(r.months + 1);
    expect(r.metrics.sharpe).toBeGreaterThan(0);
    expect(r.costPerRebalancePct).toBe(0.15);
  });

  it('kurva ekuitas tak menurun utk strategi win-rate 100%', () => {
    for (let i = 1; i < r.equity.length; i++) {
      expect(r.equity[i]!.strat).toBeGreaterThanOrEqual(r.equity[i - 1]!.strat * 0.999);
    }
  });
});
