<script setup lang="ts">
useHead({
  title: 'Arsitektur — Simulasi Mesin Waktu Reksa Dana | Saham IDX',
  meta: [{ name: 'description', content: 'Cetak biru arsitektur fitur simulasi reksa dana masa lampau: screening point-in-time, playback harga, keputusan hold/jual/average-down, regresi linear berganda, dan pembelajaran meta dari kinerja masa lampau.' }]
});

// Daftar isi untuk navigasi cepat di satu halaman.
const toc = [
  { id: 'konsep', label: '1. Konsep & Tujuan' },
  { id: 'alur', label: '2. Alur Pengguna' },
  { id: 'sistem', label: '3. Arsitektur Sistem' },
  { id: 'data', label: '4. Model Data' },
  { id: 'api', label: '5. API Endpoints' },
  { id: 'asof', label: '6. Screening Point-in-Time' },
  { id: 'playback', label: '7. Mesin Playback & Keputusan' },
  { id: 'mlr', label: '8. Regresi Linear Berganda' },
  { id: 'belajar', label: '9. Pembelajaran Meta' },
  { id: 'caveat', label: '10. Isu Metodologis' },
  { id: 'roadmap', label: '11. Roadmap Implementasi' },
  { id: 'files', label: '12. Berkas yang Dibuat' }
];
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
    <!-- Header -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 border border-slate-800 shadow-xl">
      <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="relative z-10">
        <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            PANDUAN CARA KERJA — fitur sudah live
          </div>
          <NuxtLink to="/simulasi" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors">▶ Buka Simulasi</NuxtLink>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-50 tracking-tight">
          🕰️ Panduan — Simulasi Mesin Waktu Reksa Dana
        </h1>
        <p class="text-sm text-slate-400 mt-3 max-w-3xl leading-relaxed">
          Kembali ke tanggal di masa lalu, lihat <span class="text-emerald-400 font-semibold">screening saham apa adanya saat itu</span> (tanpa tahu masa depan),
          susun keranjang saham layaknya seorang manajer reksa dana, lalu <span class="text-emerald-400 font-semibold">putar pergerakan harganya hari demi hari</span>.
          Di tiap titik keputusan kamu memilih <span class="text-slate-200 font-semibold">HOLD · JUAL · AVERAGE DOWN</span>. Di akhir, sistem menjalankan
          <span class="text-emerald-400 font-semibold">regresi linear berganda</span> untuk menjelaskan apa yang mendorong naik/turun, menyimpan analisanya,
          dan lama-kelamaan memberi rekomendasi <span class="text-slate-200 font-semibold">apa yang sebaiknya dilakukan & dihindari</span> untuk menekan risiko.
        </p>
      </div>
    </div>

    <!-- Daftar isi -->
    <nav class="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
      <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Daftar Isi</div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
        <a v-for="t in toc" :key="t.id" :href="`#${t.id}`"
          class="text-xs font-semibold text-slate-400 hover:text-emerald-400 px-3 py-2 rounded-lg hover:bg-slate-800/60 transition-colors">
          {{ t.label }}
        </a>
      </div>
    </nav>

    <!-- 1. KONSEP -->
    <section id="konsep" class="scroll-mt-20 space-y-4">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2"><span class="text-emerald-400">1.</span> Konsep &amp; Tujuan</h2>
      <div class="grid md:grid-cols-3 gap-4">
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="text-2xl mb-2">🎯</div>
          <div class="font-bold text-slate-100 text-sm mb-1">Belajar dari Masa Lampau</div>
          <p class="text-xs text-slate-400 leading-relaxed">Latihan pengambilan keputusan pada data nyata yang sudah terjadi — bukan tebak-tebakan masa depan, tapi menguji naluri &amp; disiplin pada sejarah yang objektif.</p>
        </div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="text-2xl mb-2">🧺</div>
          <div class="font-bold text-slate-100 text-sm mb-1">Racik Reksa Dana</div>
          <p class="text-xs text-slate-400 leading-relaxed">Pilih beberapa saham + bobot alokasi &amp; modal awal, seolah menjadi manajer investasi yang menyusun portofolio, lalu ukur kinerjanya secara jujur.</p>
        </div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="text-2xl mb-2">📉</div>
          <div class="font-bold text-slate-100 text-sm mb-1">Regresi = Penjelas</div>
          <p class="text-xs text-slate-400 leading-relaxed">Regresi linear berganda mengurai faktor (skor, RS, valuasi, momentum) yang berkorelasi dengan return ke depan — memisahkan keputusan bagus dari keberuntungan.</p>
        </div>
      </div>
      <div class="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4 text-xs text-emerald-200/80 leading-relaxed">
        <span class="font-bold text-emerald-300">Prinsip kunci — tanpa lookahead:</span> layar dan sinyal yang kamu lihat pada tanggal T <span class="font-semibold">hanya boleh</span> memakai data ≤ T.
        Masa depan dikunci sampai kamu tekan "maju". Inilah yang membuat latihan ini valid sebagai pembelajaran.
      </div>
    </section>

    <!-- 2. ALUR PENGGUNA -->
    <section id="alur" class="scroll-mt-20 space-y-4">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2"><span class="text-emerald-400">2.</span> Alur Pengguna (User Journey)</h2>
      <div class="grid gap-3">
        <div v-for="(step, i) in [
          { t: 'Pilih Titik Waktu', d: 'Pilih tanggal atau periode di masa lalu (mis. 2 Jan 2024). Sistem menyiapkan “kapsul waktu” — semua data dibatasi sampai tanggal itu.' },
          { t: 'Pelajari Screening As-Of', d: 'Tabel screening apa adanya pada tanggal tersebut (skor teknikal, RS, valuasi) — dihitung ulang dari bar harga ≤ T. Kamu belum tahu apa yang terjadi setelahnya.' },
          { t: 'Susun Keranjang (Beli)', d: 'Pilih beberapa saham, tentukan bobot/lot & modal awal. Ini menetapkan harga masuk (entry) pada tanggal T.' },
          { t: 'Putar Waktu (Playback)', d: 'Animasi harga bergerak maju hari-demi-hari. Kurva ekuitas portofolio terbentuk real-time; kamu melihat cuan/rugi berkembang.' },
          { t: 'Titik Keputusan', d: 'Secara berkala playback berhenti & bertanya: HOLD, JUAL (sebagian/penuh), atau AVERAGE DOWN. Setiap keputusan dicatat beserta konteksnya.' },
          { t: 'Setelmen & Analisa', d: 'Di akhir horizon: metrik kinerja (return, drawdown, win-rate) + regresi linear berganda yang menjelaskan pendorong naik/turun.' },
          { t: 'Simpan & Belajar', d: 'Sesi disimpan. Seiring banyak sesi, mesin insight merangkum pola “lakukan ini / hindari itu” untuk menekan risiko.' }
        ]" :key="i" class="flex gap-4 items-start rounded-xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="shrink-0 w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-sm flex items-center justify-center">{{ i + 1 }}</div>
          <div>
            <div class="font-bold text-slate-100 text-sm">{{ step.t }}</div>
            <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">{{ step.d }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. ARSITEKTUR SISTEM -->
    <section id="sistem" class="scroll-mt-20 space-y-4">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2"><span class="text-emerald-400">3.</span> Arsitektur Sistem</h2>
      <p class="text-xs text-slate-400 leading-relaxed">Menempel pada pipeline yang sudah ada: <code class="text-emerald-300">yahoo.ts</code> (bar harga), <code class="text-emerald-300">technical.ts</code> (skor, murni atas bar), <code class="text-emerald-300">history.ts</code> (riwayat harian), dan store berbasis file. Tiga lapisan baru: <span class="text-slate-200">As-Of Engine</span>, <span class="text-slate-200">Playback Engine</span> (klien), dan <span class="text-slate-200">Regression + Insights</span>.</p>
      <div class="rounded-xl bg-slate-950 border border-slate-800 p-4 overflow-x-auto">
        <pre v-pre class="text-[11px] leading-relaxed text-slate-300 font-mono whitespace-pre">
