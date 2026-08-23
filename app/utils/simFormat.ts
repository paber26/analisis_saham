// Shared formatters for the Simulasi Lab (pure, no Vue dependencies).

export const fmtIDR = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID');

export const fmtNum = (n: number | null | undefined, d = 1) =>
  n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtPct = (n: number | null | undefined, d = 1) =>
  n == null || !Number.isFinite(n) ? '—' : (n >= 0 ? '+' : '') + fmtNum(n, d) + '%';

export const ratingClass = (r: string) => r === 'Kuat' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
  : r === 'Menarik' ? 'text-sky-400 bg-sky-500/10 border-sky-500/30'
  : r === 'Lemah' ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
  : 'text-slate-400 bg-slate-500/10 border-slate-600/30';

export const actionLabel = (a: string) => (({ HOLD: 'Tahan', SELL: 'Jual', AVERAGE_DOWN: 'Avg Down', BUY: 'Beli' } as Record<string, string>)[a] || a);

export const yearsAgoDate = (y: number) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); return d.toISOString().split('T')[0]!; };

export const monthsAgoDate = (m: number) => { const d = new Date(); d.setMonth(d.getMonth() - m); return d.toISOString().split('T')[0]!; };
