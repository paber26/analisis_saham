<script setup lang="ts">
import { ref, onMounted } from 'vue';

useHead({ title: 'Watchlist Saham — Pantauan Pribadi' });

const { token, setToken, clearToken, authHeaders } = useAppToken();
const tokenInput = ref('');
const rows = ref<any[]>([]);
const codes = ref<string[]>([]);
const loading = ref(false);
const authError = ref(false);
const newSymbol = ref('');

async function load() {
  if (!token.value) return;
  loading.value = true;
  authError.value = false;
  try {
    const d = await $fetch<any>('/api/watchlist', { headers: authHeaders.value });
    codes.value = d.codes || [];
    rows.value = d.rows || [];
  } catch (e: any) {
    if (e?.statusCode === 401) { authError.value = true; clearToken(); }
  } finally {
    loading.value = false;
  }
}

async function mutate(code: string, action: 'add' | 'remove') {
  if (!code) return;
  try {
    await $fetch('/api/watchlist', { method: 'POST', headers: authHeaders.value, body: { code, action } });
    await load();
  } catch { /* ignore */ }
}

function unlock() {
  setToken(tokenInput.value);
  tokenInput.value = '';
  load();
}
function addSymbol() {
  const c = newSymbol.value.trim().toUpperCase();
  if (c) { mutate(c, 'add'); newSymbol.value = ''; }
}

const fmt = (n: number | null) => (n == null ? '—' : n.toLocaleString('id-ID'));
function ratingClass(r: string) {
  if (r === 'Kuat') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25';
  if (r === 'Menarik') return 'text-sky-300 bg-sky-500/10 border-sky-500/25';
  if (r === 'Netral') return 'text-slate-300 bg-slate-800/60 border-slate-700';
  return 'text-rose-300 bg-rose-500/10 border-rose-500/25';
}

// Codes present in the watchlist but not in the daily snapshot (no metrics)
const missing = () => codes.value.filter((c) => !rows.value.some((r) => r.code === c));

onMounted(load);
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">

      <section class="glow-card rounded-2xl p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-slate-50">Watchlist</h2>
            <p class="text-xs text-slate-400 mt-1">Saham pantauan pribadi — skor teknikal &amp; RS dari snapshot harian.</p>
          </div>
          <button v-if="token" type="button" class="text-[11px] text-slate-500 hover:text-slate-300" @click="clearToken(); rows = []; codes = []">🔒 Kunci</button>
        </div>
      </section>

      <!-- Token gate -->
      <section v-if="!token" class="glow-card rounded-2xl p-6">
        <h3 class="text-sm font-bold text-slate-100 mb-1">🔐 Data pribadi terkunci</h3>
        <p class="text-xs text-slate-400 mb-4">Masukkan token akses untuk membuka watchlist &amp; portofolio (disimpan di browser ini).</p>
        <div class="flex gap-2 max-w-sm">
          <input v-model="tokenInput" type="password" placeholder="Token akses" class="flex-grow bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" @keyup.enter="unlock" />
          <button type="button" class="px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-600" @click="unlock">Buka</button>
        </div>
        <p v-if="authError" class="text-[11px] text-rose-400 mt-2">Token salah. Coba lagi.</p>
      </section>

      <template v-else>
        <!-- Add symbol -->
        <section class="glow-card rounded-2xl p-4">
          <div class="flex gap-2 max-w-md">
            <input v-model="newSymbol" placeholder="Tambah kode saham (mis. BBCA)" class="flex-grow bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 uppercase focus:outline-none focus:border-emerald-500" @keyup.enter="addSymbol" />
            <button type="button" class="px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20" @click="addSymbol">+ Tambah</button>
          </div>
        </section>

        <div v-if="loading" class="py-16 flex items-center justify-center"><div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>

        <section v-else class="glow-card rounded-2xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm min-w-[720px]">
              <thead>
                <tr class="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th class="px-4 py-3 font-semibold">Saham</th>
                  <th class="px-4 py-3 font-semibold text-right">Harga</th>
                  <th class="px-4 py-3 font-semibold">Skor</th>
                  <th class="px-4 py-3 font-semibold text-right">RSI</th>
                  <th class="px-4 py-3 font-semibold text-right">RS 3B</th>
                  <th class="px-4 py-3 font-semibold">Tren</th>
                  <th class="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.code" class="border-b border-slate-900/70 hover:bg-slate-900/40">
                  <td class="px-4 py-3">
                    <NuxtLink :to="`/analisa/${row.code}`" class="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded hover:bg-emerald-500/20">{{ row.code }}</NuxtLink>
                    <p class="text-[11px] text-slate-500 mt-1 truncate max-w-[200px]">{{ row.name }}</p>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="font-semibold text-slate-100">{{ fmt(row.price) }}</div>
                    <div class="text-[11px]" :class="row.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ row.changePct >= 0 ? '+' : '' }}{{ row.changePct }}%</div>
                  </td>
                  <td class="px-4 py-3"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full border" :class="ratingClass(row.rating)">{{ row.score }} · {{ row.rating }}</span></td>
                  <td class="px-4 py-3 text-right text-slate-300">{{ row.rsi ?? '—' }}</td>
                  <td class="px-4 py-3 text-right font-semibold" :class="row.rs3m == null ? 'text-slate-600' : Math.abs(row.rs3m) <= 2 ? 'text-slate-300' : row.rs3m > 0 ? 'text-emerald-400' : 'text-rose-400'">{{ row.rs3m == null ? '—' : (row.rs3m >= 0 ? '+' : '') + row.rs3m + '%' }}</td>
                  <td class="px-4 py-3 text-xs" :class="row.sma200 != null && row.price > row.sma200 ? 'text-emerald-400' : 'text-rose-400'">{{ row.sma200 != null && row.price > row.sma200 ? '▲ Up' : '▼ Down' }}</td>
                  <td class="px-4 py-3 text-right"><button type="button" class="text-[11px] text-rose-400 hover:text-rose-300" title="Hapus dari watchlist" @click="mutate(row.code, 'remove')">✕</button></td>
                </tr>
                <tr v-for="c in missing()" :key="c" class="border-b border-slate-900/70">
                  <td class="px-4 py-3"><span class="text-xs font-bold text-slate-300 bg-slate-800/60 border border-slate-700 px-2 py-0.5 rounded">{{ c }}</span></td>
                  <td colspan="5" class="px-4 py-3 text-[11px] text-slate-500">Di luar universe snapshot — <NuxtLink :to="`/analisa/${c}`" class="text-emerald-400">lihat analisa</NuxtLink></td>
                  <td class="px-4 py-3 text-right"><button type="button" class="text-[11px] text-rose-400 hover:text-rose-300" @click="mutate(c, 'remove')">✕</button></td>
                </tr>
                <tr v-if="!rows.length && !missing().length">
                  <td colspan="7" class="px-4 py-10 text-center text-sm text-slate-500">Watchlist kosong. Tambah saham di atas atau klik ⭐ di halaman analisa.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

    </main>
  </div>
</template>
