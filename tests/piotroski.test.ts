import { describe, it, expect } from 'vitest';
import { parseTimeseries, computePiotroski, TIMESERIES_TYPES, TIMESERIES_FALLBACK_TYPES, TIMESERIES_QUERY_TYPES, type AnnualFinancials } from '../server/utils/piotroski';
import { computeFactors } from '../server/utils/factor';
import type { ScreenRow } from '../server/utils/store';

/** Respons berbentuk ws/fundamentals-timeseries Yahoo. */
function yahooJson(rows: Partial<AnnualFinancials>[]) {
  const result = Object.entries(TIMESERIES_TYPES).map(([field, type]) => ({
    meta: { symbol: ['TEST.JK'], type: [type] },
    timestamp: rows.map((_, i) => 1700000000 + i),
    [type]: rows.map((r) => {
      const v = (r as any)[field];
      return v == null ? null : { asOfDate: r.asOfDate, periodType: '12M', currencyCode: 'IDR', reportedValue: { raw: v, fmt: String(v) } };
    })
  }));
  return { timeseries: { result, error: null } };
}

const Y2022: Partial<AnnualFinancials> = { asOfDate: '2022-12-31', netIncome: 80, totalAssets: 1000, operatingCashFlow: 90, longTermDebt: 300, currentAssets: 400, currentLiabilities: 300, sharesIssued: 1000, grossProfit: 300, totalRevenue: 1000 };
const Y2023: Partial<AnnualFinancials> = { asOfDate: '2023-12-31', netIncome: 100, totalAssets: 1100, operatingCashFlow: 150, longTermDebt: 280, currentAssets: 500, currentLiabilities: 300, sharesIssued: 1000, grossProfit: 360, totalRevenue: 1150 };
const Y2024: Partial<AnnualFinancials> = { asOfDate: '2024-12-31', netIncome: 130, totalAssets: 1200, operatingCashFlow: 200, longTermDebt: 250, currentAssets: 600, currentLiabilities: 300, sharesIssued: 1000, grossProfit: 440, totalRevenue: 1300 };

describe('parseTimeseries', () => {
  it('menyusun satu baris per tahun buku, urut lama → baru, nilai kosong = null', () => {
    const rows = parseTimeseries(yahooJson([Y2023, Y2022, { ...Y2024, grossProfit: null }]));
    expect(rows.map((r) => r.asOfDate)).toEqual(['2022-12-31', '2023-12-31', '2024-12-31']);
    expect(rows[2]!.netIncome).toBe(130);
    expect(rows[2]!.grossProfit).toBeNull();
    expect(rows[0]!.sharesIssued).toBe(1000);
  });
  it('respons kosong/rusak → array kosong', () => {
    expect(parseTimeseries(null)).toEqual([]);
    expect(parseTimeseries({ timeseries: { result: [{ meta: { type: ['unknownType'] } }] } })).toEqual([]);
  });

  // Emiten non-bank IDX: arus kas metode langsung → Yahoo hanya punya tipe "...Direct".
  const DIRECT = TIMESERIES_FALLBACK_TYPES.operatingCashFlow!;
  function asDirect(json: any, keepPrimary = false) {
    const cfo = json.timeseries.result.find((r: any) => r.meta.type[0] === TIMESERIES_TYPES.operatingCashFlow);
    const direct = { ...cfo, meta: { ...cfo.meta, type: [DIRECT] }, [DIRECT]: cfo[TIMESERIES_TYPES.operatingCashFlow] };
    delete direct[TIMESERIES_TYPES.operatingCashFlow];
    const rest = json.timeseries.result.filter((r: any) => r !== cfo);
    return { timeseries: { result: keepPrimary ? [direct, ...json.timeseries.result] : [...rest, direct] } };
  }

  it('arus kas metode langsung dipakai bila tipe utama kosong → 9 sinyal dinilai', () => {
    expect(TIMESERIES_QUERY_TYPES).toContain(DIRECT);
    const rows = parseTimeseries(asDirect(yahooJson([Y2022, Y2023, Y2024])));
    expect(rows[2]!.operatingCashFlow).toBe(200);
    const r = computePiotroski(rows)!;
    expect(r.max).toBe(9);
    expect(r.score).toBe(9);
  });

  it('tipe utama menang atas fallback, apa pun urutan respons', () => {
    const json = asDirect(yahooJson([Y2022, Y2023, Y2024]), true);
    const direct = json.timeseries.result[0];
    direct[DIRECT] = direct[DIRECT].map((p: any) => ({ ...p, reportedValue: { raw: -1 } }));
    expect(parseTimeseries(json)[2]!.operatingCashFlow).toBe(200);
    json.timeseries.result.reverse();
    expect(parseTimeseries(json)[2]!.operatingCashFlow).toBe(200);
  });
});

