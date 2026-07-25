// Compose the daily recommendation email from the latest screener snapshot.
// Pure/side-effect free so it can be unit-tested and reused by any transport.
// The "recommendation" = top-scored rows (rating Kuat/Menarik) from /api/sync.

import type { ScreenSnapshot, ScreenRow } from './store';

export interface DigestOptions {
  limit?: number; // how many top picks to include (default 10)
  siteUrl?: string;
}

const fmtIDR = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? '—' : 'Rp' + Math.round(n).toLocaleString('id-ID');
const fmtNum = (n: number | null | undefined, digits = 2): string =>
  n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const fmtPct = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? '—' : (n >= 0 ? '+' : '') + fmtNum(n, 1) + '%';

const RATING_COLOR: Record<string, string> = {
  Kuat: '#16a34a',
  Menarik: '#0284c7',
  Netral: '#64748b',
  Lemah: '#dc2626'
};

/** Pick the recommendation set: highest-scoring Kuat/Menarik names. */
export function pickRecommendations(rows: ScreenRow[], limit = 10): ScreenRow[] {
  return rows
    .filter((r) => r.rating === 'Kuat' || r.rating === 'Menarik')
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export interface DigestEmail {
  subject: string;
  html: string;
  text: string;
  count: number; // number of recommendations included
}

export function buildDailyDigest(snapshot: ScreenSnapshot, opts: DigestOptions = {}): DigestEmail {
  const limit = opts.limit ?? 10;
  const siteUrl = opts.siteUrl || 'https://saham.kuydinas.id';
  const picks = pickRecommendations(snapshot.rows, limit);

  const dateLabel = snapshot.date;
  const subject = picks.length
    ? `Rekomendasi Harian Saham — ${dateLabel} (${picks.length} pilihan)`
    : `Rekomendasi Harian Saham — ${dateLabel} (tidak ada sinyal kuat)`;

  const rowsHtml = picks
    .map((r, i) => {
      const color = RATING_COLOR[r.rating] || '#64748b';
      return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#94a3b8;">${i + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">
          <a href="${siteUrl}/analisa/${encodeURIComponent(r.code)}" style="color:#0f172a;font-weight:600;text-decoration:none;">${r.code}</a>
          <div style="color:#64748b;font-size:12px;">${escapeHtml(r.name || '')}${r.sector ? ' · ' + escapeHtml(r.sector) : ''}</div>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-variant-numeric:tabular-nums;">${fmtIDR(r.price)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">
          <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${color}1a;color:${color};font-size:12px;font-weight:600;">${escapeHtml(r.rating)}</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">${fmtNum(r.score, 0)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-variant-numeric:tabular-nums;">${fmtPct(r.rs3m)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-variant-numeric:tabular-nums;">${fmtNum(r.per, 1)}</td>
      </tr>`;
    })
    .join('');

  const emptyRow = `<tr><td colspan="7" style="padding:16px;text-align:center;color:#64748b;">Tidak ada saham dengan rating Kuat/Menarik hari ini.</td></tr>`;

  const html = `
  <div style="max-width:680px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <div style="padding:20px 0;border-bottom:2px solid #0f172a;">
      <div style="font-size:20px;font-weight:700;">📈 Rekomendasi Harian Saham</div>
      <div style="color:#64748b;font-size:13px;margin-top:4px;">Tanggal perdagangan ${dateLabel} · disaring dari ${snapshot.count} saham</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px;">
      <thead>
        <tr style="text-align:left;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.03em;">
          <th style="padding:8px 10px;">#</th>
          <th style="padding:8px 10px;">Saham</th>
          <th style="padding:8px 10px;text-align:right;">Harga</th>
          <th style="padding:8px 10px;text-align:center;">Rating</th>
          <th style="padding:8px 10px;text-align:right;">Skor</th>
          <th style="padding:8px 10px;text-align:right;">RS 3B</th>
          <th style="padding:8px 10px;text-align:right;">PER</th>
        </tr>
      </thead>
      <tbody>${picks.length ? rowsHtml : emptyRow}</tbody>
    </table>
    <div style="margin-top:20px;">
      <a href="${siteUrl}/screening" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Buka screener lengkap →</a>
    </div>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.5;">
      Skor 0–100 dari analisa teknikal transparan; RS 3B = kekuatan relatif 3 bulan vs IHSG.
      Ini bukan ajakan jual/beli — lakukan analisa & manajemen risiko sendiri.
    </div>
  </div>`;

  const text = picks.length
    ? [
        `Rekomendasi Harian Saham — ${dateLabel}`,
        `Disaring dari ${snapshot.count} saham.`,
        '',
        ...picks.map(
          (r, i) => `${i + 1}. ${r.code} — ${r.rating} · skor ${fmtNum(r.score, 0)} · ${fmtIDR(r.price)} · RS3B ${fmtPct(r.rs3m)} · PER ${fmtNum(r.per, 1)}`
        ),
        '',
        `Screener: ${siteUrl}/screening`
      ].join('\n')
    : `Rekomendasi Harian Saham — ${dateLabel}\n\nTidak ada saham dengan rating Kuat/Menarik hari ini.\n\nScreener: ${siteUrl}/screening`;

  return { subject, html, text, count: picks.length };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
