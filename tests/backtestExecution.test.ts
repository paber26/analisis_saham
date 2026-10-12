import { describe, it, expect } from 'vitest';
import { tickSize, araPct, arbPct, halfSpread, buyBlocked, sellBlocked } from '../shared/utils/idxMarket';
import { runBacktest, rebalanceIndices, signalFor, FRICTIONLESS, IDX_EXECUTION, type SignalMatrix } from '../server/utils/backtest';
import type { DailyBar } from '../server/utils/yahoo';
import { bars, dates, geometric } from './helpers';

const bar = (o: number, h: number, l: number, c: number, date = '2024-01-02'): DailyBar => ({ date, open: o, high: h, low: l, close: c, volume: 1e6 });

describe('aturan bursa IDX', () => {
  it('fraksi harga & batas ARA per rentang harga', () => {
    expect([150, 300, 1000, 3000, 9000].map(tickSize)).toEqual([1, 2, 5, 10, 25]);
    expect([150, 1000, 9000].map(araPct)).toEqual([0.35, 0.25, 0.2]);
    expect(halfSpread(1000)).toBeCloseTo(0.0025);
  });
  it('rezim ARB sesuai tanggal', () => {
    expect(arbPct(1000, '2019-06-03')).toBe(0.25); // simetris
    expect(arbPct(1000, '2022-05-10')).toBe(0.07); // pandemi
    expect(arbPct(1000, '2023-07-03')).toBe(0.15);
    expect(arbPct(9000, '2024-02-01')).toBe(0.2);  // simetris lagi
    expect(arbPct(1000, '2025-06-02')).toBe(0.15);
  });
  it('beli gagal bila dibuka di ARA; jual gagal hanya bila terkunci di ARB sepanjang sesi', () => {
    expect(buyBlocked(bar(1250, 1250, 1250, 1250), 1000, true)).toBe(true);
    expect(buyBlocked(bar(1100, 1250, 1090, 1240), 1000, true)).toBe(false);
    expect(sellBlocked(bar(930, 930, 930, 930, '2022-05-10'), 1000)).toBe(true);
    expect(sellBlocked(bar(930, 960, 930, 950, '2022-05-10'), 1000)).toBe(false); // ada rentang → bisa jual
    expect(sellBlocked(bar(930, 930, 930, 930, '2024-02-01'), 1000)).toBe(false); // −7% bukan ARB saat simetris 25%
  });
});

const N = 430;
const DS = dates(N);
const ihsg = bars(geometric(7000, 0.0002, N), { dateList: DS });
const REB = rebalanceIndices(ihsg, 'monthly').filter((i) => i >= 200).map((i) => DS[i]!);

/** Flat stock at `p` (open = close) — returns come only from what a test edits. */
function flat(p: number): DailyBar[] {
  return DS.map((date) => ({ date, open: p, high: p * 1.01, low: p * 0.99, close: p, volume: 1e6 }));
}
/** Selection controlled by hand: sym is picked at the listed rebalance dates. */
function picks(spec: Record<string, string[]>): SignalMatrix {
  return new Map(Object.entries(spec).map(([sym, ds]) => [sym, new Map(ds.map((d) => [d, { ok: true, rank: 0 }]))]));
}

