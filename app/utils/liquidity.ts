// Shared UI helpers for the liquidity filter (data from TechResult.avgValue20 /
// .liquidity, computed server-side in server/utils/technical.ts).

export type LiquidityFilter = '' | 'no_tipis' | 'likuid';

/** "Rp 12,3 M" (miliar) / "Rp 1,2 T" / "Rp 850 jt" for an average daily traded value. */
export function fmtTradedValue(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '—';
  if (v >= 1e12) return `Rp ${(v / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 1 })} T`;
  if (v >= 1e9) return `Rp ${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
  return `Rp ${Math.round(v / 1e6).toLocaleString('id-ID')} jt`;
}

/**
 * Rows without liquidity data (snapshot made before this feature) pass the
 * filter, so the list never goes empty until the next daily sync fills it in.
 */
export function passesLiquidity(row: { liquidity?: string | null }, filter: LiquidityFilter): boolean {
  if (!filter || row.liquidity == null) return true;
  if (filter === 'no_tipis') return row.liquidity !== 'tipis';
  return row.liquidity === 'likuid';
}

export function liquidityBadge(row: { liquidity?: string | null; avgValue20?: number | null; zeroVolDays20?: number }) {
  if (row.liquidity == null) return null;
  const val = fmtTradedValue(row.avgValue20);
  const zero = row.zeroVolDays20 ? ` · ${row.zeroVolDays20} hari tanpa transaksi` : '';
  const title = `Rata-rata nilai transaksi 20 hari: ${val}/hari${zero}`;
  if (row.liquidity === 'tipis') return { label: 'Tipis', cls: 'text-rose-300 bg-rose-500/10 border-rose-500/30', title: `${title} — sinyal sulit dieksekusi di harga ini` };
  if (row.liquidity === 'sedang') return { label: 'Sedang', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/25', title };
  return { label: 'Likuid', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25', title };
}
