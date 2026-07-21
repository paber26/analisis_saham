<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

useHead({ title: 'Portofolio — P&L, Korelasi & Risiko' });

const { token, setToken, clearToken, authHeaders } = useAppToken();
const tokenInput = ref('');
const authError = ref(false);
const loading = ref(false);
const analysis = ref<any>(null);
const holdings = ref<any[]>([]);

const form = ref({ symbol: '', lots: null as number | null, avgPrice: null as number | null });

async function load() {
  if (!token.value) return;
  loading.value = true;
  authError.value = false;
  try {
    const d = await $fetch<any>('/api/portfolio', { headers: authHeaders.value });
    analysis.value = d.analysis;
    holdings.value = d.holdings || [];
  } catch (e: any) {
    if (e?.statusCode === 401) { authError.value = true; clearToken(); }
  } finally {
    loading.value = false;
  }
}
function unlock() { setToken(tokenInput.value); tokenInput.value = ''; load(); }

async function addHolding() {
  const { symbol, lots, avgPrice } = form.value;
  if (!symbol || !lots || !avgPrice) return;
  try {
    await $fetch('/api/portfolio', { method: 'POST', headers: authHeaders.value, body: { symbol, lots, avgPrice } });
    form.value = { symbol: '', lots: null, avgPrice: null };
    await load();
  } catch { /* ignore */ }
}
async function removeHolding(symbol: string) {
  try {
    await $fetch('/api/portfolio', { method: 'DELETE', headers: authHeaders.value, body: { symbol } });
    await load();
  } catch { /* ignore */ }
}

const fmtRp = (n: number | null | undefined) => (n == null ? '—' : 'Rp ' + Math.round(n).toLocaleString('id-ID'));
const positions = computed<any[]>(() => analysis.value?.positions || []);
const risk = computed(() => analysis.value?.risk || null);
const corr = computed(() => analysis.value?.correlation || null);
const warnings = computed<string[]>(() => analysis.value?.warnings || []);

const ALLOC_COLORS = ['bg-emerald-500', 'bg-sky-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500', 'bg-teal-500', 'bg-fuchsia-500', 'bg-orange-500'];
function corrCell(v: number) {
  if (v >= 0.999) return 'bg-slate-800 text-slate-500';
  if (v > 0.7) return 'bg-rose-500/20 text-rose-300';
  if (v > 0.4) return 'bg-amber-500/15 text-amber-300';
  if (v >= 0) return 'bg-slate-800/60 text-slate-300';
  return 'bg-emerald-500/15 text-emerald-300';
}

