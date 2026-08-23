// Rule-based alert evaluation against the daily screener snapshot.
//
// Semantics are STATE-based (what is true today), not event-based — a single
// snapshot row cannot know yesterday. Honesty rule: the UI/labels say "kondisi
// hari ini", and dedupe (lastTriggeredAt == trading day) means a rule notifies
// at most once per WIB trading day even while the condition keeps holding.

import type { AlertRule, AlertTrigger, ScreenRow } from './store';

export const ALERT_TYPES: { value: AlertRule['type']; label: string; hint: string; needsValue: boolean; default?: number }[] = [
  { value: 'rsi_oversold', label: 'RSI oversold', hint: 'RSI harian di bawah ambang (default 30).', needsValue: true, default: 30 },
  { value: 'breakout_52w', label: 'Menyentuh high 52w', hint: 'Harga dalam 1% dari high 52 minggu.', needsValue: false },
  { value: 'above_ma200', label: 'Di atas MA200', hint: 'Kondisi hari ini: harga di atas SMA200.', needsValue: false },
  { value: 'score_above', label: 'Skor ≥ ambang', hint: 'Skor teknikal 0-100 melewati ambang (default 70).', needsValue: true, default: 70 },
  { value: 'price_below', label: 'Harga ≤ target beli', hint: 'Harga close turun ke/sampai di bawah angka (Rp).', needsValue: true },
  { value: 'murah_uptrend', label: 'Murah + Uptrend', hint: 'PER 0–15 dan harga di atas MA200.', needsValue: false }
];

function threshold(rule: AlertRule): number | null {
  const v = rule.value;
  return typeof v === 'number' && isFinite(v) ? v : null;
}

/** Does one row satisfy the rule condition? Pure. */
export function matchesRule(rule: AlertRule, row: ScreenRow): boolean {
  switch (rule.type) {
    case 'rsi_oversold': {
      const th = threshold(rule) ?? 30;
      return row.rsi != null && row.rsi < th;
    }
    case 'breakout_52w':
      // pctFromHigh ≈ 0 saat harga tepat di high 52 minggu
      return row.high52 > 0 && row.pctFromHigh >= -1;
    case 'above_ma200':
      return row.sma200 != null && row.price > row.sma200;
    case 'score_above': {
      const th = threshold(rule) ?? 70;
      return typeof row.score === 'number' && row.score >= th;
    }
    case 'price_below': {
      const th = threshold(rule);
      return th != null && th > 0 && row.price > 0 && row.price <= th;
    }
    case 'murah_uptrend':
      return (
        row.per != null && row.per > 0 && row.per <= 15 &&
        row.sma200 != null && row.price > row.sma200
      );
    default:
      return false;
  }
}

function messageFor(rule: AlertRule, row: ScreenRow): string {
  const price = `${row.price.toLocaleString('id-ID')}`;
  switch (rule.type) {
    case 'rsi_oversold':
      return `${row.code} RSI ${Math.round(row.rsi!)} (<${threshold(rule) ?? 30}) — harga ${price}`;
    case 'breakout_52w':
      return `${row.code} menyentuh high 52w (${row.pctFromHigh}%) — harga ${price}`;
    case 'above_ma200':
      return `${row.code} di atas MA200 — harga ${price} vs MA200 ${Math.round(row.sma200!).toLocaleString('id-ID')}`;
    case 'score_above':
      return `${row.code} skor teknikal ${row.score} (≥${threshold(rule) ?? 70}) — harga ${price}`;
    case 'price_below':
      return `${row.code} harga ${price} ≤ target ${threshold(rule)!.toLocaleString('id-ID')}`;
    case 'murah_uptrend':
      return `${row.code} murah+uptrend (PER ${row.per}, di atas MA200) — harga ${price}`;
    default:
      return `${row.code} alert`;
  }
}

export interface EvalResult {
  /** Triggers fired THIS run (already deduped & capped per rule). */
  triggers: AlertTrigger[];
  /** Rule ids that fired — caller must persist lastTriggeredAt for these. */
  firedIds: string[];
}

/**
 * Evaluate rules against snapshot rows for `today` (WIB YYYY-MM-DD).
 * Rules already triggered today are skipped → no spam on re-runs.
 */
export function evaluateAlerts(rules: AlertRule[], rows: ScreenRow[], today: string): EvalResult {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const triggers: AlertTrigger[] = [];
  const firedIds: string[] = [];

  for (const rule of rules) {
    if (rule.active === false) continue;
    if (rule.lastTriggeredAt === today) continue; // sudah notif hari ini

    const targets =
      rule.code === '*'
        ? rows
        : byCode.get(rule.code)
          ? [byCode.get(rule.code)!]
          : [];

    let firedFor = 0;
    for (const row of targets) {
      try {
        if (!matchesRule(rule, row)) continue;
        firedFor++;
        triggers.push({
          id: `tr_${Date.now().toString(36)}_${firedIds.length}_${firedFor}_${Math.random().toString(36).slice(2, 6)}`,
          ruleId: rule.id,
          code: row.code,
          type: rule.type,
          message: messageFor(rule, row),
          date: today
        });
      } catch { /* satu baris rusak tak boleh matikan evaluasi */ }
    }
    if (firedFor > 0) firedIds.push(rule.id);
  }

  return { triggers, firedIds };
}
