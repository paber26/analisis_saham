<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

useHead({ title: 'Alert — Notifikasi Sinyal Harian' });

const { token, setToken, clearToken, authHeaders } = useAppToken();
const tokenInput = ref('');
const authError = ref(false);
const loading = ref(false);

interface Rule {
  id: string; code: string;
  type: 'rsi_oversold' | 'breakout_52w' | 'above_ma200' | 'score_above' | 'price_below' | 'murah_uptrend';
  value?: number | null;
  active?: boolean;
  createdAt?: string;
  lastTriggeredAt?: string | null;
}
interface Trigger { id: string; ruleId: string; code: string; type: Rule['type']; message: string; date: string }

const rules = ref<Rule[]>([]);
const history = ref<Trigger[]>([]);

// ---- form ----
const TYPES = [
  { value: 'rsi_oversold', label: 'RSI oversold', hint: 'RSI harian di bawah ambang (default 30)', defVal: 30, needsValue: true },
  { value: 'breakout_52w', label: 'Menyentuh high 52w', hint: 'Harga dalam 1% dari high 52 minggu', defVal: null, needsValue: false },
  { value: 'above_ma200', label: 'Di atas MA200', hint: 'Kondisi hari ini: harga di atas SMA200', defVal: null, needsValue: false },
  { value: 'score_above', label: 'Skor ≥ ambang', hint: 'Skor teknikal melewati ambang (default 70)', defVal: 70, needsValue: true },
  { value: 'price_below', label: 'Harga ≤ target beli', hint: 'Harga close turun ke angka tsb (Rp)', defVal: null, needsValue: true },
  { value: 'murah_uptrend', label: 'Murah + Uptrend', hint: 'PER 0–15 dan di atas MA200', defVal: null, needsValue: false }
] as const;
const newCode = ref('');
const allCodes = ref(false);
const newType = ref<(typeof TYPES)[number]['value']>('rsi_oversold');
const newValue = ref<number | null>(null);
const saving = ref(false);
const toast = ref('');

const activeTypeMeta = computed(() => TYPES.find((t) => t.value === newType.value)!);

async function load() {
  if (!token.value) return;
  loading.value = true;
  authError.value = false;
  try {
    const d = await $fetch<any>('/api/alerts', { headers: authHeaders.value });
    rules.value = d.rules || [];
    history.value = d.history || [];
  } catch (e: any) {
    if (e?.statusCode === 401) { authError.value = true; clearToken(); }
  } finally {
    loading.value = false;
  }
}

function unlock() {
  setToken(tokenInput.value);
  tokenInput.value = '';
  load();
}

function flash(msg: string) {
  toast.value = msg;
  setTimeout(() => (toast.value = ''), 2500);
}

async function addRule() {
  saving.value = true;
  try {
    await $fetch('/api/alerts', {
      method: 'POST',
      headers: authHeaders.value,
      body: {
        code: allCodes.value ? '*' : newCode.value.trim().toUpperCase(),
        type: newType.value,
        value: activeTypeMeta.value.needsValue ? Number(newValue.value) : null,
        active: true
      }
    });
    flash('Rule tersimpan.');
    newCode.value = '';
    newValue.value = null;
    await load();
  } catch (e: any) {
    flash(e?.statusMessage || 'Gagal menyimpan rule.');
  } finally {
    saving.value = false;
  }
}

async function toggleActive(rule: Rule) {
  try {
    await $fetch('/api/alerts', {
      method: 'POST',
      headers: authHeaders.value,
      body: { ...rule, active: rule.active === false }
    });
    await load();
  } catch { /* ignore */ }
}

async function removeRule(id: string) {
  try {
    await $fetch('/api/alerts', { method: 'DELETE', headers: authHeaders.value, params: { id } });
    await load();
  } catch { /* ignore */ }
}