┌──────────────────────────── KLIEN (Halaman /simulasi) ─────────────────────────────┐
│  Wizard 1-layar:  [Pilih Tanggal] → [Screening As-Of] → [Racik Keranjang]           │
│                   → [Playback + Keputusan] → [Hasil + Regresi] → [Simpan]           │
│                                                                                     │
│  Playback Engine (klien): timer/rAF, kontrol play·pause·step·kecepatan,             │
│  ECharts (candlestick + kurva ekuitas), prompt keputusan HOLD/JUAL/AVG-DOWN         │
└───────────────┬─────────────────────────────────────────────────────┬───────────────┘
                │  fetch                                                │  fetch
                ▼                                                       ▼
┌──────────── SERVER API (server/api/sim/*) ────────────┐   ┌──────── SERVER API ────────┐
│  GET  /sim/screen?date=…    → screening point-in-time │   │  POST /sim/session  simpan │
│  GET  /sim/prices?codes=…   → deret harga utk animasi │   │  GET  /sim/session/:id     │
│  POST /sim/regression       → OLS + prediksi          │   │  GET  /sim/insights meta   │
└───────┬───────────────────────────┬───────────────────┘   └──────────┬─────────────────┘
        ▼                           ▼                                   ▼
┌─ As-Of Engine ─────────┐  ┌─ Regression Engine ───┐        ┌─ Sim Store (file) ────────┐
│ technical.ts atas bar  │  │ regression.ts: OLS via │        │ .data-store/simulations/  │
│ di-slice ≤ T (no look- │  │ (XᵀX)⁻¹Xᵀy, R², t-stat │        │   &lt;id&gt;.json  + index.json │
│ ahead). history.ts bila│  │ (murni TS, tanpa dep)  │        │ Insights engine baca semua│
│ tersedia; else re-hitung│  └───────────────────────┘        │ sesi → pola lakukan/hindari│
└──────────┬─────────────┘                                    └───────────────────────────┘
           ▼
   yahoo.ts (bar 1y+ berakhir di T)   ·   idxTickers.ts (universe)
        </pre>
      </div>
    </section>

    <!-- 4. MODEL DATA -->
    <section id="data" class="scroll-mt-20 space-y-4">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2"><span class="text-emerald-400">4.</span> Model Data</h2>
      <div class="rounded-xl bg-slate-950 border border-slate-800 p-4 overflow-x-auto">
        <pre v-pre class="text-[11px] leading-relaxed text-slate-300 font-mono whitespace-pre">
// Satu sesi simulasi (disimpan sebagai .data-store/simulations/&lt;id&gt;.json)
interface SimSession {
  id: string;               // uuid/nanoid
  createdAt: string;        // ISO
  startDate: string;        // T0 — tanggal masuk (YYYY-MM-DD)
  horizonDays: number;      // panjang simulasi (mis. 20/60/120 hari bursa)
  decisionEveryDays: number;// jeda titik keputusan (mis. tiap 5 hari bursa)
  initialCapital: number;   // modal awal (IDR)
  picks: SimPick[];         // saham terpilih + entry
  decisions: SimDecision[]; // jejak keputusan sepanjang playback
  result: SimResult | null; // diisi saat setelmen
  status: 'draft' | 'running' | 'settled';
}

interface SimPick {
  code: string;             // 'BBCA'
  entryDate: string;        // = startDate (atau saat average-down berikutnya)
  entryPrice: number;       // harga close pada entryDate
  lots: number;             // 1 lot = 100 lembar
  weightPct: number;        // bobot alokasi awal
}

interface SimDecision {
  date: string;             // tanggal bursa saat keputusan
  code: string;
  action: 'HOLD' | 'SELL' | 'AVERAGE_DOWN' | 'BUY';
  lots: number;             // 0 utk HOLD; jumlah lot utk SELL/AVG-DOWN
  price: number;            // harga eksekusi (close hari itu)
  unrealizedPct: number;    // %P/L posisi saat keputusan (konteks belajar)
  note?: string;
}

interface SimResult {
  endDate: string;
  finalValue: number; totalReturnPct: number;
  maxDrawdownPct: number; winRate: number; realizedPnl: number;
  perStock: { code: string; returnPct: number; contributionPct: number }[];
  regression: RegressionResult | null;   // lihat §8
}
        </pre>
      </div>
    </section>

    <!-- 5. API -->
    <section id="api" class="scroll-mt-20 space-y-4">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2"><span class="text-emerald-400">5.</span> API Endpoints (<code class="text-emerald-300 text-base">server/api/sim/*</code>)</h2>
      <div class="rounded-xl border border-slate-800 overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider">
            <tr>
              <th class="text-left px-4 py-3 font-bold">Method &amp; Route</th>
              <th class="text-left px-4 py-3 font-bold">Fungsi</th>
              <th class="text-left px-4 py-3 font-bold">Sumber / Catatan</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/70 text-slate-300">
            <tr v-for="(r, i) in [
              { m: 'GET', e: '/api/sim/screen?date=&period=', f: 'Screening point-in-time pada tanggal T (skor, RS, valuasi).', s: 'As-Of Engine · history.ts / recompute' },
              { m: 'GET', e: '/api/sim/prices?codes=&from=&to=', f: 'Deret harga OHLC untuk animasi playback.', s: 'yahoo.ts (bar disesuaikan)' },
              { m: 'POST', e: '/api/sim/session', f: 'Buat/simpan sesi (picks, modal, horizon).', s: 'simStore.ts' },
              { m: 'GET', e: '/api/sim/session/:id', f: 'Muat sesi tersimpan (lanjut/tinjau).', s: 'simStore.ts' },
              { m: 'POST', e: '/api/sim/session/:id/settle', f: 'Setelmen: hitung metrik + jalankan regresi.', s: 'regression.ts' },
              { m: 'POST', e: '/api/sim/regression', f: 'OLS ad-hoc: return ~ fitur, plus prediksi.', s: 'regression.ts' },
              { m: 'GET', e: '/api/sim/insights', f: 'Rangkuman meta lintas sesi: lakukan/hindari.', s: 'Insights engine' }
            ]" :key="i">
              <td class="px-4 py-3 font-mono whitespace-nowrap">
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold mr-1.5" :class="r.m === 'GET' ? 'bg-sky-500/15 text-sky-300' : 'bg-emerald-500/15 text-emerald-300'">{{ r.m }}</span>
                <span class="text-slate-200">{{ r.e }}</span>
              </td>
              <td class="px-4 py-3 text-slate-400">{{ r.f }}</td>
              <td class="px-4 py-3 text-slate-500">{{ r.s }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-[11px] text-slate-500">Semua endpoint di-gate oleh sesi login yang sudah ada. Endpoint berat (screening as-of universe penuh) memakai cache harian per-tanggal seperti pola <code>store.ts</code>.</p>
    </section>

    <!-- 6. AS-OF -->
    <section id="asof" class="scroll-mt-20 space-y-4">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2"><span class="text-emerald-400">6.</span> Screening Point-in-Time (inti anti-lookahead)</h2>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
          <div class="font-bold text-slate-100 text-sm">✅ Teknikal — akurat historis</div>
          <p class="text-xs text-slate-400 leading-relaxed"><code class="text-emerald-300">analyzeTechnical()</code> murni atas array bar. Untuk tanggal T cukup potong bar sampai indeks T lalu hitung ulang skor/RS. Hasilnya identik dengan apa yang akan terlihat di masa itu — <span class="text-emerald-300">nol lookahead</span>.</p>
        </div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
          <div class="font-bold text-amber-300 text-sm">⚠️ Fundamental — keterbatasan</div>
          <p class="text-xs text-slate-400 leading-relaxed">Yahoo hanya memberi snapshot fundamental <span class="italic">terkini</span>, bukan point-in-time. Maka mode historis <span class="text-slate-200">default menonaktifkan</span> kolom fundamental (PER/PBV/ROE) atau menandainya “perkiraan”. Skor teknikal tetap menjadi tulang punggung screening as-of.</p>
        </div>
      </div>
      <div class="rounded-xl bg-slate-950 border border-slate-800 p-4 overflow-x-auto">
        <pre v-pre class="text-[11px] leading-relaxed text-slate-300 font-mono whitespace-pre">
// Inti As-Of Engine (server/utils/asof.ts)
async function screenAsOf(dateT: string, codes: string[]) {
  const rows = [];
  for (const code of codes) {
    const bars = await fetchDailyBars(code, '2y');       // ambil histori panjang
    const upto = bars.filter(b =&gt; b.date &lt;= dateT);       // KUNCI: potong ≤ T
    if (upto.length &lt; 60) continue;                       // butuh histori cukup
    const tech = analyzeTechnical(upto);                  // skor as-of (murni)
    rows.push({ code, price: upto.at(-1).close, ...tech });
  }
  return rows.sort((a, b) =&gt; b.score - a.score);
}
        </pre>
      </div>
    </section>

    <!-- 7. PLAYBACK -->
    <section id="playback" class="scroll-mt-20 space-y-4">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2"><span class="text-emerald-400">7.</span> Mesin Playback &amp; Titik Keputusan</h2>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
          <div class="font-bold text-slate-100 text-sm">Animasi (klien)</div>
          <ul class="text-xs text-slate-400 leading-relaxed space-y-1 list-disc pl-4">
            <li>Ambil bar harga keranjang dari <code class="text-emerald-300">entryDate → endDate</code> di awal (satu kali).</li>
            <li>Kursor waktu maju via <code>setInterval</code>/rAF; kontrol play · pause · step · kecepatan (1×–10×).</li>
            <li>ECharts: candlestick per saham + kurva ekuitas portofolio yang tumbuh live.</li>
            <li>Masa depan “disembunyikan” sampai kursor melewatinya — menjaga ketidaktahuan.</li>
          </ul>
        </div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
          <div class="font-bold text-slate-100 text-sm">Titik Keputusan</div>
          <ul class="text-xs text-slate-400 leading-relaxed space-y-1 list-disc pl-4">
            <li>Setiap <code>decisionEveryDays</code>, playback pause &amp; memunculkan prompt.</li>
            <li>Aksi: <span class="text-emerald-300 font-semibold">HOLD</span> · <span class="text-rose-300 font-semibold">JUAL</span> (sebagian/penuh) · <span class="text-amber-300 font-semibold">AVERAGE DOWN</span> (tambah saat turun).</li>
            <li>Konteks ditampilkan: %P/L berjalan, skor teknikal terbaru as-of, drawdown.</li>
            <li>Tiap keputusan → <code>SimDecision</code> dengan harga eksekusi &amp; alasan.</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- 8. MLR -->
    <section id="mlr" class="scroll-mt-20 space-y-4">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2"><span class="text-emerald-400">8.</span> Regresi Linear Berganda (OLS)</h2>
      <p class="text-xs text-slate-400 leading-relaxed">Tujuan: menjelaskan &amp; (opsional) memprediksi return ke depan dari faktor-faktor saat masuk. Diimplementasi murni TypeScript (tanpa dependensi) via persamaan normal <code class="text-emerald-300">β = (XᵀX)⁻¹Xᵀy</code>, dengan invers matriks Gauss-Jordan.</p>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
          <div class="font-bold text-slate-100 text-sm">Variabel</div>
          <p class="text-xs text-slate-400 leading-relaxed"><span class="text-slate-200 font-semibold">y (dependen):</span> return ke depan horizon H per saham (realisasi).</p>
          <p class="text-xs text-slate-400 leading-relaxed"><span class="text-slate-200 font-semibold">X (independen):</span> skor teknikal, RS 3-bulan, momentum 1m/3m, volatilitas, PER, PBV, ROE, tren volume, dummy sektor.</p>
        </div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-2">
          <div class="font-bold text-slate-100 text-sm">Keluaran</div>
          <ul class="text-xs text-slate-400 leading-relaxed space-y-1 list-disc pl-4">
            <li>Koefisien β tiap faktor + arah pengaruh.</li>
            <li>Std error, t-stat, p-value (aprox), signifikansi.</li>
            <li>R² &amp; adjusted R² (seberapa banyak return terjelaskan).</li>
            <li>Prediksi return utk kandidat (asisten opsional).</li>
          </ul>
        </div>
      </div>
      <div class="rounded-xl bg-slate-950 border border-slate-800 p-4 overflow-x-auto">
        <pre v-pre class="text-[11px] leading-relaxed text-slate-300 font-mono whitespace-pre">
interface RegressionResult {
  n: number;                       // jumlah observasi (saham)
  r2: number; adjR2: number;
  terms: {
    name: string;                  // 'intercept' | 'score' | 'rs3m' | ...
    coef: number; stdErr: number;
    tStat: number; pValue: number; // signifikansi
  }[];
  predict: (x: number[]) =&gt; number;
}
        </pre>
      </div>
      <div class="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 text-xs text-amber-200/80 leading-relaxed">
        <span class="font-bold text-amber-300">Catatan statistik:</span> dengan hanya beberapa saham per sesi, model mudah overfit. Regresi paling bermakna dijalankan pada <span class="font-semibold">seluruh universe as-of</span> (puluhan–ratusan saham), bukan hanya keranjang kecil. Keranjang kecil dipakai untuk atribusi kontribusi, bukan inferensi kausal.
      </div>
    </section>

    <!-- 9. BELAJAR -->
    <section id="belajar" class="scroll-mt-20 space-y-4">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2"><span class="text-emerald-400">9.</span> Pembelajaran Meta (Simpan &amp; Rekomendasi)</h2>
      <p class="text-xs text-slate-400 leading-relaxed">Tiap sesi + keputusan + hasilnya disimpan. Mesin insight membaca <span class="text-slate-200">semua sesi</span> dan mengagregasi pola menjadi rekomendasi konkret “lakukan / hindari”.</p>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-4">
          <div class="font-bold text-emerald-300 text-sm mb-2">✅ Contoh “Lakukan”</div>
          <ul class="text-xs text-emerald-200/80 leading-relaxed space-y-1 list-disc pl-4">
            <li>Hold pemenang berating Kuat → rata-rata kontribusi positif.</li>
            <li>Potong rugi &gt; -8% pada rating Lemah → drawdown lebih kecil.</li>
            <li>Diversifikasi 4–6 saham lintas sektor → volatilitas turun.</li>
          </ul>
        </div>
        <div class="rounded-xl bg-rose-500/5 border border-rose-500/20 p-4">
          <div class="font-bold text-rose-300 text-sm mb-2">⛔ Contoh “Hindari”</div>
          <ul class="text-xs text-rose-200/80 leading-relaxed space-y-1 list-disc pl-4">
            <li>Average down pada saham berating Lemah/downtrend → memperbesar rugi.</li>
            <li>Konsentrasi 1–2 saham → drawdown ekstrem.</li>
            <li>Jual panik saat koreksi wajar pada tren naik yang utuh.</li>
          </ul>
        </div>
      </div>
      <p class="text-[11px] text-slate-500">Awalnya berbasis heuristik atas statistik keputusan; seiring data bertambah dapat ditingkatkan menjadi regresi keputusan→hasil untuk kuantifikasi.</p>
    </section>

    <!-- 10. CAVEAT -->
    <section id="caveat" class="scroll-mt-20 space-y-4">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2"><span class="text-emerald-400">10.</span> Isu Metodologis (wajib jujur)</h2>
      <div class="grid sm:grid-cols-2 gap-3">
        <div v-for="(c, i) in [
          { t: 'Lookahead bias', d: 'Diatasi dengan memotong bar ≤ T. Fundamental point-in-time tak tersedia → dinonaktifkan/ditandai di mode historis.' },
          { t: 'Survivorship bias', d: 'Saham delisting hilang dari universe kini. Idealnya pakai daftar konstituen historis; tahap awal diberi disclaimer.' },
          { t: 'Corporate action', d: 'Stock split/dividen. Pakai harga adjusted konsisten agar return tak bias.' },
          { t: 'Biaya transaksi', d: 'Fee beli/jual & slippage. Sediakan parameter biaya agar hasil realistis.' },
          { t: 'Overfitting regresi', d: 'Sampel kecil → banyak faktor menyesatkan. Batasi jumlah faktor, laporkan adj-R² & p-value.' },
          { t: 'Likuiditas', d: 'Saham tipis sulit dieksekusi pada harga close. Beri flag likuiditas pada screening as-of.' }
        ]" :key="i" class="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="font-bold text-slate-100 text-sm mb-1">⚠️ {{ c.t }}</div>
          <p class="text-xs text-slate-400 leading-relaxed">{{ c.d }}</p>
        </div>
      </div>
    </section>

    <!-- 11. ROADMAP -->
    <section id="roadmap" class="scroll-mt-20 space-y-4">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2"><span class="text-emerald-400">11.</span> Roadmap Implementasi</h2>
      <div class="space-y-3">
        <div v-for="(f, i) in [
          { p: 'Fase 0', t: 'Arsitektur (dokumen ini)', s: 'selesai', d: 'Cetak biru, model data, kontrak API, isu metodologis.' },
          { p: 'Fase 1', t: 'As-Of Engine + Screening historis', s: 'selesai', d: 'asof.ts + /api/sim/screen + UI pilih tanggal & tabel screening as-of.' },
          { p: 'Fase 2', t: 'Racik keranjang + Playback + Keputusan', s: 'selesai', d: 'Pilih saham/bobot, animasi harga, prompt HOLD/JUAL/AVG-DOWN, kurva ekuitas.' },
          { p: 'Fase 3', t: 'Regresi Linear Berganda', s: 'selesai', d: 'regression.ts (OLS murni TS) + setelmen + panel koefisien/R².' },
          { p: 'Fase 4', t: 'Persistence + Insights meta', s: 'selesai', d: 'simStore.ts + /api/sim/insights + rekomendasi lakukan/hindari.' }
        ]" :key="i" class="flex items-center gap-4 rounded-xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="shrink-0 font-mono text-xs font-bold text-slate-400 w-16">{{ f.p }}</div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-slate-100 text-sm">{{ f.t }}</div>
            <p class="text-xs text-slate-400 mt-0.5">{{ f.d }}</p>
          </div>
          <span class="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
            :class="f.s === 'selesai' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              : f.s === 'berikutnya' ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
              : 'bg-slate-800 text-slate-400 border border-slate-700'">{{ f.s }}</span>
        </div>
      </div>
    </section>

    <!-- 12. FILES -->
    <section id="files" class="scroll-mt-20 space-y-4">
      <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2"><span class="text-emerald-400">12.</span> Berkas yang Akan Dibuat</h2>
      <div class="rounded-xl bg-slate-950 border border-slate-800 p-4 overflow-x-auto">
        <pre v-pre class="text-[11px] leading-relaxed text-slate-300 font-mono whitespace-pre">
server/utils/asof.ts          # screening point-in-time (potong bar ≤ T)
server/utils/regression.ts    # OLS murni TS: (XᵀX)⁻¹Xᵀy, R², t-stat, invers Gauss-Jordan
server/utils/simStore.ts      # simpan/baca sesi simulasi (.data-store/simulations/)
server/utils/simInsights.ts   # agregasi lintas sesi → rekomendasi lakukan/hindari
server/api/sim/screen.ts      # GET screening as-of
server/api/sim/prices.ts      # GET deret harga utk playback
server/api/sim/session.*.ts   # POST/GET sesi + settle
server/api/sim/regression.ts  # POST OLS ad-hoc
server/api/sim/insights.ts    # GET insight meta
app/pages/simulasi/index.vue  # wizard fungsional penuh (setup→screening→racik→playback→hasil)
app/pages/simulasi/panduan.vue # dokumen panduan ini
        </pre>
      </div>
      <div class="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-5 text-center">
        <p class="text-sm text-slate-200 font-semibold">Semua fase sudah terimplementasi &amp; live. Dokumen ini menjadi panduan cara kerja simulasi.</p>
        <NuxtLink to="/simulasi" class="inline-block mt-3 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors">▶ Mulai Simulasi</NuxtLink>
      </div>
    </section>
  </div>
</template>
