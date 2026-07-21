<script setup lang="ts">
import { ref } from 'vue';

useHead({
  title: 'Pengembangan & Arsitektur Institusional - Saham IDX',
  meta: [
    {
      name: 'description',
      content: 'Dokumentasi arsitektur sistem, cetak biru analisis Wakil Manajer Investasi (WMI) Reksa Dana Saham, panduan deployment server, dan roadmap pengembangan.'
    }
  ]
});

const activeTab = ref<'wmi' | 'architecture' | 'deploy' | 'roadmap'>('wmi');
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
    <!-- Header Banner -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 border border-slate-800 shadow-xl">
      <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            PORTAL PENGEMBANGAN & ARSITEKTUR
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-50 tracking-tight">
            Arsitektur Sistem & Cetak Biru Institusional (WMI)
          </h1>
          <p class="text-sm text-slate-400 mt-2 max-w-3xl">
            Dokumentasi lengkap arsitektur aplikasi <span class="text-slate-200 font-medium">analisis_saham</span>, panduan deployment infrastruktur server produksi, serta rancangan pengolahan reksa dana saham institusional.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <a
            href="https://github.com/paber26/analisis_saham"
            target="_blank"
            class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-2"
          >
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub Repository
          </a>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
      <button
        @click="activeTab = 'wmi'"
        class="px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
        :class="[
          activeTab === 'wmi'
            ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
        ]"
      >
        <span>🏛️</span> Cetak Biru Institusional (WMI)
      </button>

      <button
        @click="activeTab = 'architecture'"
        class="px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
        :class="[
          activeTab === 'architecture'
            ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
        ]"
      >
        <span>⚙️</span> Arsitektur Sistem (ARCHITECTURE.md)
      </button>

      <button
        @click="activeTab = 'deploy'"
        class="px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
        :class="[
          activeTab === 'deploy'
            ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
        ]"
      >
        <span>🚀</span> Panduan Deploy & Server (DEPLOY.md)
      </button>

      <button
        @click="activeTab = 'roadmap'"
        class="px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
        :class="[
          activeTab === 'roadmap'
            ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
        ]"
      >
        <span>🗺️</span> Roadmap Fitur (ROADMAP.md)
      </button>
    </div>

    <!-- TAB 1: WMI INSTITUTIONAL BLUEPRINT -->
    <div v-if="activeTab === 'wmi'" class="space-y-8">
      <!-- 3 Pillars Card Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 relative overflow-hidden">
          <div class="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold mb-4 text-lg">
            🛡️
          </div>
          <h3 class="text-base font-bold text-slate-100 mb-2">1. AUM Preservation (Risk Control)</h3>
          <p class="text-xs text-slate-400 leading-relaxed">
            Mencegah kerugian tajam saat pasar bearish (*downside risk protection*), mengendalikan korelasi portofolio, mematuhi batas *single issuer cap (10%)*, dan menjamin likuiditas dana untuk menghadapi *redemption*.
          </p>
        </div>

        <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 relative overflow-hidden">
          <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold mb-4 text-lg">
            ⚡
          </div>
          <h3 class="text-base font-bold text-slate-100 mb-2">2. Alpha Generation (Outperformance)</h3>
          <p class="text-xs text-slate-400 leading-relaxed">
            Mengalahkan indeks acuan (IHSG / LQ45 / IDX80) secara konsisten dengan strategi **Smart Beta Multi-Factor Rating** (Value, Quality, Momentum, Low Volatility).
          </p>
        </div>

        <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 relative overflow-hidden">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold mb-4 text-lg">
            📈
          </div>
          <h3 class="text-base font-bold text-slate-100 mb-2">3. AUM Growth & Investor Trust</h3>
          <p class="text-xs text-slate-400 leading-relaxed">
            Menghasilkan konsistensi *Risk-Adjusted Return* (Sharpe Ratio, Sortino Ratio, Information Ratio) tinggi untuk menarik kepercayaan investor & inflow dana kelolaan baru.
          </p>
        </div>
      </div>

      <!-- 5-Layer Institutional Architecture Diagram -->
      <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span>📐</span> Arsitektur Analitis 5 Layer Institusional
          </h2>
          <span class="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full font-mono">Institutional Grade</span>
        </div>

        <div class="bg-slate-950 p-5 rounded-xl border border-slate-800/80 font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed">