// Dry-run evaluasi (owner login) — tanpa menyimpan/notifikasi.
const dryResult = ref<any>(null);
const dryRunning = ref(false);
async function runDry() {
  dryRunning.value = true;
  try {
    dryResult.value = await $fetch('/api/alerts/run', { params: { dry: 1 } });
  } catch (e: any) {
    dryResult.value = { ok: false, note: e?.statusMessage || 'Gagal menjalankan evaluasi.' };
  } finally {
    dryRunning.value = false;
  }
}

const labelOf = (t: string) => TYPES.find((x) => x.value === t)?.label ?? t;

onMounted(load);
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">

      <section class="glow-card rounded-2xl p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-slate-50">🔔 Alert Sinyal</h2>
            <p class="text-xs text-slate-400 mt-1">
              Rule dievaluasi otomatis tiap hari terhadap snapshot screener (cron pasca-sync).
              Maksimal sekali notifikasi per rule per hari — tidak spam.
            </p>
          </div>
          <button v-if="token" type="button" class="text-[11px] text-slate-500 hover:text-slate-300" @click="clearToken(); rules = []; history = []">🔒 Kunci</button>
        </div>
      </section>

      <!-- Token gate -->
      <section v-if="!token" class="glow-card rounded-2xl p-6">
        <h3 class="text-sm font-bold text-slate-100 mb-1">🔐 Data pribadi terkunci</h3>
        <p class="text-xs text-slate-400 mb-4">Masukkan token akses untuk mengelola alert (atau login via tombol Masuk).</p>
        <div class="flex gap-2 max-w-sm">
          <input v-model="tokenInput" type="password" placeholder="Token akses" class="flex-grow bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" @keyup.enter="unlock" />
          <button type="button" class="px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-600" @click="unlock">Buka</button>
        </div>
        <p v-if="authError" class="text-[11px] text-rose-400 mt-2">Token salah. Coba lagi.</p>
      </section>

      <template v-else>
        <!-- Add rule -->
        <section class="glow-card rounded-2xl p-5 space-y-3">
          <h3 class="text-sm font-bold text-slate-100">+ Rule Baru</h3>
          <div class="grid gap-3 md:grid-cols-[minmax(0,220px)_1fr_minmax(0,160px)_auto] items-end">
            <div>
              <label class="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Saham</label>
              <input v-model="newCode" :disabled="allCodes" placeholder="mis. BBCA"
                class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 uppercase focus:outline-none focus:border-emerald-500 disabled:opacity-40" />
              <label class="flex items-center gap-2 mt-2 text-[11px] text-slate-400 cursor-pointer">
                <input v-model="allCodes" type="checkbox" class="accent-emerald-500" /> Terapkan ke semua saham (*)
              </label>
            </div>
            <div>
              <label class="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Tipe sinyal</label>
              <select v-model="newType" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
                <option v-for="t in TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
              </select>
              <p class="text-[10px] text-slate-500 mt-1">{{ activeTypeMeta.hint }}</p>
            </div>
            <div v-if="activeTypeMeta.needsValue">
              <label class="block text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Ambang</label>
              <input v-model.number="newValue" :placeholder="String(activeTypeMeta.defVal ?? '')" type="number"
                class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
            <button type="button" :disabled="saving || (!allCodes && !newCode.trim())"
              class="px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/20 disabled:opacity-40"
              @click="addRule">+ Tambah Rule</button>
          </div>
          <p v-if="toast" class="text-[11px] text-emerald-400">{{ toast }}</p>
        </section>

        <!-- Rules -->
        <section class="glow-card rounded-2xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm min-w-[720px]">
              <thead>
                <tr class="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th class="px-4 py-3 font-semibold">Saham</th>
                  <th class="px-4 py-3 font-semibold">Sinyal</th>
                  <th class="px-4 py-3 text-right">Ambang</th>
                  <th class="px-4 py-3 text-center">Status</th>
                  <th class="px-4 py-3">Terakhir trigger</th>
                  <th class="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in rules" :key="r.id" class="border-b border-slate-900/70 hover:bg-slate-900/40" :class="{ 'opacity-40': r.active === false }">
                  <td class="px-4 py-3">
                    <NuxtLink v-if="r.code !== '*'" :to="`/analisa/${r.code}`" class="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded hover:bg-emerald-500/20">{{ r.code }}</NuxtLink>
                    <span v-else class="text-xs font-bold text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded">SEMUA (*)</span>
                  </td>
                  <td class="px-4 py-3 text-slate-200">{{ labelOf(r.type) }}</td>
                  <td class="px-4 py-3 text-right text-slate-300 tabular-nums">{{ r.value != null ? r.value.toLocaleString('id-ID') : '—' }}</td>
                  <td class="px-4 py-3 text-center">
                    <button type="button" class="text-[10px] font-bold px-2 py-1 rounded-full border" :class="r.active === false ? 'text-slate-400 bg-slate-800/60 border-slate-700' : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'" @click="toggleActive(r)">
                      {{ r.active === false ? 'Nonaktif' : 'Aktif' }}
                    </button>
                  </td>
                  <td class="px-4 py-3 text-xs" :class="r.lastTriggeredAt ? 'text-amber-300' : 'text-slate-500'">{{ r.lastTriggeredAt || 'belum pernah' }}</td>
                  <td class="px-4 py-3 text-right"><button type="button" class="text-[11px] text-rose-400 hover:text-rose-300" @click="removeRule(r.id)">✕</button></td>
                </tr>
                <tr v-if="!rules.length">
                  <td colspan="6" class="px-4 py-10 text-center text-sm text-slate-500">Belum ada rule. Tambahkan rule pertama di atas.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Dry run -->
        <section class="glow-card rounded-2xl p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-bold text-slate-100">Uji Evaluasi (dry-run)</h3>
              <p class="text-xs text-slate-400 mt-1">Jalankan semua rule vs snapshot hari ini — tanpa notifikasi &amp; tanpa menandai trigger.</p>
            </div>
            <button type="button" :disabled="dryRunning" class="px-4 py-2.5 rounded-xl text-sm font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/25 hover:bg-sky-500/20 disabled:opacity-40" @click="runDry">
              {{ dryRunning ? 'Mengevaluasi…' : '▶ Jalankan Uji' }}
            </button>
          </div>
          <div v-if="dryResult" class="mt-3 text-xs space-y-1">
            <p v-if="!dryResult.ok" class="text-amber-300">{{ dryResult.note }}</p>
            <template v-else>
              <p class="text-slate-400">Snapshot {{ dryResult.date }} · rule aktif dievaluasi: <strong class="text-slate-200">{{ dryResult.evaluatedRules }}</strong> · kena: <strong :class="dryResult.triggered ? 'text-emerald-400' : 'text-slate-200'">{{ dryResult.triggered }}</strong></p>
              <ul class="space-y-0.5 mt-1">
                <li v-for="(t, i) in dryResult.triggers" :key="i" class="text-slate-300">• {{ t.message }}</li>
              </ul>
              <p v-if="!dryResult.triggered" class="text-slate-500">Tidak ada kondisi yang terpenuhi hari ini.</p>
            </template>
          </div>
        </section>

        <!-- History -->
        <section class="glow-card rounded-2xl overflow-hidden">
          <h3 class="text-sm font-bold text-slate-100 px-4 pt-4">Histori Trigger</h3>
          <div class="overflow-x-auto mt-2">
            <table class="w-full text-sm min-w-[640px]">
              <thead>
                <tr class="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                  <th class="px-4 py-3 font-semibold">Tanggal</th>
                  <th class="px-4 py-3 font-semibold">Pesan</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in history" :key="h.id" class="border-b border-slate-900/70">
                  <td class="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{{ h.date }}</td>
                  <td class="px-4 py-3 text-slate-200">{{ h.message }}</td>
                </tr>
                <tr v-if="!history.length">
                  <td colspan="2" class="px-4 py-8 text-center text-sm text-slate-500">Belum ada trigger. Pasang cron <code class="text-emerald-400">/api/alerts/run</code> setelah sync.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

    </main>
  </div>
</template>
