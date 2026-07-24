<script setup lang="ts">
import { ref, watch } from 'vue';

useHead({
  title: 'Profil Saham (Emiten) - IDX',
  meta: [
    {
      name: 'description',
      content: 'Profil emiten saham IDX: sektor, industri, ringkasan bisnis, dan informasi kontak.'
    }
  ]
});

// Active symbol initialised from the URL for shareable links
const route = useRoute();
const router = useRouter();
const activeSymbol = ref(((route.query.symbol as string) || 'BBCA').toUpperCase().trim());

// Sync URL query → state so external navigation (e.g. the screening rail) updates
// the page without a remount.
watch(() => route.query.symbol, (s) => {
  const v = ((s as string) || '').toUpperCase().trim();
  if (v && v !== activeSymbol.value) activeSymbol.value = v;
});

watch(activeSymbol, (sym) => {
  router.replace({ query: { ...route.query, symbol: sym } });
});

const { setLast } = useLastSymbol();
watch(activeSymbol, setLast, { immediate: true });

const { data: profile, pending, error } = await useFetch<any>(() => '/api/profile', {
  params: { symbol: activeSymbol },
  watch: [activeSymbol]
});

const formatLargeNumber = (num: number | undefined, suffix = '') => {
  if (!num && num !== 0) return '—';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + ' T' + suffix;
  if (num >= 1e9) return (num / 1e9).toFixed(2) + ' B' + suffix;
  if (num >= 1e6) return (num / 1e6).toFixed(2) + ' M' + suffix;
  return num.toLocaleString('id-ID') + suffix;
};

const showEmbed = ref(false);

const formatPct = (val?: number) => {
  if (val === undefined || val === null) return '—';
  return (val * 100).toFixed(2) + '%';
};