<pre>
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. LAYER ENTERPRISE DASHBOARD & DECISION SUPPORT (UI/UX)                   │
│   • Multi-Portfolio Dashboard (Core Equity Fund, Dividend Yield Fund)       │
│   • Risk & Drawdown Monitor  • Factor Exposure Matrix  • Rebalancing Suite  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST / SSR (Nuxt 4)
┌──────────────────────────────────────┴──────────────────────────────────────┐
│ 2. LAYER ENGINE ANALITIK WMI (Nitro Server Engine)                          │
│                                                                             │
│  [A. Institutional Screener]     [B. Portfolio Construction]               │
│  • Filter ADV (> Rp 5M/hari)     • Max 10% Single Issuer Cap (OJK Rule)     │
│  • Multi-Factor Rating (QVM)     • Limit Sektor (Max 25-30%)               │
│                                  • Equal Risk Contribution / Risk Parity    │
│                                                                             │
│  [C. Risk & Stress Test Engine]  [D. Performance Attribution]              │
│  • Value at Risk (VaR 95%)       • Brinson Sector Attribution (Alloc/Select)│
│  • Correlation Matrix Heatmap    • Sharpe, Sortino, Information Ratio       │
│  • Days-to-Liquid (Likuiditas)   • Tracking Error vs IHSG / LQ45            │
│                                                                             │
│  [E. Market Breadth & TAA]       [F. Rebalancing Guardrail]                 │
│  • Market Regime (Risk-On/Off)   • Target vs Current Allocation Drift       │
│  • Cash Allocation Adjuster      • Rebalance Trigger Signal                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Async Pipeline / Cron Sync
┌──────────────────────────────────────┴──────────────────────────────────────┐
│ 3. LAYER DATA MANAGEMENT & TIME-SERIES STORE                                │
│  • Data Store Harian (.data-store/ / SQLite)                                │
│  • Benchmark Index Store (^JKSE, ^LQ45, IDX80)                             │
│  • Corporate Actions & Fundamentals Registry (PER, PBV, ROE, DER, FreeFloat)│
└──────────────────────────────────────┬──────────────────────────────────────┘
</pre>
        </div>
      </div>

      <!-- Core WMI Analytics Modules Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-3">
          <h3 class="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <span>🎯</span> 1. Institutional Screener (Filter Liquid & Factor)
          </h3>
          <ul class="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
            <li><strong class="text-slate-100">ADV Limit</strong>: Rata-rata transaksi harian (ADV) &gt; Rp 5 Milyar/hari untuk mencegah <i>liquidity trap</i>.</li>
            <li><strong class="text-slate-100">Free Float</strong>: Minimal 15-20% saham beredar publik.</li>
            <li><strong class="text-slate-100">Quality Score</strong>: ROE &gt; 12%, DER &lt; 1.2x, positive Free Cash Flow.</li>
            <li><strong class="text-slate-100">Value & Momentum</strong>: PE/PBV vs historis &amp; Trend RS vs IHSG.</li>
          </ul>
        </div>

        <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-3">
          <h3 class="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <span>⚖️</span> 2. Portfolio Guardrails (Kepatuhan Mandat OJK)
          </h3>
          <ul class="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
            <li><strong class="text-slate-100">Single Issuer Cap</strong>: Maksimal 10% NAV pada 1 emiten (regulasi OJK).</li>
            <li><strong class="text-slate-100">Sektor Limit</strong>: Maksimal 25-30% NAV per sektor.</li>
            <li><strong class="text-slate-100">Cash Buffer</strong>: Porsi kas 0–20% yang disesuaikan secara dinamis (*Tactical Asset Allocation*).</li>
            <li><strong class="text-slate-100">Rebalance Drift</strong>: Sinyal otomatis jika porsi saham terdistorsi &gt; 2%.</li>
          </ul>
        </div>

        <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-3">
          <h3 class="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <span>📊</span> 3. Performance Attribution (Brinson Model)
          </h3>
          <ul class="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
            <li><strong class="text-slate-100">Allocation Effect</strong>: Keunggulan WMI karena alokasi bobot sektor.</li>
            <li><strong class="text-slate-100">Selection Effect</strong>: Keunggulan WMI karena pemilihan saham di dalam sektor.</li>
            <li><strong class="text-slate-100">Rasio Risiko</strong>: Sharpe Ratio, Sortino Ratio, Information Ratio.</li>
            <li><strong class="text-slate-100">Tracking Error</strong>: Mengukur konsistensi penyimpangan vs IHSG/LQ45.</li>
          </ul>
        </div>

        <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-3">
          <h3 class="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <span>🚨</span> 4. Risk Management & Stress Testing
          </h3>
          <ul class="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
            <li><strong class="text-slate-100">Value at Risk (VaR 95%)</strong>: Estimasi kerugian maksimum portofolio.</li>
            <li><strong class="text-slate-100">Correlation Heatmap</strong>: Deteksi korelasi tinggi (&gt; 0.75) antar holding.</li>
            <li><strong class="text-slate-100">Days-to-Liquid</strong>: Simulasi hari eksekusi jika mengambil max 10% transaksi harian pasar.</li>
            <li><strong class="text-slate-100">Drawdown Monitor</strong>: Pelacakan masa pemulihan *peak-to-trough*.</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- TAB 2: SYSTEM ARCHITECTURE (ARCHITECTURE.md) -->
    <div v-if="activeTab === 'architecture'" class="space-y-6">
      <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-4">
        <h2 class="text-xl font-bold text-slate-100 border-b border-slate-800 pb-3 flex items-center justify-between">
          <span>⚙️ Arsitektur Aplikasi (ARCHITECTURE.md)</span>
          <span class="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">Nuxt 4 SSR</span>
        </h2>

        <div class="prose prose-invert max-w-none text-xs text-slate-300 space-y-4 leading-relaxed">
          <p class="text-sm text-slate-200 font-semibold">
            Aplikasi analisis saham berbasis <strong>Nuxt 4 SSR</strong> dengan komputasi analitik di server Nitro, data harga dari Yahoo Finance, dan caching harian berbasis tanggal WIB.
          </p>

          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-teal-300 overflow-x-auto">
