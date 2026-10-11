import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { unzipFirst } from '../server/utils/unzip';
import { parseBalancepos, evaluateOwnership, latestOwnership, ownershipSeries, monthEndCandidates, type OwnershipMonth, type OwnershipRow } from '../server/utils/ksei';

/** ZIP satu file; `descriptor` meniru arsip yang ukurannya nol di local header. */
function makeZip(name: string, content: string, method: 0 | 8, descriptor = false): Buffer {
  const raw = Buffer.from(content);
  const data = method === 8 ? deflateRawSync(raw) : raw;
  const fname = Buffer.from(name);
  const loc = Buffer.alloc(30);
  loc.writeUInt32LE(0x04034b50, 0);
  loc.writeUInt16LE(method, 8);
  loc.writeUInt32LE(descriptor ? 0 : data.length, 18);
  loc.writeUInt32LE(descriptor ? 0 : raw.length, 22);
  loc.writeUInt16LE(fname.length, 26);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(method, 10);
  cen.writeUInt32LE(data.length, 20);
  cen.writeUInt32LE(raw.length, 24);
  cen.writeUInt16LE(fname.length, 28);
  cen.writeUInt32LE(0, 42);
  const cdOffset = loc.length + fname.length + data.length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cen.length + fname.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  return Buffer.concat([loc, fname, data, cen, fname, eocd]);
}

// Potongan asli BalanceposEfek20260930 (+ satu baris non-saham).
const SAMPLE = [
  'Date|Code|Type|Sec. Num|Price|Local IS|Local CP|Local PF|Local IB|Local ID|Local MF|Local SC|Local FD|Local OT|Total|Foreign IS|Foreign CP|Foreign PF|Foreign IB|Foreign ID|Foreign MF|Foreign SC|Foreign FD|Foreign OT|Total',
  '30-SEP-2026|BBCA|EQUITY|123275050000|6075|2443936090|671347885|325321300|437363600|11035044652|1210601063|106939090|73781960|14333700|16318669340|649668050|623633631|5028638519|2276862272|328344780|20806195113|409080321|325704405|5686894689|36135021780',
  '30-SEP-2026|ABBA|EQUITY|3935892857|30|0|2368198705|0|0|1064725115|0|480|71|0|3432924371|0|1300000|0|41020085|657600|0|1754300|0|0|44731985',
  '30-SEP-2026|ZAMD01XXSCFS|MUTUAL FUND|1000|1|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0'
].join('\n');

describe('unzipFirst', () => {
  it('deflate, stored, dan data descriptor', () => {
    expect(unzipFirst(makeZip('a.txt', SAMPLE, 8))!.toString()).toBe(SAMPLE);
    expect(unzipFirst(makeZip('a.txt', SAMPLE, 0))!.toString()).toBe(SAMPLE);
    expect(unzipFirst(makeZip('a.txt', SAMPLE, 8, true))!.toString()).toBe(SAMPLE);
  });
  it('bukan zip → null', () => {
    expect(unzipFirst(Buffer.from('<!DOCTYPE html><html>404</html>'.padEnd(200, ' ')))).toBeNull();
  });
});

