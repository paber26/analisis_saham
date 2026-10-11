// Shared UI helpers for KSEI month-end ownership (server/utils/ksei.ts).

interface SignalEval { label: string; meanIC: number; tStat: number; significant: boolean }
interface OwnershipEval { from: string; to: string; avgStocks: number; signals: (SignalEval & { nMonths: number })[] }

/** Change in percentage points: "+1,20 pp" / "−0,35 pp" / "—". */
export function fmtPp(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—';
  const s = Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s} pp`;
}

/** One-sentence verdict of the historical test, for footnotes. */
export function ownershipNote(ev: OwnershipEval | null | undefined): string {
  if (!ev) return 'Uji historis belum tersedia.';
  const n = ev.signals[0]?.nMonths ?? 0;
  const period = `${ev.from.slice(0, 7)} s/d ${ev.to.slice(0, 7)} (${n} bulan, ±${ev.avgStocks} saham/bulan)`;
  const sig = ev.signals.filter((s) => s.significant);
  if (!sig.length) {
    return `Diuji ${period}: perubahan kepemilikan asing, ritel lokal, maupun institusi lokal tidak terbukti memprediksi return bulan berikutnya — ini informasi, bukan sinyal beli/jual.`;
  }
  const parts = sig.map((s) => `${s.label}: IC ${s.meanIC} (t ${s.tStat}), ${s.meanIC > 0 ? 'searah' : 'berlawanan arah'}`);
  return `Diuji ${period}. Terbukti: ${parts.join('; ')}. Sinyal lain tidak terbukti.`;
}

/** SVG polyline points (viewBox 300×48) for a numeric series; null when < 2 points. */
export function sparkPoints(vals: (number | null)[]): { points: string; min: number; max: number } | null {
  const v = vals.filter((x): x is number => x != null && isFinite(x));
  if (v.length < 2) return null;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const points = v.map((x, i) => `${((i / (v.length - 1)) * 300).toFixed(1)},${(44 - ((x - min) / span) * 40).toFixed(1)}`).join(' ');
  return { points, min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10 };
}
