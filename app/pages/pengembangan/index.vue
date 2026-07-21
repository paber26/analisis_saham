<script setup lang="ts">
import { ref } from 'vue';

useHead({
  title: 'Rencana Pengembangan & Akademi WMI - Saham IDX',
  meta: [
    {
      name: 'description',
      content: 'Rencana pengembangan profesional, cetak biru arsitektur analisis institusional Wakil Manajer Investasi (WMI) Reksa Dana Saham, dan modul pembelajaran edukasi pasar modal.'
    }
  ]
});

const activeTab = ref<'academy' | 'wmi' | 'architecture' | 'deploy' | 'roadmap'>('academy');
const activeModule = ref<number>(1);
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
            PORTAL ARSITEKTUR & AKADEMI INVESTASI WMI
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-50 tracking-tight">
            Rencana Pengembangan & Akademi Analisis Institusional
          </h1>
          <p class="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
            Rancangan platform analisis saham standar institusional (Wakil Manajer Investasi / Fund Manager Reksa Dana Saham) dilengkapi dengan <span class="text-emerald-400 font-semibold">Modul Edukasi Analisis Profesional</span> untuk memperdalam ilmu pasar modal.
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
        @click="activeTab = 'academy'"
        class="px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
        :class="[
          activeTab === 'academy'
            ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
        ]"
      >
        <span>🎓</span> Materi Edukasi &amp; Akademi WMI
      </button>

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
        <span>🚀</span> Panduan Deploy &amp; Server (DEPLOY.md)
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

    <!-- TAB 1: ACADEMY / MATERI EDUKASI WMI -->
    <div v-if="activeTab === 'academy'" class="space-y-8">
      <!-- Intro Section -->
      <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 class="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span>🎓</span> Modul Kurikulum Edukasi Manajer Investasi (WMI)
          </h2>
          <span class="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-semibold">
            Institutional Fund Management Series
          </span>
        </div>
        <p class="text-xs text-slate-300 leading-relaxed">
          Materi ini dirancang secara sistematis berdasarkan metodologi analisis yang digunakan oleh <strong>Buy-Side Equity Analysts, Portfolio Managers, dan Manajer Investasi Institusional</strong> untuk memilih saham, mengukur efisiensi portofolio, membatasi risiko kerugian, dan mencetak <i>Alpha</i> secara konsisten.
        </p>

        <!-- Module Picker Sub-tabs -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
          <button
            @click="activeModule = 1"
            class="p-3 rounded-xl text-left border transition-all text-xs font-semibold"
            :class="[activeModule === 1 ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200']"
          >
            <div class="text-[10px] text-slate-400">Modul 1</div>
            <div>Top-Down &amp; Bottom-Up</div>
          </button>

          <button
            @click="activeModule = 2"
            class="p-3 rounded-xl text-left border transition-all text-xs font-semibold"
            :class="[activeModule === 2 ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200']"
          >
            <div class="text-[10px] text-slate-400">Modul 2</div>
            <div>DuPont &amp; Valuasi DCF</div>
          </button>

          <button
            @click="activeModule = 3"
            class="p-3 rounded-xl text-left border transition-all text-xs font-semibold"
            :class="[activeModule === 3 ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200']"
          >
            <div class="text-[10px] text-slate-400">Modul 3</div>
            <div>Quantitative Factor (Smart Beta)</div>
          </button>

          <button
            @click="activeModule = 4"
            class="p-3 rounded-xl text-left border transition-all text-xs font-semibold"
            :class="[activeModule === 4 ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200']"
          >
            <div class="text-[10px] text-slate-400">Modul 4</div>
            <div>Risk Analytics (VaR &amp; Brinson)</div>
          </button>

          <button
            @click="activeModule = 5"
            class="p-3 rounded-xl text-left border transition-all text-xs font-semibold"
            :class="[activeModule === 5 ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200']"
          >
            <div class="text-[10px] text-slate-400">Modul 5</div>
            <div>Guardrails &amp; Likuiditas</div>
          </button>
        </div>
      </div>

      <!-- MODULE 1 CONTENT -->
      <div v-if="activeModule === 1" class="space-y-6">
        <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 class="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <span>🌐</span> Modul 1: Kerangka Kerja Investasi Top-Down &amp; Bottom-Up
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300 leading-relaxed">
            <div class="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
              <h4 class="font-bold text-slate-100 text-sm flex items-center gap-2">
                <span>🏛️</span> 1. Top-Down Macro &amp; Sector Allocation
              </h4>
              <p>
                Analisis dimulai dari kondisi makroekonomi global &amp; domestik (Suku Bunga BI/Fed, Inflasi, Pertumbuhan PDB, Nilai Tukar Rupiah), lalu menentukan alokasi sektor sesuai siklus ekonomi:
              </p>
              <ul class="list-disc list-inside space-y-1 text-slate-400">
                <li><strong class="text-slate-200">Ekspansi / Early-Cycle</strong>: Sektor Keuangan (Perbankan), Properti, Otomotif.</li>
                <li><strong class="text-slate-200">Peak / Commodity Boom</strong>: Sektor Pertambangan, Energi, Industri Dasar.</li>
                <li><strong class="text-slate-200">Resesi / Late-Cycle</strong>: Sektor Barang Konsumen Primer (Consumer Staples), Telekomunikasi, Kesehatan.</li>
              </ul>
            </div>

            <div class="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
              <h4 class="font-bold text-slate-100 text-sm flex items-center gap-2">
                <span>🔍</span> 2. Bottom-Up Stock Selection &amp; Economic Moat
              </h4>
              <p>
                Menganalisis emiten secara individual untuk menemukan perusahaan berkuantitas tinggi (*high quality*) yang memiliki parit ekonomi (*Economic Moat*):
              </p>
              <ul class="list-disc list-inside space-y-1 text-slate-400">
                <li><strong class="text-slate-200">Cost Advantage</strong>: Efisiensi biaya produksi terendah dibanding pesaing.</li>
                <li><strong class="text-slate-200">Switching Cost</strong>: Biaya tinggi bagi konsumen jika berpindah ke produk lain.</li>
                <li><strong class="text-slate-200">Network Effect</strong>: Nilai produk meningkat seiring bertambahnya pengguna.</li>
                <li><strong class="text-slate-200">ROIC vs WACC</strong>: Return on Invested Capital konsisten di atas Weighted Average Cost of Capital.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- MODULE 2 CONTENT -->
      <div v-if="activeModule === 2" class="space-y-6">
        <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 class="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <span>🧮</span> Modul 2: Analisis Laporan Keuangan DuPont &amp; Valuation Engine
          </h3>

          <div class="space-y-4 text-xs text-slate-300 leading-relaxed">
            <!-- DuPont Analysis Explanation -->
            <div class="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
              <h4 class="font-bold text-slate-100 text-sm flex items-center gap-2">
                <span>📈</span> DuPont 3-Step Analysis (Membedah Sumber ROE)
              </h4>
              <p>
                Seorang WMI tidak hanya melihat ROE yang tinggi, tetapi membedah apakah ROE tinggi tersebut berasal dari efisiensi profit margin, efisiensi aset, atau risiko utang yang berbahaya:
              </p>
              <div class="bg-slate-900 p-4 rounded-xl border border-slate-800 font-mono text-emerald-400 text-center text-xs">
                ROE = (Net Profit Margin) × (Asset Turnover) × (Financial Leverage)
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-slate-300">
                <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div class="font-bold text-slate-200">1. Net Profit Margin</div>
                  <div class="text-[11px] text-slate-400">Laba Bersih / Penjualan. Menandakan daya saing harga &amp; efisiensi operasional.</div>
                </div>
                <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div class="font-bold text-slate-200">2. Asset Turnover</div>
                  <div class="text-[11px] text-slate-400">Penjualan / Total Aset. Menandakan seberapa produktif aset perusahaan menghasilkan pendapatan.</div>
                </div>
                <div class="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  <div class="font-bold text-slate-200">3. Financial Leverage</div>
                  <div class="text-[11px] text-slate-400">Total Aset / Ekuitas. Jika rasio ini terlalu tinggi (&gt; 3x), ROE semu karena utang yang berisiko.</div>
                </div>
              </div>
            </div>

            <!-- Free Cash Flow & Valuation -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <h4 class="font-bold text-slate-100 text-sm">Quality of Earnings &amp; Free Cash Flow</h4>
                <p>
                  Laba bersih pada laporan laba rugi bisa direkayasa dengan pencatatan akrual. Institusi menggunakan **Free Cash Flow (FCF)**:
                </p>
                <div class="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-emerald-400 text-xs">
                  FCF = Arus Kas Operasi - CapEx
                </div>
                <p class="text-slate-400">
                  Emiten sehat wajib memiliki <i>Cash Conversion Ratio</i> (FCF / Laba Bersih) &gt; 0.8.
                </p>
              </div>

              <div class="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <h4 class="font-bold text-slate-100 text-sm">Historical Valuation Bands (PE/PBV Standard Deviation)</h4>
                <p>
                  Menilai harga saham bukan dari murah nominal, melainkan posisi valuasi relatif terhadap rata-rata historis 5-tahun:
                </p>
                <ul class="list-disc list-inside text-slate-400 space-y-1">
                  <li><strong class="text-emerald-400">Undervalued Zone</strong>: Valuasi di bawah -1σ hingga -2σ standar deviasi.</li>
                  <li><strong class="text-amber-400">Fair Value Zone</strong>: Valuasi di sekitar Mean (rata-rata 5-tahun).</li>
                  <li><strong class="text-rose-400">Overvalued Zone</strong>: Valuasi melampaui +1σ hingga +2σ standar deviasi.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- MODULE 3 CONTENT -->
      <div v-if="activeModule === 3" class="space-y-6">
        <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 class="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <span>⚡</span> Modul 3: Quantitative Factor Investing (Smart Beta Rating)
          </h3>

          <p class="text-xs text-slate-300 leading-relaxed">
            <i>Factor Investing</i> adalah pendekatan kuantitatif yang mengelompokkan saham berdasarkan karakteristik risiko-hasil yang telah terbukti secara akademis dan historis mengalahkan pasar (Fama-French Multi-Factor Model).
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div class="font-bold text-slate-100 text-sm flex items-center gap-2">
                <span class="text-emerald-400">1. Quality Factor</span>
              </div>
              <p class="text-slate-400">Menyaring emiten dengan neraca kuat, profitabilitas tinggi, dan volatilitas laba rendah. Metrik: ROE &gt; 15%, Debt to Equity &lt; 1.0, Gross Margin tinggi.</p>
            </div>

            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div class="font-bold text-slate-100 text-sm flex items-center gap-2">
                <span class="text-emerald-400">2. Value Factor</span>
              </div>
              <p class="text-slate-400">Menyaring emiten yang harganya terdiskon dibanding nilai fundamentalnya. Metrik: High Earnings Yield (1/PE), High Book-to-Market (1/PBV), EV/EBITDA rendah.</p>
            </div>

            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div class="font-bold text-slate-100 text-sm flex items-center gap-2">
                <span class="text-emerald-400">3. Momentum Factor</span>
              </div>
              <p class="text-slate-400">Saham yang sedang dalam tren kenaikan kuat cenderung melanjutkan trennya dalam jangka menengah. Metrik: Return 6M/12M dikurangi return bulan terakhir.</p>
            </div>

            <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div class="font-bold text-slate-100 text-sm flex items-center gap-2">
                <span class="text-emerald-400">4. Low Volatility Factor</span>
              </div>
              <p class="text-slate-400">Anomali pasar di mana saham ber-volatilitas terendah menghasilkan *risk-adjusted return* lebih tinggi dalam jangka panjang dibanding saham sangat fluktuatif.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- MODULE 4 CONTENT -->
      <div v-if="activeModule === 4" class="space-y-6">
        <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 class="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <span>📊</span> Modul 4: Portofolio Analytics, VaR &amp; Brinson Attribution
          </h3>

          <div class="space-y-4 text-xs text-slate-300 leading-relaxed">
            <!-- VaR & CVaR -->
            <div class="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
              <h4 class="font-bold text-slate-100 text-sm">1. Value at Risk (VaR 95%) &amp; Expected Shortfall (CVaR)</h4>
              <p>
                Menghitung batas potensi kerugian maksimum portofolio harian pada tingkat kepercayaan 95%. Jika pasar mengalami kepanikan ekstrem di luar batas VaR, **Expected Shortfall (CVaR)** mengukur rata-rata kerugian di area *tail risk*.
              </p>
              <div class="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-emerald-400 text-xs">
                VaR (95%) = Portofolio Value × (Mean Return - 1.645 × Portfolio Volatility)
              </div>
            </div>

            <!-- Brinson Attribution -->
            <div class="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
              <h4 class="font-bold text-slate-100 text-sm">2. Brinson-Fachler Performance Attribution Model</h4>
              <p>
                Model standar internasional untuk membedah sumber keunggulan return WMI dibanding Indeks Acuan (IHSG / LQ45):
              </p>
              <ul class="list-disc list-inside text-slate-400 space-y-1">
                <li><strong class="text-slate-200">Allocation Effect</strong>: Keuntungan yang didapat dari keputusan memperbesar (*overweight*) porsi sektor yang berkinerja unggul.</li>
                <li><strong class="text-slate-200">Selection Effect</strong>: Keuntungan yang didapat dari kejelian memilih saham terbaik di dalam sektor tersebut.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- MODULE 5 CONTENT -->
      <div v-if="activeModule === 5" class="space-y-6">
        <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-4">
          <h3 class="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <span>⚖️</span> Modul 5: Risk Guardrails &amp; Likuiditas Institusional
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300 leading-relaxed">
            <div class="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
              <h4 class="font-bold text-slate-100 text-sm">OJK Mandate Rules (Batasan Regulasi)</h4>
              <ul class="list-disc list-inside text-slate-400 space-y-2">
                <li><strong class="text-slate-200">Single Issuer Cap</strong>: Porsi kepemilikan 1 emiten tidak boleh melebihi 10% dari total nilai portofolio (NAV).</li>
                <li><strong class="text-slate-200">Minimal Porsi Saham</strong>: Reksa Dana Saham wajib mengalokasikan minimal 80% NAV pada efek bersifat ekuitas.</li>
                <li><strong class="text-slate-200">Batas Sektor</strong>: Maksimal 25-30% NAV dialokasikan pada 1 sektor usaha.</li>
              </ul>
            </div>

            <div class="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
              <h4 class="font-bold text-slate-100 text-sm">Days-to-Liquid (Stress Test Likuiditas)</h4>
              <p>
                Rasio untuk mengukur berapa hari yang dibutuhkan WMI untuk mencairkan seluruh posisi 1 saham tanpa merusak harga pasar:
              </p>
              <div class="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-emerald-400 text-xs">
                Days to Liquid = Posisi Portofolio / (10% × ADV 30-Hari)
              </div>
              <p class="text-slate-400">
                Jika Days to Liquid &gt; 5 hari, saham tersebut berisiko tinggi saat terjadi <i>redemption</i> masif.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: WMI INSTITUTIONAL BLUEPRINT -->
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
          <h3 class="text-base font-bold text-slate-100 mb-2">3. AUM Growth &amp; Investor Trust</h3>
          <p class="text-xs text-slate-400 leading-relaxed">
            Menghasilkan konsistensi *Risk-Adjusted Return* (Sharpe Ratio, Sortino Ratio, Information Ratio) tinggi untuk menarik kepercayaan investor &amp; inflow dana kelolaan baru.
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
    </div>

    <!-- TAB 3: SYSTEM ARCHITECTURE (ARCHITECTURE.md) -->
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
        </div>
      </div>
    </div>

    <!-- TAB 4: DEPLOYMENT GUIDE (DEPLOY.md) -->
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
        </div>
      </div>
    </div>

    <!-- TAB 5: ROADMAP ARCHITECTURE (ROADMAP.md) -->
    <div v-if="activeTab === 'roadmap'" class="space-y-6">
      <div class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-4">
        <h2 class="text-xl font-bold text-slate-100 border-b border-slate-800 pb-3 flex items-center justify-between">
          <span>🗺️ Roadmap Arsitektur Lanjutan (ROADMAP.md)</span>
          <span class="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">Tier 1 – Tier 4</span>
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="text-emerald-400 font-bold">TIER 1 — Market Context &amp; Deep Fundamentals</div>
            <p class="text-slate-300">Market Breadth (% saham &gt; MA200), Rotasi Sektor, Relative Strength vs IHSG, dan Fundamental Rasio Pertumbuhan/DER/Margin.</p>
          </div>

          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="text-emerald-400 font-bold">TIER 2 — Watchlist &amp; Portfolio Management</div>
            <p class="text-slate-300">Penyimpanan posisi portofolio, perhitungan P&amp;L, Matriks Korelasi (Heatmap), dan Analisis Risiko Portofolio (Volatilitas, VaR, Beta).</p>
          </div>

          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="text-emerald-400 font-bold">TIER 3 — Backtesting Engine &amp; Strategy Audit</div>
            <p class="text-slate-300">Engine simulasi tanpa look-ahead bias untuk menguji efektivitas Screener, Score, dan Musiman dibanding Indeks Acuan (IHSG).</p>
          </div>

          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div class="text-emerald-400 font-bold">TIER 4 — Automated Alert &amp; Notifications</div>
            <p class="text-slate-300">Integrasi Telegram Bot yang terhubung dengan Cron Harian untuk mengirimkan notifikasi saat sinyal/setup muncul.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
