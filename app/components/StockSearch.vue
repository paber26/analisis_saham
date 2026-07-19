<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { STOCK_GROUPS } from '../data/stockList';

interface SearchResultItem {
  symbol: string;
  code: string;
  name: string;
  exchange: string;
  type: string;
}

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const query = ref('');
const results = ref<SearchResultItem[]>([]);
const loading = ref(false);
const open = ref(false);
const quickPick = ref('');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function runSearch(q: string) {
  loading.value = true;
  try {
    const res = await $fetch<{ results: SearchResultItem[] }>('/api/search', { params: { q } });
    results.value = res.results || [];
    open.value = true;
  } catch {
    results.value = [];
  } finally {
    loading.value = false;
  }
}

watch(query, (val) => {
  const q = val.trim();
  if (debounceTimer) clearTimeout(debounceTimer);
  if (q.length < 1) {
    results.value = [];
    open.value = false;
    return;
  }
  debounceTimer = setTimeout(() => runSearch(q), 300);
});

function select(code: string) {
  emit('update:modelValue', code.toUpperCase());
  query.value = '';
  results.value = [];
  open.value = false;
}

function onEnter() {
  const first = results.value[0];
  if (first) select(first.code);
  else if (query.value.trim()) select(query.value.trim());
}

function onQuickPick() {
  if (quickPick.value) {
    select(quickPick.value);
    quickPick.value = '';
  }
}

// Small delay so a click on a result registers before the dropdown closes
function onBlur() {
  setTimeout(() => { open.value = false; }, 150);
}
function onFocus() {
  if (results.value.length) open.value = true;
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <div class="flex flex-col sm:flex-row gap-3 w-full">
    <!-- Live autocomplete search over the whole IDX -->
    <div class="relative flex-grow min-w-0">
      <div class="relative">
        <svg
          class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="query"
          type="text"
          :placeholder="placeholder || `Cari saham IDX (aktif: ${modelValue})`"
          class="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-9 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors uppercase"
          @focus="onFocus"
          @blur="onBlur"
          @keyup.enter="onEnter"
          @keyup.esc="open = false"
        />
        <div v-if="loading" class="absolute right-3 top-1/2 -translate-y-1/2">
          <div class="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>

      <!-- Results dropdown -->
      <ul
        v-if="open && results.length"
        class="absolute z-50 mt-2 w-full max-h-72 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-2xl shadow-black/40 py-1"
      >
        <li v-for="r in results" :key="r.symbol">
          <button
            type="button"
            class="w-full text-left px-3 py-2 hover:bg-slate-800/70 transition-colors flex items-center justify-between gap-3"
            @mousedown.prevent="select(r.code)"
          >
            <span class="flex items-center gap-2 min-w-0">
              <span class="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded shrink-0">{{ r.code }}</span>
              <span class="text-sm text-slate-300 truncate">{{ r.name }}</span>
            </span>
            <span class="text-[10px] text-slate-500 shrink-0">{{ r.exchange }}</span>
          </button>
        </li>
      </ul>

      <!-- Empty state -->
      <div
        v-else-if="open && !loading && query.trim().length >= 1"
        class="absolute z-50 mt-2 w-full bg-slate-900 border border-slate-800 rounded-xl shadow-2xl px-3 py-3 text-xs text-slate-400"
      >
        Tidak ada saham IDX yang cocok. Tekan Enter untuk memakai
        <strong class="text-slate-200">{{ query.trim().toUpperCase() }}</strong> apa adanya.
      </div>
    </div>

    <!-- Quick pick by sector -->
    <select
      v-model="quickPick"
      class="sm:w-52 shrink-0 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500 transition-colors"
      @change="onQuickPick"
    >
      <option value="" disabled>Pilih cepat…</option>
      <option value="IHSG">IHSG — Indeks Gabungan</option>
      <optgroup v-for="g in STOCK_GROUPS" :key="g.label" :label="g.label">
        <option v-for="o in g.options" :key="o.code" :value="o.code">{{ o.code }} — {{ o.name }}</option>
      </optgroup>
    </select>
  </div>
</template>
