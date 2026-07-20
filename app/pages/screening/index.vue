<script setup lang="ts">
import { ref, computed } from 'vue';

useHead({
  title: 'Screening Teknikal Saham IDX — Skor Layak Beli',
  meta: [
    { name: 'description', content: 'Screening saham IDX berbasis analisis teknikal profesional: MA20/50/200, Golden Cross, RSI, MACD, ADX, Stochastic, Bollinger Bands, volume, dan posisi 52 minggu, dengan skor layak beli.' }
  ]
});

// Uses the default liquid universe defined server-side (server/utils/universe.ts)
const { data, pending, error, refresh } = await useFetch<any>(() => '/api/screen');

const rows = computed<any[]>(() => data.value?.results || []);
const source = computed(() => data.value?.source || 'live');
const snapshotDate = computed(() => data.value?.date || null);
const hasFundamentals = computed(() => rows.value.some((x) => x.per != null));

// Basic filters
const ratingFilter = ref<'all' | 'Kuat' | 'Menarik'>('all');
const searchQ = ref('');
const onlyUptrend = ref(false);
const onlyValue = ref(false); // "Murah + Uptrend": PER wajar & di atas MA200

// Advanced filters
const minAdx = ref(0); // 0 = off
const rsiMin = ref(0);
const rsiMax = ref(100);

interface QuickSignal { key: string; label: string; test: (x: any) => boolean }
const QUICK_SIGNALS: QuickSignal[] = [
  { key: 'golden', label: 'Golden Cross', test: (x) => x.signals?.some((s: any) => s.label === 'Golden Cross') },
  { key: 'breakout', label: 'Breakout Bollinger', test: (x) => x.bbPercentB != null && x.bbPercentB > 1 },
  { key: 'macd', label: 'MACD Bullish', test: (x) => x.macd != null && x.macdSignal != null && x.macd > x.macdSignal },
  { key: 'volume', label: 'Volume Spike ≥1.5x', test: (x) => x.volRatio != null && x.volRatio >= 1.5 },
  { key: 'near52h', label: 'Dekat 52W High', test: (x) => x.pctFromHigh != null && x.pctFromHigh >= -8 }
];
const activeQuickSignals = ref<Set<string>>(new Set());
function toggleQuickSignal(key: string) {
  const next = new Set(activeQuickSignals.value);
  if (next.has(key)) next.delete(key); else next.add(key);
  activeQuickSignals.value = next;
}

const rsiRangeActive = computed(() => rsiMin.value > 0 || rsiMax.value < 100);
const hasAdvancedFilters = computed(() => minAdx.value > 0 || rsiRangeActive.value || activeQuickSignals.value.size > 0);

function resetAdvancedFilters() {
  minAdx.value = 0;
  rsiMin.value = 0;
  rsiMax.value = 100;
  activeQuickSignals.value = new Set();
}

const filtered = computed(() => {
  let r = rows.value;
  if (ratingFilter.value !== 'all') r = r.filter((x) => x.rating === ratingFilter.value);
  if (onlyUptrend.value) r = r.filter((x) => x.sma200 != null && x.price > x.sma200);
  // Value + trend: profitable, reasonably cheap (0 < PER <= 15), and uptrend
  if (onlyValue.value) r = r.filter((x) => x.per != null && x.per > 0 && x.per <= 15 && x.sma200 != null && x.price > x.sma200);
  const q = searchQ.value.trim().toUpperCase();
  if (q) r = r.filter((x) => x.code.includes(q) || (x.name || '').toUpperCase().includes(q));

  if (minAdx.value > 0) r = r.filter((x) => x.adx != null && x.adx >= minAdx.value);
  if (rsiRangeActive.value) r = r.filter((x) => x.rsi != null && x.rsi >= rsiMin.value && x.rsi <= rsiMax.value);
  if (activeQuickSignals.value.size > 0) {
    const active = QUICK_SIGNALS.filter((s) => activeQuickSignals.value.has(s.key));
    r = r.filter((x) => active.every((s) => s.test(x)));
  }
  return r;
});