<pre>
┌─────────────────────────── Browser ────────────────────────────────┐
│  /screening (home)   /analisa/[symbol]   /forecast    /seasonal    │
│  /saham (chart)      /profil-saham       /pengembangan             │
└───────────────────────────────┬────────────────────────────────────┘
                                │ useFetch (SSR + client)
┌────────────────────────── Nitro API ───────────────────────────────┐
│ /api/screen        skor teknikal semua universe (~330+)            │
│ /api/analysis      teknikal + level S/R + rencana ATR              │
│ /api/forecast      backtest walk-forward + proyeksi (AR/Ridge/EWMA)│
│ /api/seasonal      return bulanan 10y                              │
│ /api/detail        OHLCV harian 1y + meta                          │
│ /api/fundamentals  PER/PBV/ROE/DY live                             │
│ /api/profile       profil emiten                                   │
│ /api/search        autocomplete seluruh emiten .JK                 │
│ /api/sync          snapshot store harian                           │
└────────────────────────────────────────────────────────────────────┘
</pre>
          </div>

          <h3 class="text-sm font-bold text-emerald-400 mt-4">Forecasting Model Engine (v2)</h3>
          <ul class="list-disc list-inside space-y-1">
            <li><strong>Naive Baseline</strong>: r̂ = 0 (baseline wajib).</li>
            <li><strong>AR(p) Autoregresi</strong>: Orde p∈1..5 dipilih otomatis via AIC pada log-return.</li>
            <li><strong>Ridge Regression</strong>: Memanfaatkan momentum, RSI, MACD-hist, dan jarak MA.</li>
            <li><strong>Ensemble</strong>: Rata-rata berbobot 1/RMSE² dari model yang mengalahkan naive pada window validasi 60 hari.</li>
            <li><strong>EWMA Volatilitas (λ=0.94)</strong>: Estimasi pita probabilitas proyeksi ~80%.</li>
          </ul>

          <h3 class="text-sm font-bold text-emerald-400 mt-4">Data Store Pipeline Harian</h3>
          <p>
            Endpoint <code>/api/sync</code> dijalankan otomatis oleh <strong>cron harian sore WIB</strong> untuk membangun snapshot <code>.data-store/screen-latest.json</code>. Screener dapat menampilkan ratusan emiten secara instan tanpa re-computation.
          </p>
        </div>
      </div>
    </div>

    <!-- TAB 3: DEPLOYMENT GUIDE (DEPLOY.md) -->
    <div v-if="activeTab === 'deploy'" class="space-y-6">
      <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-4">
        <h2 class="text-xl font-bold text-slate-100 border-b border-slate-800 pb-3 flex items-center justify-between">
          <span>🚀 Panduan Deployment Server (DEPLOY.md)</span>
          <span class="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">saham.kuydinas.id</span>
        </h2>

        <div class="prose prose-invert max-w-none text-xs text-slate-300 space-y-4 leading-relaxed">
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto">
<pre>
Cloudflare (SSL Edge, HTTPS :443)
    │
    ▼
