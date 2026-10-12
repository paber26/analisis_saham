import { describe, it, expect } from 'vitest';
import { buyCost, sellProceeds, maxLots, tradeBlockReason, IDX_FEES } from '../shared/utils/idxMarket';

describe('biaya transaksi IDX (lot = 100 lembar)', () => {
  it('beli: nilai + spread ½ fraksi + fee 0,15%', () => {
    // BBCA 9.000: fraksi 25 → spread 12,5/9000; 1 lot = Rp900.000
    const { total, costs } = buyCost(9000, 100);
    expect(total).toBeCloseTo(900000 * (1 + 12.5 / 9000) * 1.0015, 2);
    expect(costs).toBeCloseTo(total - 900000, 6);
    expect(IDX_FEES).toEqual({ buyPct: 0.15, sellPct: 0.25 });
  });

  it('jual: nilai − spread − fee 0,25% (termasuk PPh final)', () => {
    const { net, costs } = sellProceeds(1000, 1000); // fraksi 5 → spread 0,25%
    expect(net).toBeCloseTo(1_000_000 * (1 - 0.0025) * (1 - 0.0025), 2);
    expect(costs).toBeCloseTo(1_000_000 - net, 6);
  });

  it('beli lalu jual di harga sama ≈ rugi biaya bolak-balik', () => {
    const lots = 10;
    const paid = buyCost(2500, lots * 100).total;
    const back = sellProceeds(2500, lots * 100).net;
    const roundTripPct = (1 - back / paid) * 100;
    expect(roundTripPct).toBeGreaterThan(0.4 + 0.39); // fee 0,4% + spread 2×0,2%
    expect(roundTripPct).toBeLessThan(0.81);
  });

  it('maxLots memperhitungkan biaya, tidak pernah melebihi kas', () => {
    const cash = 10_000_000;
    const lots = maxLots(cash, 1000);
    expect(buyCost(1000, lots * 100).total).toBeLessThanOrEqual(cash);
    expect(buyCost(1000, (lots + 1) * 100).total).toBeGreaterThan(cash);
    expect(lots).toBe(99); // 100 lot = Rp10 jt + biaya → tidak cukup
    expect(maxLots(0, 1000)).toBe(0);
    expect(maxLots(1e6, 0)).toBe(0);
  });
});

describe('tradeBlockReason (order di harga penutupan)', () => {
  const bar = (o: number, h: number, l: number, c: number, date = '2024-02-01') => ({ date, open: o, high: h, low: l, close: c });
  it('beli ditolak bila ditutup di ARA dengan antrean beli', () => {
    expect(tradeBlockReason('buy', bar(1100, 1250, 1090, 1250), 1000)).toMatch(/ARA/);
    expect(tradeBlockReason('buy', bar(1100, 1250, 1090, 1200), 1000)).toBeNull(); // sempat ARA, ditutup di bawahnya
    expect(tradeBlockReason('sell', bar(1100, 1250, 1090, 1250), 1000)).toBeNull(); // jual di ARA bisa
  });
  it('jual ditolak bila terkunci di ARB sepanjang sesi', () => {
    expect(tradeBlockReason('sell', bar(750, 750, 750, 750), 1000)).toMatch(/ARB/);
    expect(tradeBlockReason('sell', bar(760, 800, 750, 750), 1000)).toBeNull(); // ada rentang → ada pembeli
    expect(tradeBlockReason('buy', bar(750, 750, 750, 750), 1000)).toBeNull();  // beli di ARB bisa
  });
  it('tidak ada bar = tidak diperdagangkan; tanpa harga acuan tidak diblokir', () => {
    expect(tradeBlockReason('buy', null, 1000)).toMatch(/tidak ada perdagangan/);
    expect(tradeBlockReason('sell', bar(750, 750, 750, 750), null)).toBeNull();
  });
});