const counts = computed(() => ({
  kuat: rows.value.filter((x) => x.rating === 'Kuat').length,
  menarik: rows.value.filter((x) => x.rating === 'Menarik').length,
  total: rows.value.length
}));

const SIGNAL_TONE: Record<string, string> = {
  bull: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  bear: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
  warn: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  neutral: 'text-slate-300 bg-slate-800/60 border-slate-700'
};

function ratingClass(rating: string) {
  if (rating === 'Kuat') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25';
  if (rating === 'Menarik') return 'text-sky-300 bg-sky-500/10 border-sky-500/25';
  if (rating === 'Netral') return 'text-slate-300 bg-slate-800/60 border-slate-700';
  return 'text-rose-300 bg-rose-500/10 border-rose-500/25';
}
function scoreBarClass(score: number) {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 55) return 'bg-sky-500';
  if (score >= 40) return 'bg-slate-500';
  return 'bg-rose-500';
}
function rsiClass(rsi: number | null) {
  if (rsi == null) return 'text-slate-500';
  if (rsi < 30) return 'text-amber-400';
  if (rsi > 70) return 'text-rose-400';
  if (rsi >= 40 && rsi <= 60) return 'text-emerald-400';
  return 'text-slate-300';
}
const fmt = (n: number | null) => (n == null ? '—' : n.toLocaleString('id-ID'));
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">

      <!-- Header + filters -->
      <section class="glow-card rounded-2xl p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-50">Screening Teknikal</h2>
            <p class="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Skor 0–100 layak-beli dari indikator teknikal profesional: tren (MA20/50/200, Golden Cross,
              <strong class="text-slate-300">ADX/DMI</strong>), momentum (RSI, MACD, <strong class="text-slate-300">Stochastic</strong>),
              volatilitas (<strong class="text-slate-300">Bollinger Bands</strong>, ATR), serta volume &amp; posisi 52 minggu.
              Memindai <strong class="text-slate-300">{{ counts.total }}</strong> saham, diurutkan dari skor tertinggi.
              <span v-if="filtered.length !== counts.total" class="text-emerald-400 font-semibold">{{ filtered.length }} lolos filter.</span>
            </p>
            <p class="text-[10px] mt-1.5" :class="source === 'snapshot' ? 'text-slate-500' : 'text-amber-400'">
              <span v-if="source === 'snapshot'">📦 Data snapshot harian {{ snapshotDate }} (teknikal + fundamental, dari cron)</span>
              <span v-else>⚡ Live compute (snapshot harian belum tersedia — fundamental menyusul setelah sync)</span>
            </p>
          </div>
          <button
            type="button"
            class="px-3.5 py-2 text-xs font-semibold bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:border-slate-700 transition-colors"
            @click="refresh()"
          >
            ↻ Muat ulang
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold text-slate-400">Cari kode / nama</label>
            <input
              v-model="searchQ"
              placeholder="mis. BBCA, tambang"
              class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold text-slate-400">Rating</label>
            <div class="grid grid-cols-3 bg-slate-900 p-1 border border-slate-800 rounded-xl">
              <button type="button" class="py-1.5 text-xs font-semibold rounded-lg transition-all" :class="ratingFilter === 'all' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'" @click="ratingFilter = 'all'">Semua</button>
              <button type="button" class="py-1.5 text-xs font-semibold rounded-lg transition-all" :class="ratingFilter === 'Kuat' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'" @click="ratingFilter = 'Kuat'">Kuat</button>
              <button type="button" class="py-1.5 text-xs font-semibold rounded-lg transition-all" :class="ratingFilter === 'Menarik' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'" @click="ratingFilter = 'Menarik'">Menarik</button>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold text-slate-400">Filter cepat</label>
            <div class="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                class="py-2 text-xs font-semibold rounded-lg border transition-all"
                :class="onlyUptrend ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'"
                @click="onlyUptrend = !onlyUptrend"
              >
                {{ onlyUptrend ? '✓ ' : '' }}Uptrend (di atas MA200)
              </button>
              <button
                type="button"
                :disabled="!hasFundamentals"
                class="py-2 text-xs font-semibold rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                :class="onlyValue ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'"
                :title="hasFundamentals ? 'PER 0–15 + di atas MA200' : 'Butuh data fundamental (snapshot harian)'"
                @click="onlyValue = !onlyValue"
              >
                {{ onlyValue ? '✓ ' : '' }}💎 Murah + Uptrend
              </button>
            </div>
          </div>
          <div class="flex items-end">
            <div class="flex gap-2 text-xs">
              <span class="px-3 py-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 font-semibold">Kuat: {{ counts.kuat }}</span>
              <span class="px-3 py-1.5 rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-300 font-semibold">Menarik: {{ counts.menarik }}</span>
            </div>
          </div>
        </div>

        <!-- Advanced filters -->
        <div class="mt-5 pt-5 border-t border-slate-900">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filter Lanjutan</span>
            <button
              v-if="hasAdvancedFilters"
              type="button"
              class="text-[11px] font-semibold text-rose-300 hover:text-rose-200 transition-colors"
              @click="resetAdvancedFilters"
            >
              ✕ Reset filter lanjutan
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <!-- Min ADX -->
            <div class="flex flex-col gap-2">
              <label class="text-xs font-semibold text-slate-400 flex items-center justify-between">
                <span>Min ADX (kekuatan tren)</span>
                <span class="text-slate-200 font-bold">{{ minAdx > 0 ? minAdx : 'Off' }}</span>
              </label>
              <input
                v-model.number="minAdx"
                type="range" min="0" max="50" step="5"
                class="w-full accent-emerald-500"
              />
              <p class="text-[10px] text-slate-500">ADX ≥ 25 umumnya dianggap tren kuat.</p>
            </div>

            <!-- RSI range -->
            <div class="flex flex-col gap-2">
              <label class="text-xs font-semibold text-slate-400 flex items-center justify-between">
                <span>Rentang RSI</span>
                <span class="text-slate-200 font-bold">{{ rsiMin }}–{{ rsiMax }}</span>
              </label>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="rsiMin"
                  type="number" min="0" max="100"
                  class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                <span class="text-slate-600 text-xs">–</span>
                <input
                  v-model.number="rsiMax"
                  type="number" min="0" max="100"
                  class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <p class="text-[10px] text-slate-500">Mis. 30–50 untuk saham yang baru pulih dari oversold.</p>
            </div>

            <!-- Quick signal chips -->
            <div class="flex flex-col gap-2">
              <label class="text-xs font-semibold text-slate-400">Sinyal spesifik</label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="sig in QUICK_SIGNALS"
                  :key="sig.key"
                  type="button"
                  class="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors"
                  :class="activeQuickSignals.has(sig.key)
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'"
                  @click="toggleQuickSignal(sig.key)"
                >
                  {{ activeQuickSignals.has(sig.key) ? '✓ ' : '' }}{{ sig.label }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Loading -->
      <div v-if="pending" class="py-20 flex flex-col items-center justify-center gap-4 bg-slate-900/30 border border-slate-900 rounded-2xl">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm text-slate-400 animate-pulse">Menghitung indikator teknikal untuk seluruh universe likuid IDX…</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-200 text-sm">
        Gagal memuat data screening. Coba muat ulang.
      </div>

      <!-- Results table -->
      <section v-else class="glow-card rounded-2xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-[900px]">
            <thead>
              <tr class="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th class="px-4 py-3 font-semibold">#</th>
                <th class="px-4 py-3 font-semibold">Saham</th>
                <th class="px-4 py-3 font-semibold text-right">Harga</th>
                <th class="px-4 py-3 font-semibold">Skor Teknikal</th>
                <th class="px-4 py-3 font-semibold text-right">RSI</th>
                <th v-if="hasFundamentals" class="px-4 py-3 font-semibold text-right">Valuasi</th>
                <th class="px-4 py-3 font-semibold">Tren</th>
                <th class="px-4 py-3 font-semibold">Sinyal</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in filtered"
                :key="row.symbol"
                class="border-b border-slate-900/70 hover:bg-slate-900/40 transition-colors"
              >
                <td class="px-4 py-3 text-slate-500 font-mono text-xs">{{ idx + 1 }}</td>
                <td class="px-4 py-3">
                  <NuxtLink :to="`/analisa/${row.code}`" class="group">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded group-hover:bg-emerald-500/20">{{ row.code }}</span>
                    </div>
                    <p class="text-[11px] text-slate-500 mt-1 truncate max-w-[180px]">{{ row.name }}</p>
                  </NuxtLink>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="font-semibold text-slate-100">{{ fmt(row.price) }}</div>
                  <div class="text-[11px] font-medium" :class="row.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'">
                    {{ row.changePct >= 0 ? '+' : '' }}{{ row.changePct }}%
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <span class="text-lg font-extrabold text-slate-50 w-8">{{ row.score }}</span>
                    <div class="flex-grow max-w-[120px]">
                      <div class="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-full rounded-full" :class="scoreBarClass(row.score)" :style="{ width: row.score + '%' }"></div>
                      </div>
                      <span class="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border" :class="ratingClass(row.rating)">{{ row.rating }}</span>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-right font-semibold" :class="rsiClass(row.rsi)">{{ row.rsi ?? '—' }}</td>
                <td v-if="hasFundamentals" class="px-4 py-3 text-right whitespace-nowrap">
                  <div class="text-xs font-semibold" :class="row.per != null && row.per > 0 && row.per <= 15 ? 'text-emerald-400' : 'text-slate-300'">
                    {{ row.per != null ? 'PER ' + row.per + '×' : '—' }}
                  </div>
                  <div class="text-[10px] text-slate-500 mt-0.5">
                    <span v-if="row.pbv != null">PBV {{ row.pbv }}×</span>
                    <span v-if="row.roe != null"> · ROE {{ row.roe }}%</span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1.5 text-xs">
                    <span :class="row.sma200 != null && row.price > row.sma200 ? 'text-emerald-400' : 'text-rose-400'">
                      {{ row.sma200 != null && row.price > row.sma200 ? '▲ Uptrend' : '▼ Downtrend' }}
                    </span>
                    <span
                      v-if="row.adx != null"
                      class="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                      :class="row.adx >= 25 ? 'bg-slate-800 text-slate-200' : 'bg-slate-900 text-slate-500'"
                      :title="'ADX ' + row.adx + (row.adx >= 25 ? ' (tren kuat)' : ' (tren lemah)')"
                    >ADX {{ Math.round(row.adx) }}</span>
                  </div>
                  <p class="text-[10px] text-slate-500 mt-0.5">MA50: {{ fmt(row.sma50) }} · MA200: {{ fmt(row.sma200) }}</p>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1 max-w-[280px]">
                    <span
                      v-for="(sig, i) in row.signals.slice(0, 5)"
                      :key="i"
                      class="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                      :class="SIGNAL_TONE[sig.tone]"
                    >{{ sig.label }}</span>
                    <span v-if="!row.signals.length" class="text-[10px] text-slate-600">—</span>
                  </div>
                </td>
              </tr>
              <tr v-if="!filtered.length">
                <td :colspan="hasFundamentals ? 8 : 7" class="px-4 py-10 text-center text-sm text-slate-500">Tidak ada saham yang cocok dengan filter.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Disclaimer -->
      <footer class="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
        <p class="text-[11px] leading-relaxed text-slate-400">
          Skor teknikal adalah heuristik gabungan indikator (bukan rekomendasi beli/jual). Analisis teknikal
          menggambarkan probabilitas, bukan kepastian. Selalu gabungkan dengan analisis fundamental dan
          manajemen risiko. Data dari Yahoo Finance dapat tertunda.
        </p>
      </footer>

    </main>
  </div>
</template>