onMounted(load);
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">

      <section class="glow-card rounded-2xl p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-slate-50">Portofolio</h2>
            <p class="text-xs text-slate-400 mt-1">P&amp;L, alokasi, korelasi antar-holding &amp; risiko portofolio (VaR, drawdown, beta).</p>
          </div>
          <button v-if="token" type="button" class="text-[11px] text-slate-500 hover:text-slate-300" @click="clearToken(); analysis = null; holdings = []">🔒 Kunci</button>
        </div>
      </section>

      <!-- Token gate -->
      <section v-if="!token" class="glow-card rounded-2xl p-6">
        <h3 class="text-sm font-bold text-slate-100 mb-1">🔐 Data pribadi terkunci</h3>
        <p class="text-xs text-slate-400 mb-4">Masukkan token akses (disimpan di browser ini).</p>
        <div class="flex gap-2 max-w-sm">
          <input v-model="tokenInput" type="password" placeholder="Token akses" class="flex-grow bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" @keyup.enter="unlock" />
          <button type="button" class="px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-600" @click="unlock">Buka</button>
        </div>
        <p v-if="authError" class="text-[11px] text-rose-400 mt-2">Token salah. Coba lagi.</p>
      </section>

      <template v-else>
        <!-- Add holding -->
        <section class="glow-card rounded-2xl p-4">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <input v-model="form.symbol" placeholder="Kode (BBCA)" class="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 uppercase focus:outline-none focus:border-emerald-500" />
            <input v-model.number="form.lots" type="number" min="1" placeholder="Lot" class="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
            <input v-model.number="form.avgPrice" type="number" min="1" placeholder="Harga rata2" class="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
            <button type="button" class="px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-600" @click="addHolding">+ Simpan</button>
          </div>
          <p class="text-[10px] text-slate-500 mt-2">1 lot = 100 lembar. Menambah kode yang sudah ada akan menimpa data lamanya.</p>
        </section>

        <div v-if="loading" class="py-16 flex items-center justify-center"><div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>

        <template v-else-if="analysis">
          <!-- Summary -->
          <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="glow-card rounded-2xl p-5">
              <p class="text-[11px] text-slate-400 uppercase">Nilai Pasar</p>
              <p class="text-2xl font-extrabold text-slate-50 mt-1">{{ fmtRp(analysis.totalValue) }}</p>
              <p class="text-[11px] text-slate-500 mt-1">Modal: {{ fmtRp(analysis.totalCost) }}</p>
            </div>
            <div class="glow-card rounded-2xl p-5">
              <p class="text-[11px] text-slate-400 uppercase">Untung / Rugi</p>
              <p class="text-2xl font-extrabold mt-1" :class="analysis.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ analysis.totalPnl >= 0 ? '+' : '' }}{{ fmtRp(analysis.totalPnl) }}</p>
              <p class="text-sm font-bold mt-0.5" :class="analysis.totalPnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ analysis.totalPnlPct >= 0 ? '+' : '' }}{{ analysis.totalPnlPct }}%</p>
            </div>
            <div class="glow-card rounded-2xl p-5">
              <p class="text-[11px] text-slate-400 uppercase">Risiko (VaR 95% harian)</p>
              <p class="text-2xl font-extrabold text-amber-400 mt-1">{{ risk ? fmtRp(risk.var95Rp) : '—' }}</p>
              <p class="text-[11px] text-slate-500 mt-1" v-if="risk">≈ {{ risk.var95Pct }}% · vol {{ risk.volAnnualPct }}%/th · beta {{ risk.beta ?? '—' }}</p>
            </div>
          </section>

          <!-- Warnings -->
          <section v-if="warnings.length" class="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-4">
            <p v-for="(w, i) in warnings" :key="i" class="text-[12px] text-amber-200 flex gap-2"><span>⚠</span><span>{{ w }}</span></p>
          </section>

          <!-- Positions + Allocation -->
          <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div class="glow-card rounded-2xl overflow-hidden lg:col-span-2">
              <div class="overflow-x-auto">
                <table class="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr class="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                      <th class="px-4 py-3 font-semibold">Saham</th>
                      <th class="px-4 py-3 font-semibold text-right">Lot</th>
                      <th class="px-4 py-3 font-semibold text-right">Avg → Harga</th>
                      <th class="px-4 py-3 font-semibold text-right">Nilai</th>
                      <th class="px-4 py-3 font-semibold text-right">P&L</th>
                      <th class="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in positions" :key="p.symbol" class="border-b border-slate-900/70 hover:bg-slate-900/40">
                      <td class="px-4 py-3">
                        <NuxtLink :to="`/analisa/${p.code}`" class="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">{{ p.code }}</NuxtLink>
                        <span class="text-[10px] text-slate-500 ml-2">{{ p.weightPct }}%</span>
                      </td>
                      <td class="px-4 py-3 text-right text-slate-300">{{ p.lots }}</td>
                      <td class="px-4 py-3 text-right text-slate-300 text-xs">{{ p.avgPrice.toLocaleString('id-ID') }} → {{ p.price.toLocaleString('id-ID') }}</td>
                      <td class="px-4 py-3 text-right text-slate-100 font-semibold">{{ fmtRp(p.value) }}</td>
                      <td class="px-4 py-3 text-right font-semibold" :class="p.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ p.pnl >= 0 ? '+' : '' }}{{ p.pnlPct }}%</td>
                      <td class="px-4 py-3 text-right"><button type="button" class="text-[11px] text-rose-400 hover:text-rose-300" @click="removeHolding(p.symbol)">✕</button></td>
                    </tr>
                    <tr v-if="!positions.length"><td colspan="6" class="px-4 py-10 text-center text-sm text-slate-500">Belum ada holding. Tambah di atas.</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Allocation -->
            <div class="glow-card rounded-2xl p-6">
              <h4 class="text-sm font-bold text-slate-100 mb-4">Alokasi</h4>
              <div class="space-y-2.5">
                <div v-for="(p, i) in positions" :key="p.symbol">
                  <div class="flex justify-between text-[11px] mb-1"><span class="text-slate-300 font-semibold">{{ p.code }}</span><span class="text-slate-400">{{ p.weightPct }}%</span></div>
                  <div class="h-2 bg-slate-800 rounded-full overflow-hidden"><div class="h-full rounded-full" :class="ALLOC_COLORS[i % ALLOC_COLORS.length]" :style="{ width: p.weightPct + '%' }"></div></div>
                </div>
                <p v-if="!positions.length" class="text-xs text-slate-500">—</p>
              </div>
            </div>
          </section>

          <!-- Correlation matrix -->
          <section v-if="corr && corr.symbols.length >= 2" class="glow-card rounded-2xl p-6">
            <h4 class="text-sm font-bold text-slate-100 mb-1">Matriks Korelasi (return harian 1 tahun)</h4>
            <p class="text-xs text-slate-400 mb-4">Merah = korelasi tinggi (gerak searah → diversifikasi rendah). Hijau = korelasi rendah/negatif (peredam risiko).</p>
            <div class="overflow-x-auto">
              <table class="text-xs border-collapse">
                <thead>
                  <tr>
                    <th class="p-1.5"></th>
                    <th v-for="s in corr.symbols" :key="s" class="p-1.5 text-slate-400 font-semibold">{{ s }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(rowSym, i) in corr.symbols" :key="rowSym">
                    <td class="p-1.5 text-slate-400 font-semibold text-right pr-2">{{ rowSym }}</td>
                    <td v-for="(val, j) in corr.matrix[i]" :key="j" class="p-1.5 text-center rounded font-mono" :class="corrCell(val)" style="min-width:44px">{{ val.toFixed(2) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- Risk detail -->
          <section v-if="risk" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="glow-card rounded-xl p-4"><p class="text-[10px] text-slate-500 uppercase">Volatilitas tahunan</p><p class="text-xl font-extrabold text-slate-100 mt-1">{{ risk.volAnnualPct }}%</p></div>
            <div class="glow-card rounded-xl p-4"><p class="text-[10px] text-slate-500 uppercase">VaR 95% (1 hari)</p><p class="text-xl font-extrabold text-amber-400 mt-1">{{ risk.var95Pct }}%</p></div>
            <div class="glow-card rounded-xl p-4"><p class="text-[10px] text-slate-500 uppercase">Max Drawdown (1th)</p><p class="text-xl font-extrabold text-rose-400 mt-1">−{{ risk.maxDrawdownPct }}%</p></div>
            <div class="glow-card rounded-xl p-4"><p class="text-[10px] text-slate-500 uppercase">Beta vs IHSG</p><p class="text-xl font-extrabold mt-1" :class="risk.beta == null ? 'text-slate-500' : risk.beta > 1.2 ? 'text-rose-400' : risk.beta < 0.8 ? 'text-emerald-400' : 'text-slate-100'">{{ risk.beta ?? '—' }}</p></div>
          </section>

          <footer class="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
            <p class="text-[11px] leading-relaxed text-slate-400">VaR = potensi kerugian harian pada tingkat keyakinan 95% (parametrik, asumsi normal). Beta &gt;1 = lebih fluktuatif dari IHSG. Data harga dari Yahoo, bukan rekomendasi.</p>
          </footer>
        </template>
      </template>

    </main>
  </div>
</template>
