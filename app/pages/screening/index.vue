<script setup lang="ts">
import { ref, computed } from 'vue';
import { STOCK_GROUPS } from '../../data/stockList';

useHead({
  title: 'Screening Teknikal Saham IDX — Skor Layak Beli',
  meta: [
    { name: 'description', content: 'Screening saham IDX berbasis analisis teknikal profesional: MA20/50/200, Golden Cross, RSI, MACD, volume, dan posisi 52 minggu, dengan skor layak beli.' }
  ]
});

// Universe = curated liquid IDX names (single source: stockList.ts)
const universe = STOCK_GROUPS.flatMap((g) => g.options.map((o) => o.code)).join(',');

const { data, pending, error, refresh } = await useFetch<any>(() => '/api/screen', {
  params: { symbols: universe }
});

const rows = computed<any[]>(() => data.value?.results || []);

// Filters
const ratingFilter = ref<'all' | 'Kuat' | 'Menarik'>('all');
const searchQ = ref('');
const onlyUptrend = ref(false);

const filtered = computed(() => {
  let r = rows.value;
  if (ratingFilter.value !== 'all') r = r.filter((x) => x.rating === ratingFilter.value);
  if (onlyUptrend.value) r = r.filter((x) => x.sma200 != null && x.price > x.sma200);
  const q = searchQ.value.trim().toUpperCase();
  if (q) r = r.filter((x) => x.code.includes(q) || (x.name || '').toUpperCase().includes(q));
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
              Skor 0–100 layak-beli dari indikator teknikal profesional: tren (MA20/50/200, Golden Cross),
              momentum (RSI, MACD), serta volume &amp; posisi 52 minggu. Diurutkan dari skor tertinggi.
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
            <label class="text-xs font-semibold text-slate-400">Filter tren</label>
            <button
              type="button"
              class="py-2.5 text-xs font-semibold rounded-xl border transition-all"
              :class="onlyUptrend ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'"
              @click="onlyUptrend = !onlyUptrend"
            >
              {{ onlyUptrend ? '✓ ' : '' }}Hanya uptrend (di atas MA200)
            </button>
          </div>
          <div class="flex items-end">
            <div class="flex gap-2 text-xs">
              <span class="px-3 py-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 font-semibold">Kuat: {{ counts.kuat }}</span>
              <span class="px-3 py-1.5 rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-300 font-semibold">Menarik: {{ counts.menarik }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Loading -->
      <div v-if="pending" class="py-20 flex flex-col items-center justify-center gap-4 bg-slate-900/30 border border-slate-900 rounded-2xl">
        <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm text-slate-400 animate-pulse">Menghitung indikator teknikal untuk {{ universe.split(',').length }} saham…</p>
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
                  <NuxtLink :to="`/saham?symbol=${row.code}`" class="group">
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
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1.5 text-xs">
                    <span :class="row.sma200 != null && row.price > row.sma200 ? 'text-emerald-400' : 'text-rose-400'">
                      {{ row.sma200 != null && row.price > row.sma200 ? '▲ Uptrend' : '▼ Downtrend' }}
                    </span>
                  </div>
                  <p class="text-[10px] text-slate-500 mt-0.5">MA50: {{ fmt(row.sma50) }} · MA200: {{ fmt(row.sma200) }}</p>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1 max-w-[260px]">
                    <span
                      v-for="(sig, i) in row.signals.slice(0, 4)"
                      :key="i"
                      class="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                      :class="SIGNAL_TONE[sig.tone]"
                    >{{ sig.label }}</span>
                    <span v-if="!row.signals.length" class="text-[10px] text-slate-600">—</span>
                  </div>
                </td>
              </tr>
              <tr v-if="!filtered.length">
                <td colspan="7" class="px-4 py-10 text-center text-sm text-slate-500">Tidak ada saham yang cocok dengan filter.</td>
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