const formatRatio = (val?: number) => {
  if (val === undefined || val === null) return '—';
  return val.toFixed(2) + 'x';
};
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">
      <section class="glow-card rounded-2xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider">Profil Emiten</h2>
          <button
            v-if="profile?.sectorsUrl"
            @click="showEmbed = !showEmbed"
            class="px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2"
            :class="showEmbed ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-xs' : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'"
          >
            <span>{{ showEmbed ? '📋 Kembali ke Ringkasan Profil' : '🖥️ Tampilkan Tampilan Interaktif Sectors.app' }}</span>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
          <div class="flex flex-col gap-2 sm:col-span-2">
            <label class="text-xs font-semibold text-slate-400">Kode Saham / Indeks</label>
            <StockSearch v-model="activeSymbol" />
          </div>

          <div class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 flex items-center justify-between">
            <div>
              <p class="text-xs text-slate-400">Simbol aktif</p>
              <p class="text-lg font-bold text-slate-50 mt-0.5">
                {{ activeSymbol }}
              </p>
            </div>
            <a
              v-if="profile?.sectorsUrl"
              :href="profile.sectorsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-semibold transition-colors"
              title="Buka langsung di tab Sectors.app"
            >
              <span>Sectors.app</span>
              <span class="text-xs">↗</span>
            </a>
          </div>
        </div>
      </section>

      <!-- Embedded Sectors.app Frame -->
      <section v-if="showEmbed && profile?.sectorsUrl" class="glow-card rounded-2xl p-4 overflow-hidden animate-fadeIn">
        <div class="flex items-center justify-between mb-3 px-2">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span class="text-xs font-semibold text-cyan-300">Tampilan Interaktif Sectors.app ({{ activeSymbol }})</span>
          </div>
          <a :href="profile.sectorsUrl" target="_blank" rel="noopener" class="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1">
            <span>Buka Tab Baru</span>
            <span>↗</span>
          </a>
        </div>
        <iframe
          :src="profile.sectorsUrl"
          class="w-full h-[850px] rounded-xl border border-slate-800 bg-slate-950 shadow-inner"
          title="Sectors.app Live Interactive Profile"
        ></iframe>
      </section>

      <section v-if="pending" class="glow-card rounded-2xl p-6">
        <p class="text-sm text-slate-300">Memuat profil...</p>
      </section>

      <section v-else-if="error" class="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
        <p class="text-sm text-red-200">Gagal memuat profil. Coba kode lain.</p>
      </section>

      <section v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="glow-card rounded-2xl p-6">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h3 class="text-2xl font-bold tracking-tight text-slate-50">
                  {{ profile?.name || '—' }}
                </h3>
                <p class="text-xs text-slate-400 mt-1">
                  {{ profile?.symbol || activeSymbol }} • {{ profile?.exchange || 'IDX' }} • {{ profile?.currency || 'IDR' }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                  {{ profile?.sector || 'N/A' }}
                </span>
                <span class="text-[11px] font-semibold text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
                  {{ profile?.industry || 'N/A' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Key Financial Ratios & Valuation Grid -->
          <div class="glow-card rounded-2xl p-6">
            <h4 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Valuasi & Rasio Keuangan Utama</h4>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div class="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <span class="text-xs text-slate-400 block mb-1">P/E Ratio (PER)</span>
                <span class="text-base font-bold text-slate-100">{{ formatRatio(profile?.peRatio) }}</span>
              </div>
              <div class="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <span class="text-xs text-slate-400 block mb-1">P/B Ratio (PBV)</span>
                <span class="text-base font-bold text-slate-100">{{ formatRatio(profile?.priceToBook) }}</span>
              </div>
              <div class="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <span class="text-xs text-slate-400 block mb-1">Return on Equity</span>
                <span class="text-base font-bold" :class="(profile?.roe || 0) >= 0.15 ? 'text-emerald-400' : 'text-slate-100'">
                  {{ formatPct(profile?.roe) }}
                </span>
              </div>
              <div class="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <span class="text-xs text-slate-400 block mb-1">Return on Assets</span>
                <span class="text-base font-bold" :class="(profile?.roa || 0) >= 0.05 ? 'text-emerald-400' : 'text-slate-100'">
                  {{ formatPct(profile?.roa) }}
                </span>
              </div>
              <div class="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <span class="text-xs text-slate-400 block mb-1">Dividend Yield</span>
                <span class="text-base font-bold" :class="(profile?.dividendYield || 0) > 0 ? 'text-emerald-400' : 'text-slate-100'">
                  {{ formatPct(profile?.dividendYield) }}
                </span>
              </div>
              <div class="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <span class="text-xs text-slate-400 block mb-1">Profit Margin</span>
                <span class="text-base font-bold text-slate-100">{{ formatPct(profile?.profitMargins) }}</span>
              </div>
              <div class="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <span class="text-xs text-slate-400 block mb-1">Gross Margin</span>
                <span class="text-base font-bold text-slate-100">{{ formatPct(profile?.grossMargins) }}</span>
              </div>
              <div class="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <span class="text-xs text-slate-400 block mb-1">Revenue Growth</span>
                <span class="text-base font-bold" :class="(profile?.revenueGrowth || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'">
                  {{ formatPct(profile?.revenueGrowth) }}
                </span>
              </div>
            </div>
          </div>

          <div class="glow-card rounded-2xl p-6">
            <h4 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Ringkasan Bisnis</h4>
            <p class="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
              {{ profile?.description || 'Tidak ada ringkasan yang tersedia dari sumber data.' }}
            </p>
          </div>
        </div>

        <aside class="space-y-6">
          <div class="glow-card rounded-2xl p-6">
            <h4 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Fakta Singkat & Kapitalisasi</h4>
            <div class="space-y-3 text-sm">
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">Market Cap</span>
                <span class="text-slate-200 text-right font-medium">{{ formatLargeNumber(profile?.marketCap) }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">Enterprise Value</span>
                <span class="text-slate-200 text-right font-medium">{{ formatLargeNumber(profile?.enterpriseValue) }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">Total Kas</span>
                <span class="text-slate-200 text-right font-medium">{{ formatLargeNumber(profile?.totalCash) }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">Total Utang</span>
                <span class="text-slate-200 text-right font-medium">{{ formatLargeNumber(profile?.totalDebt) }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">52W High</span>
                <span class="text-slate-200 text-right font-medium">{{ formatLargeNumber(profile?.fiftyTwoWeekHigh) }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">52W Low</span>
                <span class="text-slate-200 text-right font-medium">{{ formatLargeNumber(profile?.fiftyTwoWeekLow) }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">MA 50 Hari</span>
                <span class="text-slate-200 text-right font-medium">{{ formatLargeNumber(profile?.fiftyDayAverage) }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">MA 200 Hari</span>
                <span class="text-slate-200 text-right font-medium">{{ formatLargeNumber(profile?.twoHundredDayAverage) }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">Karyawan</span>
                <span class="text-slate-200 text-right font-medium">{{ profile?.employees?.toLocaleString('id-ID') || '—' }}</span>
              </div>
            </div>
          </div>

          <div class="glow-card rounded-2xl p-6">
            <h4 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Kontak</h4>
            <div class="space-y-3 text-sm">
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">Website</span>
                <a
                  v-if="profile?.website"
                  :href="profile.website"
                  target="_blank"
                  rel="noopener"
                  class="text-emerald-400 hover:text-emerald-300 text-right break-all underline"
                >
                  {{ profile.website }}
                </a>
                <span v-else class="text-slate-200 text-right">—</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">Telepon</span>
                <span class="text-slate-200 text-right break-all">{{ profile?.phone || '—' }}</span>
              </div>
              <div class="pt-3 border-t border-slate-900">
                <p class="text-slate-400 text-xs mb-2">Alamat</p>
                <p class="text-slate-200 text-sm leading-relaxed">
                  {{ profile?.address || '—' }}
                </p>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            <p class="text-xs text-cyan-200/90 leading-relaxed">
              💡 Tekan tombol <strong>🖥️ Tampilkan Tampilan Interaktif Sectors.app</strong> di kanan atas untuk memuat laporan interaktif Sectors.app langsung di dalam dasbor ini.
            </p>
          </div>
        </aside>
      </section>
    </main>
  </div>
</template>

