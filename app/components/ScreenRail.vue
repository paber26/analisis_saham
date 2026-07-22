<script setup lang="ts">
import { ref, computed } from 'vue';

// Compact screening list for the right rail on emiten-analysis pages, so the
// user can switch stocks without going back to /screening. Clicking a row keeps
// the current view (analisa/saham/forecast/seasonal/profil-saham).
const route = useRoute();

const { data } = await useFetch<any>(() => '/api/screen', { key: 'screen' });
const rows = computed<any[]>(() => data.value?.results || []);

const search = ref('');
const sortBy = ref<'score' | 'qvm'>('score');

const filtered = computed(() => {
  const q = search.value.trim().toUpperCase();
  let r = rows.value;
  if (q) r = r.filter((x) => x.code.includes(q) || (x.name || '').toUpperCase().includes(q));
  if (sortBy.value === 'qvm') r = [...r].sort((a, b) => (b.qvm ?? -1) - (a.qvm ?? -1));
  return r.slice(0, 120);
});

// Active symbol (params on /analisa/[symbol]; query elsewhere)
const activeCode = computed(() => {
  const raw = (route.params.symbol as string) || (route.query.symbol as string) || '';
  return raw.toUpperCase().replace('.JK', '').trim();
});

// Preserve the current page type when navigating to another stock.
function linkFor(code: string): string {
  const p = route.path;
  if (p.startsWith('/analisa')) return `/analisa/${code}`;
  const base = p.split('?')[0];
  return `${base}?symbol=${code}`;
}

function scoreBarClass(score: number) {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 55) return 'bg-sky-500';
  if (score >= 40) return 'bg-slate-500';
  return 'bg-rose-500';
}
const fmt = (n: number | null) => (n == null ? '—' : n.toLocaleString('id-ID'));
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="px-3 py-3 border-b border-slate-900 shrink-0">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <span class="text-sm">🔍</span>
          <span class="text-xs font-bold text-slate-200">Screening</span>
          <span class="text-[10px] text-slate-500">({{ rows.length }})</span>
        </div>
        <NuxtLink to="/screening" class="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold">Buka penuh →</NuxtLink>
      </div>
      <div class="relative">
        <input
          v-model="search"
          type="text"
          placeholder="Cari kode/nama…"
          class="w-full bg-slate-900 border border-slate-800 rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500"
        />
        <svg class="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </div>
      <div class="flex gap-1 mt-2">
        <button
          class="flex-1 text-[10px] font-semibold py-1 rounded-md border transition-colors"
          :class="sortBy === 'score' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-slate-900 text-slate-400 border-slate-800'"
          @click="sortBy = 'score'"
        >Skor</button>
        <button
          class="flex-1 text-[10px] font-semibold py-1 rounded-md border transition-colors"
          :class="sortBy === 'qvm' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-slate-900 text-slate-400 border-slate-800'"
          @click="sortBy = 'qvm'"
        >QVM</button>
      </div>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto scrollbar-thin">
      <NuxtLink
        v-for="row in filtered"
        :key="row.symbol"
        :to="linkFor(row.code)"
        class="block px-3 py-2 border-b border-slate-900/60 transition-colors"
        :class="row.code === activeCode ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500' : 'hover:bg-slate-900/50 border-l-2 border-l-transparent'"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-bold" :class="row.code === activeCode ? 'text-emerald-300' : 'text-slate-100'">{{ row.code }}</span>
          <div class="text-right">
            <div class="text-xs font-semibold text-slate-200">{{ fmt(row.price) }}</div>
            <div class="text-[10px] font-medium" :class="row.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'">
              {{ row.changePct >= 0 ? '+' : '' }}{{ row.changePct }}%
            </div>
          </div>
        </div>
        <p class="text-[10px] text-slate-500 truncate mt-0.5">{{ row.name }}</p>
        <div class="flex items-center gap-1.5 mt-1">
          <div class="flex-grow h-1 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full rounded-full" :class="scoreBarClass(row.score)" :style="{ width: row.score + '%' }"></div>
          </div>
          <span class="text-[10px] font-bold text-slate-400 w-6 text-right">{{ row.score }}</span>
          <span v-if="row.qvm != null" class="text-[9px] font-bold text-sky-300/80 w-9 text-right" title="QVM">Q{{ Math.round(row.qvm) }}</span>
        </div>
      </NuxtLink>
      <p v-if="!filtered.length" class="px-3 py-6 text-center text-[11px] text-slate-500">Tidak ada hasil.</p>
    </div>
  </div>
</template>
