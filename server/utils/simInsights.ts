// Meta-learning across saved simulations. Reads every session, joins each
// decision to that stock's realized outcome, and aggregates into concrete
// "do this / avoid this" rules — the point of learning from the past.

import { loadAllSessions, type SimSession } from './simStore';

export interface InsightRule {
  kind: 'do' | 'avoid' | 'neutral';
  title: string;
  detail: string;
  samples: number;      // how many decisions support this
  avgReturnPct: number; // avg realized return of the affected positions
}

export interface InsightsReport {
  sessions: number;
  settledSessions: number;
  totalDecisions: number;
  avgSessionReturnPct: number | null;
  rules: InsightRule[];
}

// Group key: action × rating bucket.
function ratingBucket(rating: string): string {
  if (rating === 'Kuat' || rating === 'Menarik') return 'kuat/menarik';
  if (rating === 'Lemah') return 'lemah';
  return 'netral';
}

const ACTION_LABEL: Record<string, string> = {
  HOLD: 'Menahan (hold)',
  SELL: 'Menjual',
  AVERAGE_DOWN: 'Average down',
  BUY: 'Menambah beli'
};

export async function buildInsights(): Promise<InsightsReport> {
  const sessions = await loadAllSessions();
  const settled = sessions.filter((s) => s.status === 'settled' && s.result);

  // Map code→finalReturn per session so we can attribute a decision's outcome.
  const groups = new Map<string, { returns: number[]; action: string; bucket: string }>();
  let totalDecisions = 0;

  for (const s of settled) {
    const finalByCode = new Map<string, number>();
    for (const ps of s.result!.perStock) finalByCode.set(ps.code, ps.returnPct);

    for (const d of s.decisions) {
      totalDecisions++;
      const ret = finalByCode.get(d.code);
      if (ret == null) continue;
      const key = `${d.action}|${ratingBucket(d.rating)}`;
      const g = groups.get(key) || { returns: [], action: d.action, bucket: ratingBucket(d.rating) };
      g.returns.push(ret);
      groups.set(key, g);
    }
  }

  const rules: InsightRule[] = [];
  for (const [, g] of groups) {
    if (g.returns.length < 2) continue; // need a little support
    const avg = g.returns.reduce((a, b) => a + b, 0) / g.returns.length;
    const kind: InsightRule['kind'] = avg > 3 ? 'do' : avg < -3 ? 'avoid' : 'neutral';
    const actLabel = ACTION_LABEL[g.action] || g.action;
    rules.push({
      kind,
      title: `${actLabel} saham berating ${g.bucket}`,
      detail:
        kind === 'do'
          ? `Rata-rata berujung +${avg.toFixed(1)}% — pola yang cenderung menguntungkan.`
          : kind === 'avoid'
          ? `Rata-rata berujung ${avg.toFixed(1)}% — pola yang cenderung merugikan, hati-hati.`
          : `Rata-rata ${avg.toFixed(1)}% — dampak netral, belum konklusif.`,
      samples: g.returns.length,
      avgReturnPct: avg
    });
  }

  // Strongest signals first (by absolute average impact).
  rules.sort((a, b) => Math.abs(b.avgReturnPct) - Math.abs(a.avgReturnPct));

  const returns = settled.map((s) => s.result!.totalReturnPct);
  const avgSessionReturnPct = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : null;

  return {
    sessions: sessions.length,
    settledSessions: settled.length,
    totalDecisions,
    avgSessionReturnPct,
    rules
  };
}