describe('parseBalancepos', () => {
  it('hanya saham, total lokal/asing, ritel & institusi', () => {
    const m = parseBalancepos(SAMPLE)!;
    expect(m.date).toBe('2026-09-30');
    expect(Object.keys(m.rows).sort()).toEqual(['ABBA', 'BBCA']);
    const b = m.rows.BBCA!;
    expect(b.price).toBe(6075);
    expect(b.local).toBe(16318669340);
    expect(b.foreign).toBe(36135021780);
    expect(b.retail).toBe(11035044652);
    expect(b.inst).toBe(1210601063 + 2443936090 + 325321300 + 437363600);
  });
  it('header tidak dikenal → null', () => {
    expect(parseBalancepos('a|b\n1|2')).toBeNull();
  });
});

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pasar sintetis: `beta` = seberapa kuat Δ asing 3 bln mendorong return bulan berikutnya. */
function market(beta: number, nMonths = 40, nStocks = 80, seed = 1): OwnershipMonth[] {
  const rnd = mulberry32(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const fShare: number[] = Array.from({ length: nStocks }, () => 0.2 + 0.4 * rnd());
  const hist: number[][] = [];
  const price: number[] = Array.from({ length: nStocks }, () => 1000);
  const out: OwnershipMonth[] = [];
  for (let m = 0; m < nMonths; m++) {
    const rows: Record<string, OwnershipRow> = {};
    for (let i = 0; i < nStocks; i++) {
      if (m > 0) {
        const d3 = m >= 4 ? fShare[i]! - hist[m - 4]![i]! : 0;
        price[i] = price[i]! * Math.exp(beta * d3 * 100 * 0.01 + 0.06 * gauss());
        fShare[i] = Math.min(0.9, Math.max(0.05, fShare[i]! + 0.01 * gauss()));
      }
      const heldTotal = 1e9;
      rows[`S${String(i).padStart(3, '0')}`] = { price: price[i]!, shares: 2e9, foreign: fShare[i]! * heldTotal, local: (1 - fShare[i]!) * heldTotal, retail: 0.3 * heldTotal, inst: 0.1 * heldTotal };
    }
    hist.push([...fShare]);
    out.push({ date: `20${String(20 + Math.floor(m / 12)).padStart(2, '0')}-${String((m % 12) + 1).padStart(2, '0')}-28`, rows });
  }
  return out;
}

describe('evaluateOwnership', () => {
  it('Δ asing yang benar-benar mendorong return → IC positif & signifikan', () => {
    const ev = evaluateOwnership(market(3))!;
    const f3 = ev.signals.find((s) => s.key === 'foreign3')!;
    expect(f3.nMonths).toBeGreaterThan(30);
    expect(f3.meanIC).toBeGreaterThan(0.1);
    expect(f3.significant).toBe(true);
    expect(f3.spreadPct).toBeGreaterThan(0);
  });
  it('tanpa hubungan → tidak mengklaim sinyal', () => {
    const ev = evaluateOwnership(market(0, 40, 80, 7))!;
    const f3 = ev.signals.find((s) => s.key === 'foreign3')!;
    expect(Math.abs(f3.meanIC)).toBeLessThan(0.08);
    expect(f3.significant).toBe(false);
  });
  it('saham dengan pemecahan saham (jumlah saham berubah) dilewati', () => {
    const ms = market(3, 12, 40);
    const split = ms.map((m, k) => ({ ...m, rows: { ...m.rows, SPLT: { price: k < 8 ? 5000 : 1000, shares: k < 8 ? 2e9 : 1e10, foreign: 5e8, local: 5e8, retail: 1e8, inst: 1e8 } } }));
    const a = evaluateOwnership(ms)!;
    const b = evaluateOwnership(split)!;
    expect(b.avgStocks).toBeLessThanOrEqual(a.avgStocks + 1);
  });
});

describe('latestOwnership & ownershipSeries', () => {
  const row = (foreign: number, shares = 1e9): OwnershipRow => ({ price: 1000, shares, foreign, local: 1000 - foreign, retail: 300, inst: 100 });
  const ms: OwnershipMonth[] = [
    { date: '2026-06-30', rows: { AAAA: row(300), BBBB: row(500) } },
    { date: '2026-07-31', rows: { AAAA: row(320), BBBB: row(500) } },
    { date: '2026-08-31', rows: { AAAA: row(330), BBBB: row(500, 5e9) } },
    { date: '2026-09-30', rows: { AAAA: row(360), BBBB: row(450, 5e9) } }
  ];
  it('Δ dalam poin persen; perubahan jumlah saham → null', () => {
    const l = latestOwnership(ms);
    expect(l.AAAA!.foreignPct).toBe(36);
    expect(l.AAAA!.dForeign1).toBe(3);
    expect(l.AAAA!.dForeign3).toBe(6);
    expect(l.BBBB!.dForeign1).toBe(-5);
    expect(l.BBBB!.dForeign3).toBeNull();
  });
  it('seri bulanan urut lama → baru', () => {
    const s = ownershipSeries(ms, 'AAAA');
    expect(s.map((p) => p.foreignPct)).toEqual([30, 32, 33, 36]);
  });
});

describe('monthEndCandidates', () => {
  it('hari kerja terakhir dulu, akhir pekan dilewati', () => {
    expect(monthEndCandidates(2026, 1)[0]).toBe('20260130');
    expect(monthEndCandidates(2026, 2)[0]).toBe('20260227');
    expect(monthEndCandidates(2024, 12).slice(0, 2)).toEqual(['20241231', '20241230']);
  });
});