describe('runBacktest — model eksekusi', () => {
  it('tanpa friksi = rata-rata return close-to-close equal-weight (rumus lama tanpa biaya)', () => {
    const bySym = new Map([
      ['AAA', bars(geometric(100, 0.003, N), { dateList: DS, seed: 1 })],
      ['BBB', bars(geometric(120, 0.001, N), { dateList: DS, seed: 2 })],
      ['CCC', bars(geometric(150, -0.002, N), { dateList: DS, seed: 3 })]
    ]);
    const r = runBacktest(bySym, ihsg, signalFor('ma200'), { execution: FRICTIONLESS })!;
    // Rumus acuan: tiap periode, rata-rata close(t+1)/close(t) saham di atas MA200 pada t.
    const sig = signalFor('ma200');
    let eq = 100;
    for (let k = 0; k + 1 < REB.length; k++) {
      const rets: number[] = [];
      for (const b of bySym.values()) {
        const i = DS.indexOf(REB[k]!);
        const j = DS.indexOf(REB[k + 1]!);
        if (sig(b.slice(0, i + 1))) rets.push(b[j]!.close / b[i]!.close - 1);
      }
      eq *= 1 + (rets.length ? rets.reduce((a, c) => a + c, 0) / rets.length : 0);
    }
    expect(r.metrics.totalReturnPct).toBeCloseTo(eq - 100, 1);
    expect(r.trading.costPctPerYear).toBe(0);
  });

  it('biaya IDX menurunkan return; biaya & turnover dilaporkan', () => {
    const bySym = new Map([
      ['AAA', bars(geometric(100, 0.003, N), { dateList: DS, seed: 1 })],
      ['BBB', bars(geometric(120, 0.001, N), { dateList: DS, seed: 2 })]
    ]);
    // Ganti saham tiap bulan → banyak transaksi
    const m = picks({ AAA: REB.filter((_, i) => i % 2 === 0), BBB: REB.filter((_, i) => i % 2 === 1) });
    const gross = runBacktest(bySym, ihsg, () => false, { signals: m, execution: { ...IDX_EXECUTION, buyFeePct: 0, sellFeePct: 0, spread: false } })!;
    const net = runBacktest(bySym, ihsg, () => false, { signals: m })!;
    expect(net.metrics.totalReturnPct).toBeLessThan(gross.metrics.totalReturnPct);
    expect(net.trading.costPctPerYear).toBeGreaterThan(1); // ganti penuh tiap bulan ≈ 12 × (0,15+0,25+spread)
    expect(net.trading.sells).toBeGreaterThanOrEqual(REB.length - 3);
  });

  it('ARA: saham yang dibuka di batas atas tidak terbeli; porsinya tetap kas', () => {
    const x = flat(1000);
    const e = DS.indexOf(REB[0]!) + 1;
    x[e] = { ...x[e]!, open: 1250, high: 1250, low: 1250, close: 1250 }; // gap ke ARA (25%)
    for (let i = e + 1; i < N; i++) x[i] = { ...x[i]!, open: 1250, high: 1262, low: 1237, close: 1250 };
    const m = picks({ XXX: [REB[0]!] });
    const withAr = runBacktest(new Map([['XXX', x]]), ihsg, () => false, { signals: m })!;
    const noAr = runBacktest(new Map([['XXX', x]]), ihsg, () => false, { signals: m, execution: { ...IDX_EXECUTION, autoReject: false } })!;
    expect(withAr.trading.blockedBuys).toBe(1);
    expect(withAr.trading.buys).toBe(0);
    expect(withAr.metrics.totalReturnPct).toBe(0); // tetap kas
    expect(noAr.trading.buys).toBe(1);
  });

  it('ARB: jual tertunda selama terkunci di batas bawah dan terisi di harga lebih rendah', () => {
    const y = flat(1000);
    const e = DS.indexOf(REB[1]!) + 1; // hari eksekusi saat YYY dikeluarkan
    let p = 1000;
    for (let i = e; i < e + 3; i++) { p = Math.round(p * 0.93); y[i] = { ...y[i]!, open: p, high: p, low: p, close: p }; } // 3 hari ARB 7% (2022)
    for (let i = e + 3; i < N; i++) y[i] = { ...y[i]!, open: p, high: p * 1.01, low: p * 0.99, close: p };
    const m = picks({ YYY: [REB[0]!] });
    const withAr = runBacktest(new Map([['YYY', y]]), ihsg, () => false, { signals: m })!;
    const noAr = runBacktest(new Map([['YYY', y]]), ihsg, () => false, { signals: m, execution: { ...IDX_EXECUTION, autoReject: false } })!;
    expect(withAr.trading.delayedSells).toBe(1);
    expect(withAr.trading.avgDelayDays).toBe(3);
    expect(withAr.metrics.totalReturnPct).toBeLessThan(noAr.metrics.totalReturnPct - 10); // terjual ~804 vs 930 (≈ −12,5 poin)
    expect(noAr.trading.delayedSells).toBe(0);
  });
});