describe('computePiotroski', () => {
  it('perusahaan yang membaik di semua sisi → 9/9', () => {
    const r = computePiotroski(parseTimeseries(yahooJson([Y2022, Y2023, Y2024])))!;
    expect(r.max).toBe(9);
    expect(r.score).toBe(9);
    expect(r.fiscalYear).toBe('2024-12-31');
  });

  it('memburuk: rugi, kas negatif, utang naik, terbitkan saham → skor rendah', () => {
    const bad: Partial<AnnualFinancials> = { asOfDate: '2024-12-31', netIncome: -50, totalAssets: 1200, operatingCashFlow: -20, longTermDebt: 500, currentAssets: 300, currentLiabilities: 400, sharesIssued: 1300, grossProfit: 250, totalRevenue: 1000 };
    const r = computePiotroski(parseTimeseries(yahooJson([Y2022, Y2023, bad])))!;
    expect(r.score).toBeLessThanOrEqual(1);
    const get = (k: string) => r.signals.find((s) => s.key === k)!.pass;
    expect(get('roa')).toBe(false);
    expect(get('cfo')).toBe(false);
    expect(get('dlever')).toBe(false);
    expect(get('noissue')).toBe(false);
    expect(get('accrual')).toBe(true); // kas (-20) > laba (-50): satu-satunya yang lolos
  });

  it('bank: current ratio & margin kotor tidak dinilai (maks 7)', () => {
    const r = computePiotroski(parseTimeseries(yahooJson([Y2022, Y2023, Y2024])), true)!;
    expect(r.max).toBe(7);
    expect(r.signals.find((s) => s.key === 'dliquid')!.pass).toBeNull();
    expect(r.signals.find((s) => s.key === 'dmargin')!.pass).toBeNull();
  });

  it('data kurang (1 tahun / < 5 sinyal) → null', () => {
    expect(computePiotroski(parseTimeseries(yahooJson([Y2024])))).toBeNull();
    const sparse = [{ asOfDate: '2023-12-31', netIncome: 1 }, { asOfDate: '2024-12-31', netIncome: 2 }] as AnnualFinancials[];
    expect(computePiotroski(sparse)).toBeNull();
  });
});

describe('faktor QVM memakai EV/EBITDA & F-Score', () => {
  const row = (code: string, f: Partial<ScreenRow>) => ({
    code, symbol: code + '.JK', name: code, sector: null, rs3m: null, per: null, pbv: null, roe: null,
    dividendYield: null, marketCap: null, revenueGrowth: null, earningsGrowth: null, debtToEquity: null, ...f
  } as ScreenRow);

  it('EV/EBITDA rendah → Value lebih tinggi; F-Score tinggi → Quality lebih tinggi', () => {
    const out = computeFactors([
      row('AAA', { evEbitda: 4, fScore: 8, fScoreMax: 9 }),
      row('BBB', { evEbitda: 12, fScore: 3, fScoreMax: 9 }),
      row('CCC', { evEbitda: 20, fScore: 5, fScoreMax: 9 })
    ]);
    const by = (c: string) => out.find((r) => r.code === c)!;
    expect(by('AAA').value!).toBeGreaterThan(by('BBB').value!);
    expect(by('BBB').value!).toBeGreaterThan(by('CCC').value!);
    expect(by('AAA').quality!).toBeGreaterThan(by('CCC').quality!);
    expect(by('CCC').quality!).toBeGreaterThan(by('BBB').quality!);
  });

  it('F-Score bank dinilai sebagai proporsi (6/7 setara 7.7/9)', () => {
    const out = computeFactors([
      row('BNK', { fScore: 6, fScoreMax: 7 }),
      row('IND', { fScore: 7, fScoreMax: 9 })
    ]);
    expect(out.find((r) => r.code === 'BNK')!.quality!).toBeGreaterThan(out.find((r) => r.code === 'IND')!.quality!);
  });
});
