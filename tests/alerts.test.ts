import { describe, it, expect } from 'vitest';
import { evaluateAlerts, matchesRule, ALERT_TYPES } from '../server/utils/alerts';
import type { AlertRule } from '../server/utils/store';
import type { ScreenRow } from '../server/utils/store';

/** Fixture ScreenRow minimal dgn field teknikal yang dipakai evaluator. */
function row(code: string, f: Partial<ScreenRow>): ScreenRow {
  return {
    code,
    symbol: code + '.JK',
    name: code,
    sector: null,
    rs3m: null,
    per: null,
    pbv: null,
    roe: null,
    dividendYield: null,
    marketCap: null,
    revenueGrowth: null,
    earningsGrowth: null,
    debtToEquity: null,
    price: 5000,
    changePct: 0,
    sma20: null,
    sma50: null,
    sma200: null,
    rsi: 50,
    macd: 0,
    macdSignal: 0,
    macdHist: 0,
    adx: null,
    plusDI: null,
    minusDI: null,
    stochK: null,
    stochD: null,
    bbPercentB: null,
    bbBandwidth: null,
    atrPct: null,
    volRatio: null,
    high52: 6000,
    low52: 4000,
    pctFromHigh: -16.67,
    pctFromLow: 25,
    score: 55,
    rating: 'Netral',
    signals: [],
    trade: { action: 'tahan', entryAdvice: '', exitAdvice: '', conviction: 1 },
    ...f
  } as ScreenRow;
}

const TODAY = '2026-08-23';

function rule(partial: Partial<AlertRule> & { id: string }): AlertRule {
  return { code: '*', type: 'rsi_oversold', value: null, active: true, lastTriggeredAt: null, ...partial };
}

describe('evaluateAlerts — dedupe & status', () => {
  const rows = [row('AAAA', { rsi: 27 }), row('BBBB', { rsi: 55 })];

  it('RSI oversold trigger tepat sekali per hari; tidak spam saat re-run', () => {
    const rules = [rule({ id: 'r1', type: 'rsi_oversold' })]; // default <30
    const a = evaluateAlerts(rules, rows, TODAY);
    expect(a.triggers).toHaveLength(1);
    expect(a.firedIds).toEqual(['r1']);
    // re-run dengan lastTriggeredAt hari ini → nol (dedupe)
    const b = evaluateAlerts([{ ...rules[0]!, lastTriggeredAt: TODAY }], rows, TODAY);
    expect(b.triggers).toHaveLength(0);
    expect(b.firedIds).toHaveLength(0);
  });

  it('rule nonaktif diabaikan', () => {
    const a = evaluateAlerts([rule({ id: 'r2', active: false })], rows, TODAY);
    expect(a.triggers).toHaveLength(0);
  });

  it("code '*' mengevaluasi semua baris; kode spesifik hanya satu", () => {
    const all = evaluateAlerts([rule({ id: 'rA', code: '*' })], rows, TODAY); // AAAA kena saja
    expect(all.triggers.map((t) => t.code)).toEqual(['AAAA']);
    const specific = evaluateAlerts([rule({ id: 'rS', code: 'BBBB' })], rows, TODAY);
    expect(specific.triggers).toHaveLength(0); // BBBB RSI 55 → tidak kena
  });

  it('kode tak ada di snapshot → tidak error & tidak trigger', () => {
    const a = evaluateAlerts([rule({ id: 'rX', code: 'ZZZZ' })], rows, TODAY);
    expect(a.triggers).toHaveLength(0);
  });
});

describe('evaluateAlerts — tipe sinyal', () => {
  const rows = [
    row('OVER', { rsi: 29.4 }),
    row('BREAK', { pctFromHigh: -0.5 }),
    row('MA200UP', { sma200: 4800, price: 5100 }),
    row('SCOREHI', { score: 78 }),
    row('CHEAP', { price: 3100 }),
    row('VALUEUP', { per: 12.5, sma200: 4000, price: 4500 })
  ];

  it('breakout_52w: dalam 1% dari high', () => {
    const a = evaluateAlerts([rule({ id: 'b1', type: 'breakout_52w', code: 'BREAK' })], rows, TODAY);
    expect(a.triggers).toHaveLength(1);
    expect(a.triggers[0]!.message).toContain('high 52w');
  });

  it('above_ma200 & score_above pakai ambang custom', () => {
    const a = evaluateAlerts([
      rule({ id: 'm1', type: 'above_ma200', code: 'MA200UP' }),
      rule({ id: 's1', type: 'score_above', value: 75, code: 'SCOREHI' })
    ], rows, TODAY);
    expect(a.triggers).toHaveLength(2);
  });

  it('price_below & murah_uptrend sesuai kondisi', () => {
    const a = evaluateAlerts([
      rule({ id: 'p1', type: 'price_below', value: 3200, code: 'CHEAP' }),
      rule({ id: 'v1', type: 'murah_uptrend', code: 'VALUEUP' })
    ], rows, TODAY);
    expect(a.triggers).toHaveLength(2);
    // harga naik di atas target → tidak trigger
    const miss = evaluateAlerts([rule({ id: 'p2', type: 'price_below', value: 3000, code: 'CHEAP' })], rows, TODAY);
    expect(miss.triggers).toHaveLength(0);
  });

  it('murah_uptrend butuh PER valid & di atas MA200', () => {
    expect(matchesRule(rule({ id: 'x' }) as AlertRule, row('NOPE', { per: -3, sma200: 100, price: 200 }))).toBe(false);
    expect(matchesRule(rule({ id: 'y' }) as AlertRule, row('NOPE', { per: 10, sma200: 500, price: 400 }))).toBe(false);
  });

  it('semua tipe terdaftar punya label & hint untuk UI', () => {
    for (const t of ALERT_TYPES) {
      expect(t.label.length).toBeGreaterThan(3);
      expect(t.hint.length).toBeGreaterThan(5);
    }
  });
});
