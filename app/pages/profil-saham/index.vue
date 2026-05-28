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

const selectedStockCode = ref('BBCA');
const searchSymbolQuery = ref('');
const activeSymbol = ref('BBCA');

watch(selectedStockCode, (newCode) => {
  if (newCode !== 'CUSTOM') {
    activeSymbol.value = newCode;
    searchSymbolQuery.value = '';
  } else {
    searchSymbolQuery.value = 'BUMI';
    activeSymbol.value = 'BUMI';
  }
});

const handleCustomSearch = () => {
  const query = searchSymbolQuery.value.trim().toUpperCase();
  if (query) activeSymbol.value = query;
};

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
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">
      <section class="glow-card rounded-2xl p-6">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Profil Emiten</h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
          <div class="flex flex-col gap-2">
            <label for="stockSelect" class="text-xs font-semibold text-slate-400">Kode Saham / Indeks</label>
            <select
              id="stockSelect"
              v-model="selectedStockCode"
              class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            >
              <option value="IHSG">IHSG - Indeks Harga Saham Gabungan</option>

              <optgroup label="Perbankan & Keuangan">
                <option value="BBCA">BBCA - Bank Central Asia Tbk</option>
                <option value="BBRI">BBRI - Bank Rakyat Indonesia Tbk</option>
                <option value="BMRI">BMRI - Bank Mandiri Tbk</option>
                <option value="BBNI">BBNI - Bank Negara Indonesia Tbk</option>
                <option value="BBTN">BBTN - Bank Tabungan Negara Tbk</option>
              </optgroup>

              <optgroup label="Energi & Tambang">
                <option value="ADRO">ADRO - Adaro Energy Indonesia Tbk</option>
                <option value="PTBA">PTBA - Bukit Asam Tbk</option>
                <option value="BUMI">BUMI - Bumi Resources Tbk</option>
                <option value="MEDC">MEDC - Medco Energi Internasional Tbk</option>
                <option value="HRUM">HRUM - Harum Energy Tbk</option>
              </optgroup>

              <optgroup label="Infrastruktur & Telko">
                <option value="TLKM">TLKM - Telkom Indonesia Tbk</option>
                <option value="ISAT">ISAT - Indosat Ooredoo Hutchison Tbk</option>
                <option value="EXCL">EXCL - XL Axiata Tbk</option>
                <option value="JSMR">JSMR - Jasa Marga Tbk</option>
                <option value="PGAS">PGAS - Perusahaan Gas Negara Tbk</option>
              </optgroup>

              <optgroup label="Konsumer">
                <option value="UNVR">UNVR - Unilever Indonesia Tbk</option>
                <option value="ICBP">ICBP - Indofood CBP Sukses Makmur Tbk</option>
                <option value="INDF">INDF - Indofood Sukses Makmur Tbk</option>
                <option value="MYOR">MYOR - Mayora Indah Tbk</option>
                <option value="ACES">ACES - Aspirasi Hidup Indonesia Tbk</option>
              </optgroup>

              <optgroup label="Lainnya">
                <option value="CUSTOM">Cari Kode Sendiri...</option>
              </optgroup>
            </select>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-xs font-semibold text-slate-400">Cari Manual</label>
            <div class="flex gap-2">
              <input
                v-model="searchSymbolQuery"
                placeholder="Contoh: ASII, BREN, BRIS"
                class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                @keyup.enter="handleCustomSearch"
              />
              <button
                class="px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20 transition-colors"
                @click="handleCustomSearch"
              >
                Cari
              </button>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <p class="text-xs text-slate-400">Simbol aktif</p>
            <p class="text-lg font-bold text-slate-50 mt-1">
              {{ activeSymbol }}
            </p>
          </div>
        </div>
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
                  {{ profile?.symbol || activeSymbol }} • {{ profile?.exchange || 'N/A' }} • {{ profile?.currency || 'N/A' }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                  {{ profile?.sector || 'N/A' }}
                </span>
                <span class="text-[11px] font-semibold text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
                  {{ profile?.industry || 'N/A' }}
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
            <h4 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Fakta Singkat</h4>
            <div class="space-y-3 text-sm">
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">Market Cap</span>
                <span class="text-slate-200 text-right">{{ formatLargeNumber(profile?.marketCap) }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">52W High</span>
                <span class="text-slate-200 text-right">{{ formatLargeNumber(profile?.fiftyTwoWeekHigh) }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">52W Low</span>
                <span class="text-slate-200 text-right">{{ formatLargeNumber(profile?.fiftyTwoWeekLow) }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">Karyawan</span>
                <span class="text-slate-200 text-right">{{ profile?.employees?.toLocaleString('id-ID') || '—' }}</span>
              </div>
            </div>
          </div>

          <div class="glow-card rounded-2xl p-6">
            <h4 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Kontak</h4>
            <div class="space-y-3 text-sm">
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">Website</span>
                <span class="text-slate-200 text-right break-all">{{ profile?.website || '—' }}</span>
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

          <div class="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <p class="text-xs text-amber-200 leading-relaxed">
              Data profil bersumber dari Yahoo Finance dan dapat berbeda dengan laporan resmi emiten. Ini bukan rekomendasi investasi.
            </p>
          </div>
        </aside>
      </section>
    </main>
  </div>
</template>

