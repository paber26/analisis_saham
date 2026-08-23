import { describe, it, expect } from 'vitest';
import { buildBackfillRows } from '../server/utils/historyBackfill';
import { analyzeTechnical } from '../server/utils/technical';
import type { DailyBar } from '../server/utils/yahoo';
import { bars, dates, randomWalk } from './helpers';

const N = 320;
const DS = dates(N);

function ihsgBars(): DailyBar[] {
  return bars(randomWalk(7000, 0.008, N, 5), { dateList: DS });
}

function tickerBars(seed: number, start = 500): DailyBar[] {
  return bars(randomWalk(start, 0.012, N, seed), { dateList: DS });
}

function inputMap(extra: Record<string, DailyBar[]> = {}): Map<string, DailyBar[]> {
  return new Map(Object.entries({
    AAAA: tickerBars(11),
    BBBB: tickerBars(22, 300),
    ...extra
  }));
}

describe('buildBackfillRows — struktur hasil', () => {
  const res = buildBackfillRows(inputMap(), ihsgBars(), new Set());

  it('menghasilkan ≥15 hari historis (≈(320−210)/5), urut naik', () => {
    expect(res.days.length).toBeGreaterThanOrEqual(15);
    for (let i = 1; i < res.days.length; i++) {
      expect(res.days[i]!.date > res.days[i - 1]!.date).toBe(true);
    }
  });

  it('setiap hari punya baris semua ticker valid; field fundamental null', () => {
    for (const day of res.days) {
      expect(day.rows.map((r) => r.code).sort()).toEqual(['AAAA', 'BBBB']);
      for (const r of day.rows) {
        expect(r.per).toBeNull();
        expect(r.pbv).toBeNull();
        expect(r.roe).toBeNull();
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('QVM momentum-only terisi saat lintas-ticker tersedia', () => {
    const withTwo = res.days.find((d) => d.rows.length >= 2)!;
    expect(withTwo.rows.every((r) => r.qvm != null)).toBe(true);
  });
});

describe('buildBackfillRows — anti look-ahead & merge', () => {
  const map = inputMap();
  const aaaa = map.get('AAAA')!;
  const res = buildBackfillRows(map, ihsgBars(), new Set());

  it('skor pada tanggal t == analyzeTechnical(bars ≤ t) — bukan dari masa depan', () => {
    // sampling tiap 5 hari mulai indeks WARMUP → cari satu sampel apa pun
    const sample = res.days[res.days.length - 2]!;
    const row = sample.rows.find((r) => r.code === 'AAAA')!;
    const idx = aaaa.findIndex((b) => b.date === sample.date);
    expect(idx).toBeGreaterThanOrEqual(210); // pasti sudah lewat warm-up
    const tech = analyzeTechnical(aaaa.slice(0, idx + 1))!;
    expect(row.score).toBe(tech.score);
    expect(row.close).toBe(tech.price);
  });

  it('tanggal existing dilewati, tidak ditimpa', () => {
    const firstDate = res.days[0]!.date;
    const res2 = buildBackfillRows(map, ihsgBars(), new Set([firstDate]));
    expect(res2.skippedDates).toBeGreaterThanOrEqual(1);
    expect(res2.days.some((d) => d.date === firstDate)).toBe(false);
    expect(res2.days.length).toBe(res.days.length - 1);
  });
});

describe('buildBackfillRows — kasus tepi', () => {
  it('ticker < 211 bar diabaikan total (warm-up MA200)', () => {
    const short = bars(randomWalk(200, 0.01, 150, 33), { dateList: dates(150) });
    const res = buildBackfillRows(
      new Map([...inputMap(), ['CCCC', short]]),
      ihsgBars(),
      new Set()
    );
    expect(res.days.every((d) => !d.rows.some((r) => r.code === 'CCCC'))).toBe(true);
  });

  it('ticker tanpa irisan tanggal dgn IHSG → rs3m null tapi skor tetap ada', () => {
    // tanggal berbeda total (kalender lain): indeks bisnis N+11..2N+10, bebas irisan dgn DS
    const otherDates = dates(2 * N + 10).slice(N + 10);
    const lonely = bars(randomWalk(400, 0.01, N, 44), { dateList: otherDates });
    const res = buildBackfillRows(new Map([['DDDD', lonely]]), ihsgBars(), new Set());
    expect(res.days.length).toBeGreaterThan(0);
    expect(res.days.every((d) => d.rows.every((r) => r.rs3m === null && r.qvm === null))).toBe(true);
  });

  it('ticker flat/suspensi dibuang oleh guard analyzeTechnical', () => {
    const flatCloses = new Array(N).fill(1000);
    const res = buildBackfillRows(
      new Map([['FLAT', bars(flatCloses, { dateList: DS })]]),
      ihsgBars(),
      new Set()
    );
    // FLAT gagal guard likuiditas → tak ada hari yang terisi
    expect(res.days.length).toBe(0);
  });
});