Nginx Reverse Proxy (Origin Server) ──► Node / Nitro :3200 (PM2 app: "saham")
  vhost: /www/server/panel/vhost/nginx/saham.kuydinas.id.conf
  root : /www/wwwroot/saham.kuydinas.id/.output
</pre>
          </div>

          <h3 class="text-sm font-bold text-emerald-400">Prosedur Routine Update Deployment</h3>
          <div class="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-slate-200">
            ./deploy.sh
          </div>
          <p>
            Script <code>deploy.sh</code> mengeksekusi 3 tahap otomatis:
          </p>
          <ol class="list-decimal list-inside space-y-1">
            <li>Menjalankan <code>npm run build</code> secara lokal.</li>
            <li>Mengunggah folder <code>.output</code> ke server via <code>rsync</code>.</li>
            <li>Membersihkan cache harian (<code>.cache</code>) dan merestart PM2 process <code>saham</code> di port 3200.</li>
          </ol>

          <h3 class="text-sm font-bold text-emerald-400 mt-4">Perintah Monitoring &amp; Troubleshooting Server</h3>
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
            <p><span class="text-emerald-400">pm2 list</span> - Cek status aplikasi</p>
            <p><span class="text-emerald-400">pm2 logs saham</span> - Cek log real-time server</p>
            <p><span class="text-emerald-400">pm2 restart saham</span> - Restart manual aplikasi PM2</p>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 4: ROADMAP ARCHITECTURE (ROADMAP.md) -->
    <div v-if="activeTab === 'roadmap'" class="space-y-6">
      <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-4">
        <h2 class="text-xl font-bold text-slate-100 border-b border-slate-800 pb-3 flex items-center justify-between">
          <span>🗺️ Roadmap Arsitektur Lanjutan (ROADMAP.md)</span>
          <span class="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">Tier 1 – Tier 4</span>
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="text-emerald-400 font-bold text-xs">TIER 1 — Market Context &amp; Deep Fundamentals</div>
            <p class="text-slate-300 text-xs">Market Breadth (% saham &gt; MA200), Rotasi Sektor, Relative Strength vs IHSG, dan Fundamental Rasio Pertumbuhan/DER/Margin.</p>
          </div>

          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="text-emerald-400 font-bold text-xs">TIER 2 — Watchlist &amp; Portfolio Management</div>
            <p class="text-slate-300 text-xs">Penyimpanan posisi portofolio, perhitungan P&amp;L, Matriks Korelasi (Heatmap), dan Analisis Risiko Portofolio (Volatilitas, VaR, Beta).</p>
          </div>

          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="text-emerald-400 font-bold text-xs">TIER 3 — Backtesting Engine &amp; Strategy Audit</div>
            <p class="text-slate-300 text-xs">Engine simulasi tanpa look-ahead bias untuk menguji efektivitas Screener, Score, dan Musiman dibanding Indeks Acuan (IHSG).</p>
          </div>

          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="text-emerald-400 font-bold text-xs">TIER 4 — Automated Alert &amp; Notifications</div>
            <p class="text-slate-300 text-xs">Integrasi Telegram Bot yang terhubung dengan Cron Harian untuk mengirimkan notifikasi saat sinyal/setup muncul.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
