<script setup lang="ts">
import { ref, computed, reactive, onBeforeUnmount, onMounted } from 'vue';

useHead({ title: 'Simulasi Mesin Waktu — Reksa Dana Masa Lampau | Saham IDX' });

// ---------------- Types (mirror server contracts) ----------------
interface AsOfRow {
  code: string; name: string; asOfDate: string; price: number; score: number;
  rating: 'Kuat' | 'Menarik' | 'Netral' | 'Lemah';
  rsi: number | null; rs3m: number | null; atrPct: number | null; volRatio: number | null;
  pctFromHigh: number; changePct: number;
}
interface PriceBar { date: string; open: number; high: number; low: number; close: number; volume: number }
interface BasketItem { code: string; name: string; entryPrice: number; rating: string; weightPct: number; lots: number }
interface Decision { date: string; code: string; action: 'HOLD' | 'SELL' | 'AVERAGE_DOWN'; lots: number; price: number; unrealizedPct: number; rating: string }

// ---------------- Wizard state ----------------
type Step = 'setup' | 'screen' | 'basket' | 'play' | 'result' | 'review';
const step = ref<Step>('setup');

const yearsAgoDate = (y: number) => { const d = new Date(); d.setFullYear(d.getFullYear() - y); return d.toISOString().split('T')[0]!; };
const monthsAgoDate = (m: number) => { const d = new Date(); d.setMonth(d.getMonth() - m); return d.toISOString().split('T')[0]!; };

const startDate = ref(yearsAgoDate(1));
const startDateInput = ref<HTMLInputElement | null>(null);
const horizonDays = ref(30);
const decisionEveryDays = ref(5);
const initialCapital = ref(100_000_000);

function openDatePicker() {
  try {
    startDateInput.value?.showPicker();
  } catch {
    /* fallback if showPicker is not supported */
  }
}

// ---------------- Formatters ----------------
const fmtIDR = (n: number) => 'Rp' + Math.round(n).toLocaleString('id-ID');
const fmtNum = (n: number | null, d = 1) => n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (n: number | null, d = 1) => n == null || !Number.isFinite(n) ? '—' : (n >= 0 ? '+' : '') + fmtNum(n, d) + '%';
const ratingClass = (r: string) => r === 'Kuat' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
  : r === 'Menarik' ? 'text-sky-400 bg-sky-500/10 border-sky-500/30'
  : r === 'Lemah' ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
  : 'text-slate-400 bg-slate-500/10 border-slate-600/30';

// ---------------- Step 1 → 2: load as-of screening ----------------
const screenRows = ref<AsOfRow[]>([]);
const selected = reactive(new Set<string>());
const loadingScreen = ref(false);
const errorMsg = ref('');

async function loadScreening() {
  errorMsg.value = '';
  loadingScreen.value = true;
  try {
    const res = await $fetch<{ results: AsOfRow[] }>('/api/sim/screen', { params: { date: startDate.value, limit: 60 } });
    screenRows.value = res.results;
    selected.clear();
    step.value = 'screen';
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage || e?.message || 'Gagal memuat screening';
  } finally {
    loadingScreen.value = false;
  }
}
function toggle(code: string) { selected.has(code) ? selected.delete(code) : selected.add(code); }
const ratingCounts = computed(() => {
  const c: Record<string, number> = { Kuat: 0, Menarik: 0, Netral: 0, Lemah: 0 };
  for (const r of screenRows.value) c[r.rating] = (c[r.rating] || 0) + 1;
  return c;
});

// ---------------- Step 2 → 3: compose basket ----------------
const basket = ref<BasketItem[]>([]);
function buildBasket() {
  const picks = screenRows.value.filter((r) => selected.has(r.code));
  const w = picks.length ? 100 / picks.length : 0;
  basket.value = picks.map((r) => ({ code: r.code, name: r.name, entryPrice: r.price, rating: r.rating, weightPct: Math.round(w * 10) / 10, lots: 0 }));
  recomputeLots();
  step.value = 'basket';
}
function recomputeLots() {
  for (const b of basket.value) {
    const alloc = initialCapital.value * (b.weightPct / 100);
    b.lots = Math.max(0, Math.floor(alloc / (b.entryPrice * 100)));
  }
}
const totalWeight = computed(() => basket.value.reduce((s, b) => s + b.weightPct, 0));
function equalizeWeights() {
  const n = basket.value.length; if (!n) return;
  const w = Math.round((100 / n) * 10) / 10;
  basket.value.forEach((b) => (b.weightPct = w));
  const last = basket.value[n - 1]!;
  last.weightPct = Math.round((last.weightPct + (100 - basket.value.reduce((s, b) => s + b.weightPct, 0))) * 10) / 10;
  recomputeLots();
}

// ---------------- Step 3 → 4: fetch prices + start playback ----------------
const closesByCode = reactive<Record<string, number[]>>({}); // aligned to timeline
const ihsgCloses = ref<number[]>([]);
const timeline = ref<string[]>([]);
const cursor = ref(0);
const playing = ref(false);
const speed = ref(4);
let timer: ReturnType<typeof setInterval> | null = null;

const positions = reactive<Record<string, { lots: number; avgPrice: number }>>({});
const cash = ref(0);
const decisions = ref<Decision[]>([]);
const equityCurve = ref<{ date: string; value: number }[]>([]);
const loadingPrices = ref(false);

function alignForwardFill(bars: PriceBar[], dates: string[]): number[] {
  const map = new Map(bars.map((b) => [b.date, b.close]));
  const out: number[] = [];
  let last = bars[0]?.close ?? 0;
  for (const d of dates) { if (map.has(d)) last = map.get(d)!; out.push(last); }
  return out;
}

function ihsgReturnPctAt(idx: number): number {
  if (!ihsgCloses.value.length || idx < 0 || idx >= ihsgCloses.value.length) return 0;
  const c0 = ihsgCloses.value[0];
  const cIdx = ihsgCloses.value[idx];
  if (!c0 || c0 <= 0 || cIdx == null) return 0;
  return ((cIdx / c0) - 1) * 100;
}

function ihsgEquityAt(idx: number): number {
  return initialCapital.value * (1 + ihsgReturnPctAt(idx) / 100);
}

async function startSimulation() {
  errorMsg.value = '';
  loadingPrices.value = true;
  try {
    const from = startDate.value;
    const end = new Date(startDate.value);
    end.setDate(end.getDate() + Math.ceil(horizonDays.value * 1.8) + 10); // enough calendar days for H trading days
    const to = end.toISOString().split('T')[0]!;
    const codes = basket.value.map((b) => b.code).join(',');
    const res = await $fetch<{ series: { code: string; bars: PriceBar[] }[]; ihsgSeries?: { code: string; bars: PriceBar[] } }>('/api/sim/prices', { params: { codes, from, to } });

    // Union of trading dates >= start, then take first (horizon+1) as the window.
    const dateSet = new Set<string>();
    for (const s of res.series) for (const b of s.bars) if (b.date >= from) dateSet.add(b.date);
    const allDates = Array.from(dateSet).sort();
    timeline.value = allDates.slice(0, horizonDays.value + 1);
    if (timeline.value.length < 2) { errorMsg.value = 'Data harga tidak cukup untuk periode ini.'; return; }

    for (const s of res.series) closesByCode[s.code] = alignForwardFill(s.bars, timeline.value);
    if (res.ihsgSeries?.bars?.length) {
      ihsgCloses.value = alignForwardFill(res.ihsgSeries.bars, timeline.value);
    } else {
      ihsgCloses.value = [];
    }

    // Set entry prices to the actual first-bar close on the timeline, recompute lots.
    for (const b of basket.value) { const c0 = closesByCode[b.code]?.[0]; if (c0) b.entryPrice = c0; }
    recomputeLots();

    // Open positions, leftover → cash.
    let spent = 0;
    for (const k of Object.keys(positions)) delete positions[k];
    for (const b of basket.value) { positions[b.code] = { lots: b.lots, avgPrice: b.entryPrice }; spent += b.lots * 100 * b.entryPrice; }
    cash.value = initialCapital.value - spent;
    decisions.value = [];
    cursor.value = 0;
    equityCurve.value = [{ date: timeline.value[0]!, value: valueAt(0) }];
    step.value = 'play';
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage || e?.message || 'Gagal memuat harga';
  } finally {
    loadingPrices.value = false;
  }
}

function priceAt(code: string, idx: number): number { return closesByCode[code]?.[idx] ?? 0; }
function valueAt(idx: number): number {
  let v = cash.value;
  for (const b of basket.value) { const p = positions[b.code]; if (p && p.lots > 0) v += p.lots * 100 * priceAt(b.code, idx); }
  return v;
}

// ---------------- Playback controls ----------------
function play() { if (playing.value || step.value !== 'play') return; playing.value = true; timer = setInterval(tick, Math.max(120, 1000 / speed.value)); }
function pause() { playing.value = false; if (timer) { clearInterval(timer); timer = null; } }
function tick() {
  if (cursor.value >= timeline.value.length - 1) { pause(); finish(); return; }
  cursor.value++;
  equityCurve.value.push({ date: timeline.value[cursor.value]!, value: valueAt(cursor.value) });
  const atEnd = cursor.value >= timeline.value.length - 1;
  if (!atEnd && cursor.value % decisionEveryDays.value === 0) { pause(); openDecision(); return; }
  if (atEnd) { pause(); finish(); }
}
function stepOnce() { if (step.value !== 'play') return; pause(); tick(); }
onBeforeUnmount(pause);

// ---------------- Decision gate ----------------
const decisionOpen = ref(false);
interface DecRow { code: string; name: string; price: number; avgPrice: number; plPct: number; lots: number; rating: string; action: 'HOLD' | 'SELL' | 'AVERAGE_DOWN'; avgDownLots: number }
const decisionRows = ref<DecRow[]>([]);

function getRecommendedAvgDownLots(code: string, currentPrice: number) {
  const b = basket.value.find((x) => x.code === code);
  const weightPct = b?.weightPct ?? (100 / (basket.value.length || 1));
  const budget = initialCapital.value * (weightPct / 100);
  const lotPrice = currentPrice * 100;
  const targetAdd = Math.max(1, Math.floor(budget / lotPrice));
  const maxAffordable = Math.floor(cash.value / lotPrice);
  return Math.min(targetAdd, maxAffordable);
}

function openDecision() {
  decisionRows.value = basket.value
    .filter((b) => (positions[b.code]?.lots ?? 0) > 0)
    .map((b) => {
      const p = positions[b.code]!;
      const price = priceAt(b.code, cursor.value);
      const rec = getRecommendedAvgDownLots(b.code, price);
      return {
        code: b.code,
        name: b.name,
        price,
        avgPrice: p.avgPrice,
        plPct: (price / p.avgPrice - 1) * 100,
        lots: p.lots,
        rating: b.rating,
        action: 'HOLD' as const,
        avgDownLots: rec
      };
    });
  decisionOpen.value = true;
}

function applyDecisions() {
  const date = timeline.value[cursor.value]!;
  for (const d of decisionRows.value) {
    const pos = positions[d.code]; if (!pos) continue;
    if (d.action === 'SELL' && pos.lots > 0) {
      cash.value += pos.lots * 100 * d.price;
      decisions.value.push({ date, code: d.code, action: 'SELL', lots: pos.lots, price: d.price, unrealizedPct: d.plPct, rating: d.rating });
      pos.lots = 0;
    } else if (d.action === 'AVERAGE_DOWN') {
      const requestedLots = Math.max(1, Number(d.avgDownLots) || 1);
      const maxAffordable = Math.floor(cash.value / (d.price * 100));
      const addLots = Math.min(requestedLots, maxAffordable);
      if (addLots > 0) {
        const cost = addLots * 100 * d.price;
        const newLots = pos.lots + addLots;
        pos.avgPrice = (pos.avgPrice * pos.lots + d.price * addLots) / newLots;
        pos.lots = newLots;
        cash.value -= cost;
        decisions.value.push({ date, code: d.code, action: 'AVERAGE_DOWN', lots: addLots, price: d.price, unrealizedPct: d.plPct, rating: d.rating });
      }
    } else {
      decisions.value.push({ date, code: d.code, action: 'HOLD', lots: 0, price: d.price, unrealizedPct: d.plPct, rating: d.rating });
    }
  }
  // Recompute equity at current cursor after trades.
  equityCurve.value[equityCurve.value.length - 1] = { date, value: valueAt(cursor.value) };
  decisionOpen.value = false;
  play(); // auto-resume
}

// ---------------- Finish → results + regression ----------------
const result = ref<null | {
  finalValue: number;
  totalReturnPct: number;
  ihsgReturnPct: number;
  alphaPct: number;
  maxDrawdownPct: number;
  winRate: number;
  realizedPnl: number;
  perStock: { code: string; returnPct: number; contributionPct: number }[];
}>(null);
const regression = ref<any>(null);
const loadingReg = ref(false);
const savedId = ref('');

async function finish() {
  const lastIdx = timeline.value.length - 1;
  const finalValue = valueAt(lastIdx);
  const totalReturnPct = (finalValue / initialCapital.value - 1) * 100;
  const ihsgReturnPct = ihsgReturnPctAt(lastIdx);
  const alphaPct = totalReturnPct - ihsgReturnPct;

  let peak = -Infinity, maxDd = 0;
  for (const e of equityCurve.value) { peak = Math.max(peak, e.value); maxDd = Math.min(maxDd, (e.value / peak - 1) * 100); }
  const perStock = basket.value.map((b) => {
    const finalPrice = priceAt(b.code, lastIdx);
    const returnPct = (finalPrice / b.entryPrice - 1) * 100;
    const contributionPct = (b.weightPct / 100) * returnPct;
    return { code: b.code, returnPct, contributionPct };
  });
  const winRate = perStock.length ? perStock.filter((s) => s.returnPct > 0).length / perStock.length * 100 : 0;
  result.value = {
    finalValue,
    totalReturnPct,
    ihsgReturnPct,
    alphaPct,
    maxDrawdownPct: maxDd,
    winRate,
    realizedPnl: finalValue - initialCapital.value,
    perStock
  };
  step.value = 'result';
  loadRegression();
}

// ---------------- Custom Modal Popup & Notification System ----------------
const confirmModal = reactive({
  open: false,
  title: '',
  message: '',
  confirmText: 'Ya, Lanjutkan',
  cancelText: 'Batal',
  type: 'danger' as 'danger' | 'warning' | 'info',
  onConfirm: () => {}
});

const notificationModal = reactive({
  open: false,
  title: '',
  message: '',
  type: 'info' as 'success' | 'error' | 'info'
});

let notifTimer: ReturnType<typeof setTimeout> | null = null;

function notify(message: string, type: 'success' | 'error' | 'info' = 'info', title?: string) {
  notificationModal.message = message;
  notificationModal.type = type;
  notificationModal.title = title || (type === 'error' ? '⚠️ PERINGATAN' : type === 'success' ? '✨ SUKSES' : 'ℹ️ INFORMASI');
  notificationModal.open = true;

  if (notifTimer) clearTimeout(notifTimer);
  notifTimer = setTimeout(() => {
    notificationModal.open = false;
  }, 4500);
}

function showConfirm(options: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
}) {
  confirmModal.title = options.title;
  confirmModal.message = options.message;
  confirmModal.confirmText = options.confirmText || 'Ya, Lanjutkan';
  confirmModal.cancelText = options.cancelText || 'Batal';
  confirmModal.type = options.type || 'danger';
  confirmModal.onConfirm = options.onConfirm;
  confirmModal.open = true;
}

function handleConfirmModal() {
  confirmModal.open = false;
  confirmModal.onConfirm();
}

function handleCancelModal() {
  confirmModal.open = false;
}

async function loadRegression() {
  loadingReg.value = true;
  try {
    regression.value = await $fetch('/api/sim/regression', { params: { date: startDate.value, horizon: horizonDays.value } });
  } catch { regression.value = null; } finally { loadingReg.value = false; }
}

async function saveSession() {
  if (!result.value) return;
  try {
    const body = {
      startDate: startDate.value, horizonDays: horizonDays.value, decisionEveryDays: decisionEveryDays.value,
      initialCapital: initialCapital.value,
      picks: basket.value.map((b) => ({ code: b.code, entryDate: timeline.value[0], entryPrice: b.entryPrice, lots: b.lots, weightPct: b.weightPct })),
      decisions: decisions.value,
      result: { endDate: timeline.value.at(-1), ...result.value, regression: regression.value?.regression ?? null },
      status: 'settled'
    };
    const res = await $fetch<{ id: string }>('/api/sim/session', { method: 'POST', body });
    savedId.value = res.id;
    loadInsights();
    loadSavedSessions();
    notify('Analisa sesi simulasi berhasil disimpan!', 'success');
  } catch (e: any) {
    const msg = e?.data?.statusMessage || e?.message || 'Gagal menyimpan sesi simulasi';
    errorMsg.value = msg;
    notify(msg, 'error');
  }
}

// ---------------- Insights + saved sessions ----------------
const insights = ref<any>(null);
async function loadInsights() { try { insights.value = await $fetch('/api/sim/insights'); } catch { insights.value = null; } }

// ---------------- Saved-session history + review ----------------
const savedSessions = ref<any[]>([]);
async function loadSavedSessions() { try { savedSessions.value = (await $fetch<{ sessions: any[] }>('/api/sim/sessions')).sessions; } catch { savedSessions.value = []; } }
const reviewData = ref<any>(null);
const actionLabel = (a: string) => (({ HOLD: 'Tahan', SELL: 'Jual', AVERAGE_DOWN: 'Avg Down', BUY: 'Beli' } as any)[a] || a);
async function openReview(id: string) {
  errorMsg.value = '';
  try {
    reviewData.value = await $fetch(`/api/sim/session/${id}`);
    step.value = 'review';
    if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    const msg = 'Gagal memuat sesi tersimpan';
    errorMsg.value = msg;
    notify(msg, 'error');
  }
}

function promptDeleteSession(id: string, dateStr?: string) {
  showConfirm({
    title: '🗑️ Hapus Sesi Simulasi',
    message: `Apakah kamu yakin ingin menghapus sesi simulasi ${dateStr ? 'tanggal ' + dateStr : ''}? Sesi yang dihapus tidak dapat dikembalikan.`,
    confirmText: 'Ya, Hapus Sesi',
    cancelText: 'Batal',
    type: 'danger',
    onConfirm: () => deleteSavedSession(id)
  });
}

async function deleteSavedSession(id: string) {
  try {
    await $fetch(`/api/sim/session/${id}`, { method: 'DELETE' });
    savedSessions.value = savedSessions.value.filter((s) => s.id !== id);
    if (reviewData.value?.id === id) reset();
    loadInsights();
    notify('Sesi simulasi telah berhasil dihapus.', 'success');
  } catch {
    const msg = 'Gagal menghapus sesi simulasi';
    errorMsg.value = msg;
    notify(msg, 'error');
  }
}

onMounted(() => { loadSavedSessions(); loadInsights(); });

function reset() { pause(); step.value = 'setup'; screenRows.value = []; selected.clear(); basket.value = []; result.value = null; regression.value = null; savedId.value = ''; reviewData.value = null; }

// ---------------- Equity chart option ----------------
const equityOption = computed(() => {
  const portData = equityCurve.value.map((e) => [e.date, Math.round(e.value)]);
  const ihsgData = equityCurve.value.map((e, idx) => [e.date, Math.round(ihsgEquityAt(idx))]);
  const base = initialCapital.value;
  return {
    grid: { left: 8, right: 12, top: 28, bottom: 24, containLabel: true },
    legend: { data: ['Portofolio', 'IHSG Benchmark'], textStyle: { color: '#94a3b8', fontSize: 11 }, top: 0, right: 12 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmtIDR(v) },
    xAxis: { type: 'category', data: equityCurve.value.map((e) => e.date), axisLabel: { color: '#64748b', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => (v / 1e6).toFixed(0) + 'jt' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      { name: 'Portofolio', type: 'line', data: portData, showSymbol: false, smooth: true, lineStyle: { width: 2.5, color: '#34d399' }, areaStyle: { color: 'rgba(52,211,153,0.12)' } },
      { name: 'IHSG Benchmark', type: 'line', data: ihsgData, showSymbol: false, smooth: true, lineStyle: { width: 2, type: 'dashed', color: '#38bdf8' } },
      { type: 'line', data: equityCurve.value.map((e) => [e.date, base]), showSymbol: false, lineStyle: { width: 1, type: 'dotted', color: '#475569' } }
    ]
  };
});

const currentValue = computed(() => equityCurve.value.at(-1)?.value ?? initialCapital.value);
const currentReturnPct = computed(() => (currentValue.value / initialCapital.value - 1) * 100);
const currentIhsgReturnPct = computed(() => ihsgReturnPctAt(cursor.value));
const currentAlphaPct = computed(() => currentReturnPct.value - currentIhsgReturnPct.value);
const progressPct = computed(() => timeline.value.length > 1 ? (cursor.value / (timeline.value.length - 1)) * 100 : 0);
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
    <!-- Header -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 border border-slate-800 shadow-xl">
      <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="relative z-10 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-2xl font-extrabold text-slate-50 tracking-tight">🕰️ Simulasi Mesin Waktu</h1>
          <p class="text-sm text-slate-400 mt-1">Racik reksa dana di masa lampau · putar waktunya · belajar dari keputusanmu.</p>
        </div>
        <div class="flex items-center gap-3">
          <NuxtLink to="/simulasi/panduan" class="text-[11px] font-semibold text-slate-400 hover:text-emerald-400 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">📘 Panduan cara kerja</NuxtLink>
          <button type="button" class="text-[11px] text-slate-500 hover:text-emerald-400" @click="reset">↺ Mulai ulang</button>
        </div>
      </div>
      <!-- Stepper -->
      <div class="relative z-10 flex items-center gap-2 mt-5 text-[11px] font-bold flex-wrap">
        <span v-for="(s, i) in ['setup','screen','basket','play','result']" :key="s"
          class="px-2.5 py-1 rounded-full border"
          :class="step === s ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900 text-slate-500 border-slate-800'">
          {{ i + 1 }}. {{ ({setup:'Setup',screen:'Screening',basket:'Racik',play:'Playback',result:'Hasil'} as any)[s] }}
        </span>
      </div>
    </div>

    <div v-if="errorMsg" class="rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm px-4 py-3">{{ errorMsg }}</div>

    <!-- STEP 1: SETUP -->
    <section v-if="step === 'setup'" class="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-5">
      <h2 class="text-lg font-bold text-slate-100">1 · Pilih Titik Waktu &amp; Parameter</h2>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <label class="block cursor-pointer">
          <span class="text-[11px] font-bold text-slate-500 uppercase">Tanggal Masuk (masa lalu)</span>
          <div class="relative mt-1">
            <input
              ref="startDateInput"
              v-model="startDate"
              type="date"
              :max="yearsAgoDate(0)"
              class="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-10 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 [color-scheme:dark] cursor-pointer"
              @click="openDatePicker"
            />
            <button
              type="button"
              @click="openDatePicker"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-400 text-sm p-1 rounded transition-colors"
              title="Buka Kalender"
            >
              📅
            </button>
          </div>
        </label>
        <label class="block">
          <span class="text-[11px] font-bold text-slate-500 uppercase">Horizon (hari bursa)</span>
          <input v-model.number="horizonDays" type="number" min="5" max="250" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        </label>
        <label class="block">
          <span class="text-[11px] font-bold text-slate-500 uppercase">Keputusan tiap (hari)</span>
          <input v-model.number="decisionEveryDays" type="number" min="1" max="60" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        </label>
        <label class="block">
          <span class="text-[11px] font-bold text-slate-500 uppercase">Modal awal (Rp)</span>
          <input v-model.number="initialCapital" type="number" step="1000000" class="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100" />
        </label>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[11px] text-slate-500 font-bold uppercase mr-1">Cepat:</span>
        <button v-for="p in [{l:'6 bln lalu',d:monthsAgoDate(6)},{l:'1 thn lalu',d:yearsAgoDate(1)},{l:'2 thn lalu',d:yearsAgoDate(2)},{l:'3 thn lalu',d:yearsAgoDate(3)}]" :key="p.l"
          @click="startDate = p.d" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700">{{ p.l }}</button>
      </div>
      <button @click="loadScreening" :disabled="loadingScreen" class="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl transition-colors">
        {{ loadingScreen ? 'Memuat screening…' : 'Lihat Screening pada tanggal ini →' }}
      </button>
      <p class="text-[11px] text-slate-500">Screening dihitung ulang dari harga ≤ tanggal itu (tanpa lookahead). Untuk universe penuh, load pertama bisa ~10–30 detik lalu di-cache.</p>
    </section>

    <!-- SAVED HISTORY (setup landing) -->
    <section v-if="step === 'setup'" class="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-slate-100">📚 Riwayat Simulasi Tersimpan</h2>
        <span class="text-[11px] text-slate-500">{{ savedSessions.length }} sesi</span>
      </div>
      <p v-if="!savedSessions.length" class="text-xs text-slate-500">Belum ada. Jalankan simulasi lalu tekan <span class="text-emerald-400 font-semibold">Simpan analisa</span> di akhir — sesi akan muncul di sini untuk kamu pelajari kembali.</p>
      <div v-else class="grid sm:grid-cols-2 gap-2">
        <div v-for="s in savedSessions" :key="s.id" @click="openReview(s.id)" role="button" tabindex="0"
          class="group text-left rounded-xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/40 p-3.5 transition-colors cursor-pointer">
          <div class="flex items-center justify-between gap-2">
            <span class="font-bold text-slate-100 text-sm">📅 {{ s.startDate }}</span>
            <div class="flex items-center gap-2">
              <span v-if="s.totalReturnPct != null" class="text-sm font-bold tabular-nums" :class="s.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(s.totalReturnPct) }}</span>
              <span v-if="s.alphaPct != null" class="text-[10px] font-bold px-2 py-0.5 rounded-full border" :class="s.alphaPct >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'">
                {{ s.alphaPct >= 0 ? '🚀 +' : '🔻 ' }}{{ fmtNum(s.alphaPct, 1) }}% vs IHSG
              </span>
              <button type="button" @click.stop="promptDeleteSession(s.id, s.startDate)" title="Hapus sesi"
                class="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-60 group-hover:opacity-100">🗑</button>
            </div>
          </div>
          <div class="text-[11px] text-slate-400 mt-1.5 truncate">{{ s.picks.join(' · ') }}</div>
          <div class="text-[10px] text-slate-600 mt-1 flex items-center justify-between">
            <span>horizon {{ s.horizonDays }} hari bursa · {{ s.status }}</span>
            <span class="text-emerald-400 font-semibold">tinjau →</span>
          </div>
        </div>
      </div>
    </section>

    <!-- STEP 2: SCREENING -->
    <section v-if="step === 'screen'" class="space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h2 class="text-lg font-bold text-slate-100">2 · Screening per {{ startDate }} <span class="text-sm text-slate-500 font-normal">— pilih beberapa saham ({{ selected.size }} terpilih)</span></h2>
        <div class="flex gap-2">
          <button @click="step = 'setup'" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300">← Ubah tanggal</button>
          <button @click="buildBasket" :disabled="selected.size === 0" class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold">Lanjut racik →</button>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap text-[11px]">
        <span class="text-slate-500 font-bold uppercase mr-1">Distribusi:</span>
        <span class="px-2 py-0.5 rounded-full border font-bold" :class="ratingClass('Kuat')">Kuat {{ ratingCounts.Kuat }}</span>
        <span class="px-2 py-0.5 rounded-full border font-bold" :class="ratingClass('Menarik')">Menarik {{ ratingCounts.Menarik }}</span>
        <span class="px-2 py-0.5 rounded-full border font-bold" :class="ratingClass('Netral')">Netral {{ ratingCounts.Netral }}</span>
        <span class="px-2 py-0.5 rounded-full border font-bold" :class="ratingClass('Lemah')">Lemah {{ ratingCounts.Lemah }}</span>
        <span class="text-slate-600 ml-1">dari {{ screenRows.length }} saham teratas</span>
      </div>
      <div class="rounded-xl border border-slate-800 overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider">
            <tr>
              <th class="px-3 py-3 text-left">Pilih</th><th class="px-3 py-3 text-left">Kode</th><th class="px-3 py-3 text-right">Harga</th>
              <th class="px-3 py-3 text-center">Rating</th><th class="px-3 py-3 text-right">Skor</th><th class="px-3 py-3 text-right">RS 3B</th>
              <th class="px-3 py-3 text-right">RSI</th><th class="px-3 py-3 text-right">Dari High</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/70 text-slate-300">
            <tr v-for="r in screenRows" :key="r.code" class="hover:bg-slate-900/40 cursor-pointer" :class="{ 'bg-emerald-500/5': selected.has(r.code) }" @click="toggle(r.code)">
              <td class="px-3 py-2.5"><input type="checkbox" :checked="selected.has(r.code)" class="accent-emerald-500 pointer-events-none" /></td>
              <td class="px-3 py-2.5"><span class="font-bold text-slate-100">{{ r.code }}</span><div class="text-[10px] text-slate-500 truncate max-w-[160px]">{{ r.name }}</div></td>
              <td class="px-3 py-2.5 text-right tabular-nums">{{ fmtIDR(r.price) }}</td>
              <td class="px-3 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full border text-[10px] font-bold" :class="ratingClass(r.rating)">{{ r.rating }}</span></td>
              <td class="px-3 py-2.5 text-right font-bold tabular-nums">{{ fmtNum(r.score, 0) }}</td>
              <td class="px-3 py-2.5 text-right tabular-nums" :class="(r.rs3m ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(r.rs3m) }}</td>
              <td class="px-3 py-2.5 text-right tabular-nums">{{ fmtNum(r.rsi, 0) }}</td>
              <td class="px-3 py-2.5 text-right tabular-nums text-slate-400">{{ fmtPct(r.pctFromHigh) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- STEP 3: BASKET -->
    <section v-if="step === 'basket'" class="space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h2 class="text-lg font-bold text-slate-100">3 · Racik Keranjang (Reksa Dana)</h2>
        <div class="flex gap-2">
          <button @click="step = 'screen'" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300">← Pilih saham</button>
          <button @click="equalizeWeights" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300" title="Ratakan bobot ke 100%">⚖ Bagi rata</button>
          <button @click="startSimulation" :disabled="loadingPrices || Math.abs(totalWeight - 100) > 0.5" class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 text-xs font-bold">{{ loadingPrices ? 'Memuat harga…' : 'Mulai simulasi ▶' }}</button>
        </div>
      </div>
      <div class="rounded-xl border border-slate-800 overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider">
            <tr><th class="px-4 py-3 text-left">Saham</th><th class="px-4 py-3 text-center">Rating</th><th class="px-4 py-3 text-right">Harga masuk</th><th class="px-4 py-3 text-right w-40">Bobot %</th><th class="px-4 py-3 text-right">Lot</th><th class="px-4 py-3 text-right">Alokasi</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-800/70 text-slate-300">
            <tr v-for="b in basket" :key="b.code">
              <td class="px-4 py-3"><span class="font-bold text-slate-100">{{ b.code }}</span><div class="text-[10px] text-slate-500 truncate max-w-[160px]">{{ b.name }}</div></td>
              <td class="px-4 py-3 text-center"><span class="px-2 py-0.5 rounded-full border text-[10px] font-bold" :class="ratingClass(b.rating)">{{ b.rating }}</span></td>
              <td class="px-4 py-3 text-right tabular-nums">{{ fmtIDR(b.entryPrice) }}</td>
              <td class="px-4 py-3 text-right"><input v-model.number="b.weightPct" @input="recomputeLots" type="number" min="0" max="100" class="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-slate-100" /></td>
              <td class="px-4 py-3 text-right font-bold tabular-nums">{{ b.lots }}</td>
              <td class="px-4 py-3 text-right tabular-nums text-slate-400">{{ fmtIDR(b.lots * 100 * b.entryPrice) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-slate-700 text-slate-400 font-bold"><td class="px-4 py-3">Total</td><td></td><td></td>
              <td class="px-4 py-3 text-right" :class="Math.abs(totalWeight - 100) > 0.5 ? 'text-rose-400' : 'text-emerald-400'">{{ fmtNum(totalWeight, 1) }}%</td><td></td>
              <td class="px-4 py-3 text-right">{{ fmtIDR(basket.reduce((s,b)=>s+b.lots*100*b.entryPrice,0)) }}</td></tr>
          </tfoot>
        </table>
      </div>
      <p v-if="Math.abs(totalWeight - 100) > 0.5" class="text-[11px] text-rose-400">Total bobot harus ≈ 100% (saat ini {{ fmtNum(totalWeight,1) }}%).</p>
    </section>

    <!-- STEP 4: PLAYBACK -->
    <section v-if="step === 'play'" class="space-y-4">
      <div class="grid lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <div class="text-[11px] text-slate-500 uppercase font-bold">Nilai Portofolio · {{ timeline[cursor] }}</div>
              <div class="text-2xl font-extrabold" :class="currentReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtIDR(currentValue) }} <span class="text-sm">({{ fmtPct(currentReturnPct) }})</span></div>
            </div>
            <div class="flex items-center gap-2.5">
              <div class="text-right bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5">
                <div class="text-[10px] text-slate-500 font-bold uppercase">Benchmark IHSG</div>
                <div class="text-xs font-bold text-sky-400">{{ fmtPct(currentIhsgReturnPct) }}</div>
              </div>
              <div class="text-right bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5">
                <div class="text-[10px] text-slate-500 font-bold uppercase">Alpha vs IHSG</div>
                <div class="text-xs font-extrabold" :class="currentAlphaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">
                  {{ currentAlphaPct >= 0 ? '🚀 +' : '🔻 ' }}{{ fmtNum(currentAlphaPct, 1) }}%
                </div>
              </div>
            </div>
          </div>
          <div class="h-64"><VChart :option="equityOption" class="w-full h-full" autoresize /></div>
          <!-- Progress + controls -->
          <div class="mt-3 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div class="h-full bg-emerald-500 transition-all" :style="{ width: progressPct + '%' }"></div></div>
          <div class="flex items-center gap-2 mt-3">
            <button v-if="!playing" @click="play" class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold">▶ Putar</button>
            <button v-else @click="pause" class="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm font-bold">⏸ Jeda</button>
            <button @click="stepOnce" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold">⏭ 1 hari</button>
            <div class="flex items-center gap-1 ml-auto text-[11px] text-slate-500">Kecepatan
              <select v-model.number="speed" class="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"><option :value="2">2×</option><option :value="4">4×</option><option :value="8">8×</option></select>
            </div>
          </div>
        </div>
        <!-- Holdings -->
        <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="text-[11px] text-slate-500 uppercase font-bold mb-2">Posisi</div>
          <div class="space-y-2">
            <div v-for="b in basket" :key="b.code" class="flex items-center justify-between text-xs bg-slate-950/60 rounded-lg px-3 py-2 border border-slate-800">
              <div><span class="font-bold text-slate-100">{{ b.code }}</span><div class="text-[10px] text-slate-500">{{ (positions[b.code]?.lots ?? 0) }} lot @ {{ fmtIDR(positions[b.code]?.avgPrice ?? b.entryPrice) }}</div></div>
              <div class="text-right tabular-nums">
                <div :class="(priceAt(b.code, cursor) / (positions[b.code]?.avgPrice || b.entryPrice) - 1) >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtIDR(priceAt(b.code, cursor)) }}</div>
                <div class="text-[10px]" :class="(priceAt(b.code, cursor) / (positions[b.code]?.avgPrice || b.entryPrice) - 1) >= 0 ? 'text-emerald-500' : 'text-rose-500'">{{ fmtPct((priceAt(b.code, cursor) / (positions[b.code]?.avgPrice || b.entryPrice) - 1) * 100) }}</div>
              </div>
            </div>
            <div class="flex items-center justify-between text-xs px-3 pt-1 text-slate-500"><span>Kas</span><span class="tabular-nums">{{ fmtIDR(cash) }}</span></div>
          </div>
        </div>
      </div>
    </section>

    <!-- DECISION MODAL -->
    <div v-if="decisionOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
      <div class="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-start justify-between gap-4 pb-2 border-b border-slate-800">
          <div>
            <h3 class="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>🤔 Titik Keputusan</span>
              <span class="text-xs px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">{{ timeline[cursor] }}</span>
            </h3>
            <p class="text-xs text-slate-400 mt-1">Pilih tindakan untuk masing-masing saham di portofolio kamu.</p>
          </div>
          <div class="text-right bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 shrink-0">
            <div class="text-[10px] text-slate-500 font-bold uppercase">Kas Tersedia</div>
            <div class="text-sm font-extrabold text-emerald-400">{{ fmtIDR(cash) }}</div>
          </div>
        </div>

        <div class="space-y-3">
          <div v-for="d in decisionRows" :key="d.code" class="rounded-xl bg-slate-950/60 border border-slate-800 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-extrabold text-slate-100 text-base">{{ d.code }}</span>
                <span class="ml-2 px-2 py-0.5 rounded-full border text-[10px] font-bold" :class="ratingClass(d.rating)">{{ d.rating }}</span>
                <span class="ml-2 text-xs text-slate-400">(Holding: <strong class="text-slate-200">{{ d.lots }} lot</strong> @ {{ fmtIDR(d.avgPrice) }})</span>
              </div>
              <div class="text-right text-xs tabular-nums">
                <span class="text-slate-300">{{ fmtIDR(d.price) }}</span>
                <span class="ml-2 font-bold" :class="d.plPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(d.plPct) }}</span>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <button @click="d.action = 'HOLD'" class="px-2 py-2 rounded-lg text-xs font-bold border transition-colors" :class="d.action === 'HOLD' ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">Tahan</button>
              <button @click="d.action = 'SELL'" class="px-2 py-2 rounded-lg text-xs font-bold border transition-colors" :class="d.action === 'SELL' ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">Jual</button>
              <button @click="d.action = 'AVERAGE_DOWN'" class="px-2 py-2 rounded-lg text-xs font-bold border transition-colors" :class="d.action === 'AVERAGE_DOWN' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'">Avg Down</button>
            </div>

            <!-- Detail Average Down Panel -->
            <div v-if="d.action === 'AVERAGE_DOWN'" class="p-3.5 rounded-xl bg-amber-500/[0.08] border border-amber-500/30 text-xs space-y-2.5">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <span class="font-bold text-amber-300 flex items-center gap-1.5">
                  <span>📥</span> Jumlah Lot Average Down:
                </span>
                <div class="flex items-center gap-2">
                  <input
                    v-model.number="d.avgDownLots"
                    type="number"
                    min="1"
                    :max="Math.max(1, Math.floor(cash / (d.price * 100)))"
                    class="w-20 bg-slate-950 border border-amber-500/50 rounded-lg px-2.5 py-1 text-right font-bold text-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <span class="font-bold text-amber-200">lot</span>
                </div>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded-lg border border-amber-500/20">
                <div>
                  <div class="text-slate-500">Biaya Pembelian</div>
                  <div class="font-bold text-slate-100 mt-0.5">{{ fmtIDR((d.avgDownLots || 0) * 100 * d.price) }}</div>
                </div>
                <div>
                  <div class="text-slate-500">Total Posisi Baru</div>
                  <div class="font-bold text-slate-100 mt-0.5">{{ d.lots + (d.avgDownLots || 0) }} lot</div>
                </div>
                <div>
                  <div class="text-slate-500">Avg Price Baru</div>
                  <div class="font-bold text-emerald-400 mt-0.5">Rp {{ Math.round((d.avgPrice * d.lots + d.price * (d.avgDownLots || 0)) / (d.lots + (d.avgDownLots || 0))).toLocaleString('id-ID') }}</div>
                </div>
                <div>
                  <div class="text-slate-500">Sisa Kas</div>
                  <div class="font-bold mt-0.5" :class="cash >= (d.avgDownLots || 0) * 100 * d.price ? 'text-slate-100' : 'text-rose-400'">{{ fmtIDR(cash - (d.avgDownLots || 0) * 100 * d.price) }}</div>
                </div>
              </div>

              <p v-if="cash < (d.avgDownLots || 0) * 100 * d.price" class="text-[11px] text-rose-400 font-semibold">
                ⚠️ Kas tidak mencukupi untuk membeli {{ d.avgDownLots }} lot (Maksimal yang dapat dibeli: {{ Math.floor(cash / (d.price * 100)) }} lot).
              </p>
            </div>

            <!-- Detail Jual Panel -->
            <div v-else-if="d.action === 'SELL'" class="p-3 rounded-xl bg-rose-500/[0.08] border border-rose-500/30 text-xs">
              <div class="flex items-center justify-between text-[11px] text-slate-300">
                <span>Jual seluruh posisi: <strong class="text-rose-300">{{ d.lots }} lot</strong> @ {{ fmtIDR(d.price) }}</span>
                <span>Hasil Penjualan: <strong class="text-emerald-400">+{{ fmtIDR(d.lots * 100 * d.price) }}</strong></span>
              </div>
            </div>
          </div>
        </div>

        <button @click="applyDecisions" class="w-full px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-emerald-500/20">
          Terapkan Keputusan &amp; Lanjutkan ▶
        </button>
      </div>
    </div>

    <!-- STEP 5: RESULT -->
    <section v-if="step === 'result' && result" class="space-y-5">
      <h2 class="text-lg font-bold text-slate-100">5 · Hasil &amp; Pembelajaran</h2>

      <!-- Benchmark Comparison Card -->
      <div class="rounded-2xl p-5 border overflow-hidden relative" :class="result.alphaPct >= 0 ? 'bg-emerald-500/[0.08] border-emerald-500/30' : 'bg-rose-500/[0.08] border-rose-500/30'">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xl">{{ result.alphaPct >= 0 ? '🚀' : '🔻' }}</span>
              <h3 class="text-base font-extrabold" :class="result.alphaPct >= 0 ? 'text-emerald-300' : 'text-rose-300'">
                {{ result.alphaPct >= 0 ? 'TERBUKTI MENGALAHKAN IHSG!' : 'DI BAWAH BENCHMARK IHSG' }}
              </h3>
            </div>
            <p class="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              <template v-if="result.alphaPct >= 0">
                Strategi kamu terbukti mengalahkan IHSG sebesar <strong class="text-emerald-400 font-bold">+{{ fmtNum(result.alphaPct, 1) }}%</strong>!
                <template v-if="result.totalReturnPct < 0">
                  Meskipun portofolio bernilai minus, penurunannya jauh lebih terkendali dibanding pasar IHSG yang turun lebih dalam.
                </template>
                <template v-else>
                  Portofolio kamu berhasil memaksimalkan tren naik melebihi kenaikan indeks pasar.
                </template>
              </template>
              <template v-else>
                Portofolio kamu tertinggal <strong class="text-rose-400 font-bold">{{ fmtNum(result.alphaPct, 1) }}%</strong> di bawah performa IHSG pada periode ini.
              </template>
            </p>
          </div>

          <div class="flex items-center gap-4 bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 shrink-0">
            <div>
              <div class="text-[10px] text-slate-500 font-bold uppercase">Portofolio Kamu</div>
              <div class="text-lg font-black" :class="result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(result.totalReturnPct) }}</div>
            </div>
            <div class="text-slate-600 font-extrabold text-lg">vs</div>
            <div>
              <div class="text-[10px] text-slate-500 font-bold uppercase">IHSG Index</div>
              <div class="text-lg font-black text-sky-400">{{ fmtPct(result.ihsgReturnPct) }}</div>
            </div>
            <div class="pl-3 border-l border-slate-800">
              <div class="text-[10px] text-slate-500 font-bold uppercase">Keunggulan (Alpha)</div>
              <div class="text-lg font-black" :class="result.alphaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ result.alphaPct >= 0 ? '+' : '' }}{{ fmtNum(result.alphaPct, 1) }}%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Metrics -->
      <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Return Portofolio</div><div class="text-xl font-extrabold" :class="result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(result.totalReturnPct) }}</div></div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Benchmark IHSG</div><div class="text-xl font-extrabold text-sky-400">{{ fmtPct(result.ihsgReturnPct) }}</div></div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Nilai Akhir</div><div class="text-xl font-extrabold text-slate-100">{{ fmtIDR(result.finalValue) }}</div></div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Max Drawdown</div><div class="text-xl font-extrabold text-rose-400">{{ fmtPct(result.maxDrawdownPct) }}</div></div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Win Rate</div><div class="text-xl font-extrabold text-slate-100">{{ fmtNum(result.winRate, 0) }}%</div></div>
      </div>

      <div class="h-56 rounded-2xl bg-slate-900/60 border border-slate-800 p-4"><VChart :option="equityOption" class="w-full h-full" autoresize /></div>

      <div class="grid lg:grid-cols-2 gap-4">
        <!-- Per stock -->
        <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="text-sm font-bold text-slate-100 mb-3">Kontribusi per Saham</div>
          <div class="space-y-2">
            <div v-for="s in result.perStock" :key="s.code" class="flex items-center justify-between text-xs">
              <span class="font-bold text-slate-200">{{ s.code }}</span>
              <div class="flex items-center gap-3 tabular-nums"><span :class="s.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(s.returnPct) }}</span><span class="text-slate-500 w-16 text-right">kontrib {{ fmtPct(s.contributionPct) }}</span></div>
            </div>
          </div>
        </div>
        <!-- Regression -->
        <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="text-sm font-bold text-slate-100 mb-1">📉 Regresi: apa yang mendorong return {{ horizonDays }} hari?</div>
          <div v-if="loadingReg" class="text-xs text-slate-500 py-4">Menghitung regresi universe…</div>
          <div v-else-if="regression?.regression" class="space-y-3">
            <div class="text-[11px] text-slate-400">n = {{ regression.n }} saham · R² = {{ fmtNum(regression.regression.r2 * 100, 1) }}% · adj-R² = {{ fmtNum(regression.regression.adjR2 * 100, 1) }}%</div>
            <table class="w-full text-[11px]">
              <thead class="text-slate-500 uppercase text-[10px]"><tr><th class="text-left py-1">Faktor</th><th class="text-right">Koef</th><th class="text-right">t</th><th class="text-right">p</th></tr></thead>
              <tbody class="text-slate-300">
                <tr v-for="t in regression.regression.terms" :key="t.name" class="border-t border-slate-800/60">
                  <td class="py-1.5 font-semibold">{{ t.name }}</td>
                  <td class="text-right tabular-nums" :class="t.coef >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtNum(t.coef, 3) }}</td>
                  <td class="text-right tabular-nums text-slate-400">{{ fmtNum(t.tStat, 2) }}</td>
                  <td class="text-right tabular-nums" :class="t.pValue < 0.05 ? 'text-emerald-400 font-bold' : 'text-slate-500'">{{ fmtNum(t.pValue, 3) }}</td>
                </tr>
              </tbody>
            </table>
            <div class="flex flex-wrap gap-2 pt-1">
              <span v-for="g in regression.byRating" :key="g.rating" class="text-[10px] px-2 py-1 rounded-lg border" :class="ratingClass(g.rating)">{{ g.rating }}: {{ fmtPct(g.avgReturnPct) }} (n={{ g.n }})</span>
            </div>
          </div>
          <div v-else class="text-xs text-slate-500 py-4">Regresi tidak tersedia untuk periode ini.</div>
        </div>
      </div>

      <!-- Save + insights -->
      <div class="flex items-center gap-3 flex-wrap">
        <button v-if="!savedId" @click="saveSession" class="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm">💾 Simpan analisa sesi ini</button>
        <span v-else class="text-emerald-400 text-sm font-semibold">✓ Tersimpan ({{ savedId }})</span>
        <button @click="reset" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm">↺ Simulasi baru</button>
      </div>

      <!-- Meta insights -->
      <div v-if="insights" class="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-3">
        <div class="text-sm font-bold text-slate-100">🧠 Pembelajaran lintas sesi ({{ insights.settledSessions }} sesi · {{ insights.totalDecisions }} keputusan)</div>
        <div v-if="insights.rules?.length" class="grid sm:grid-cols-2 gap-2">
          <div v-for="(r, i) in insights.rules" :key="i" class="rounded-xl border p-3" :class="r.kind === 'do' ? 'bg-emerald-500/5 border-emerald-500/20' : r.kind === 'avoid' ? 'bg-rose-500/5 border-rose-500/20' : 'bg-slate-800/40 border-slate-700'">
            <div class="text-xs font-bold" :class="r.kind === 'do' ? 'text-emerald-300' : r.kind === 'avoid' ? 'text-rose-300' : 'text-slate-300'">{{ r.kind === 'do' ? '✅' : r.kind === 'avoid' ? '⛔' : '•' }} {{ r.title }}</div>
            <div class="text-[11px] text-slate-400 mt-1">{{ r.detail }} <span class="text-slate-600">(n={{ r.samples }})</span></div>
          </div>
        </div>
        <p v-else class="text-xs text-slate-500">Belum cukup data. Jalankan &amp; simpan beberapa sesi lagi untuk memunculkan pola lakukan/hindari.</p>
      </div>
    </section>

    <!-- REVIEW: tinjau sesi tersimpan -->
    <section v-if="step === 'review' && reviewData" class="space-y-5">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h2 class="text-lg font-bold text-slate-100">📖 Tinjau Sesi · {{ reviewData.startDate }} <span class="text-sm text-slate-500 font-normal">(horizon {{ reviewData.horizonDays }} hari)</span></h2>
        <div class="flex items-center gap-2">
          <button @click="deleteSavedSession(reviewData.id)" class="px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold">🗑 Hapus</button>
          <button @click="reset" class="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300">← Kembali ke daftar</button>
        </div>
      </div>

      <div v-if="reviewData.result" class="space-y-4">
        <div v-if="reviewData.result.alphaPct != null" class="rounded-2xl p-4 border flex items-center justify-between flex-wrap gap-3" :class="reviewData.result.alphaPct >= 0 ? 'bg-emerald-500/[0.08] border-emerald-500/30' : 'bg-rose-500/[0.08] border-rose-500/30'">
          <div class="flex items-center gap-2">
            <span class="text-base">{{ reviewData.result.alphaPct >= 0 ? '🚀' : '🔻' }}</span>
            <span class="font-extrabold text-sm" :class="reviewData.result.alphaPct >= 0 ? 'text-emerald-300' : 'text-rose-300'">
              {{ reviewData.result.alphaPct >= 0 ? 'MENGALAHKAN BENCHMARK IHSG' : 'DI BAWAH BENCHMARK IHSG' }}
            </span>
          </div>
          <div class="text-xs font-bold" :class="reviewData.result.alphaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">
            Alpha: {{ reviewData.result.alphaPct >= 0 ? '+' : '' }}{{ fmtNum(reviewData.result.alphaPct, 1) }}% vs IHSG
          </div>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Return Total</div><div class="text-xl font-extrabold" :class="reviewData.result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(reviewData.result.totalReturnPct) }}</div></div>
          <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Benchmark IHSG</div><div class="text-xl font-extrabold text-sky-400">{{ fmtPct(reviewData.result.ihsgReturnPct ?? null) }}</div></div>
          <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Nilai Akhir</div><div class="text-xl font-extrabold text-slate-100">{{ fmtIDR(reviewData.result.finalValue) }}</div></div>
          <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Max Drawdown</div><div class="text-xl font-extrabold text-rose-400">{{ fmtPct(reviewData.result.maxDrawdownPct) }}</div></div>
          <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Win Rate</div><div class="text-xl font-extrabold text-slate-100">{{ fmtNum(reviewData.result.winRate, 0) }}%</div></div>
        </div>
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        <!-- Keranjang + kontribusi -->
        <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="text-sm font-bold text-slate-100 mb-3">Keranjang &amp; Kontribusi</div>
          <div class="space-y-2">
            <div v-for="p in reviewData.picks" :key="p.code" class="flex items-center justify-between text-xs">
              <div><span class="font-bold text-slate-200">{{ p.code }}</span><span class="text-slate-500 ml-2">{{ p.lots }} lot @ {{ fmtIDR(p.entryPrice) }}</span></div>
              <div class="tabular-nums text-slate-500">bobot {{ fmtNum(p.weightPct, 0) }}%</div>
            </div>
            <div v-if="reviewData.result?.perStock" class="pt-2 mt-1 border-t border-slate-800 space-y-1.5">
              <div v-for="s in reviewData.result.perStock" :key="s.code" class="flex items-center justify-between text-xs">
                <span class="font-semibold text-slate-300">{{ s.code }}</span>
                <div class="flex items-center gap-3 tabular-nums"><span :class="s.returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(s.returnPct) }}</span><span class="text-slate-500 w-20 text-right">kontrib {{ fmtPct(s.contributionPct) }}</span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Jejak keputusan -->
        <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="text-sm font-bold text-slate-100 mb-3">Jejak Keputusan</div>
          <div v-if="reviewData.decisions?.length" class="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            <div v-for="(d, i) in reviewData.decisions" :key="i" class="flex items-center justify-between text-xs bg-slate-950/60 rounded-lg px-3 py-2 border border-slate-800">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-slate-500 tabular-nums shrink-0">{{ d.date }}</span>
                <span class="font-bold text-slate-200 shrink-0">{{ d.code }}</span>
                <span class="px-1.5 py-0.5 rounded-full border text-[10px] font-bold shrink-0" :class="ratingClass(d.rating)">{{ d.rating }}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold" :class="d.action === 'SELL' ? 'bg-rose-500/15 text-rose-300' : d.action === 'AVERAGE_DOWN' ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-700 text-slate-300'">{{ actionLabel(d.action) }}</span>
                <span class="tabular-nums" :class="d.unrealizedPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(d.unrealizedPct) }}</span>
              </div>
            </div>
          </div>
          <p v-else class="text-xs text-slate-500">Tidak ada keputusan tercatat (semua ditahan otomatis).</p>
        </div>
      </div>

      <!-- Regresi tersimpan -->
      <div v-if="reviewData.result?.regression" class="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
        <div class="text-sm font-bold text-slate-100 mb-1">📉 Regresi faktor (tersimpan)</div>
        <div class="text-[11px] text-slate-400 mb-2">n = {{ reviewData.result.regression.n }} · R² = {{ fmtNum(reviewData.result.regression.r2 * 100, 1) }}% · adj-R² = {{ fmtNum(reviewData.result.regression.adjR2 * 100, 1) }}%</div>
        <table class="w-full text-[11px]">
          <thead class="text-slate-500 uppercase text-[10px]"><tr><th class="text-left py-1">Faktor</th><th class="text-right">Koef</th><th class="text-right">t</th><th class="text-right">p</th></tr></thead>
          <tbody class="text-slate-300">
            <tr v-for="t in reviewData.result.regression.terms" :key="t.name" class="border-t border-slate-800/60">
              <td class="py-1.5 font-semibold">{{ t.name }}</td>
              <td class="text-right tabular-nums" :class="t.coef >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtNum(t.coef, 3) }}</td>
              <td class="text-right tabular-nums text-slate-400">{{ fmtNum(t.tStat, 2) }}</td>
              <td class="text-right tabular-nums" :class="t.pValue < 0.05 ? 'text-emerald-400 font-bold' : 'text-slate-500'">{{ fmtNum(t.pValue, 3) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button @click="reset" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm">← Kembali ke daftar</button>
    </section>

    <!-- CUSTOM CONFIRMATION POPUP MODAL -->
    <div v-if="confirmModal.open" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md transition-all">
      <div class="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4 text-center transform transition-all scale-100">
        <div class="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-inner"
          :class="confirmModal.type === 'danger' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'">
          <span class="text-2xl">{{ confirmModal.type === 'danger' ? '🗑️' : '⚠️' }}</span>
        </div>

        <div>
          <h3 class="text-base font-extrabold text-slate-100">{{ confirmModal.title }}</h3>
          <p class="text-xs text-slate-400 mt-2 leading-relaxed">{{ confirmModal.message }}</p>
        </div>

        <div class="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            @click="handleCancelModal"
            class="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
          >
            {{ confirmModal.cancelText }}
          </button>
          <button
            type="button"
            @click="handleConfirmModal"
            class="w-full px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg"
            :class="confirmModal.type === 'danger' ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20' : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20'"
          >
            {{ confirmModal.confirmText }}
          </button>
        </div>
      </div>
    </div>

    <!-- CUSTOM TOAST NOTIFICATION POPUP -->
    <div v-if="notificationModal.open" class="fixed top-5 right-5 z-[100] max-w-sm w-full animate-bounce-once">
      <div class="rounded-2xl p-4 border shadow-2xl backdrop-blur-md flex items-start justify-between gap-3"
        :class="notificationModal.type === 'error' ? 'bg-rose-950/90 border-rose-500/40 text-rose-200' : notificationModal.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200' : 'bg-slate-900/90 border-slate-700 text-slate-200'">
        <div class="flex items-start gap-3">
          <span class="text-lg shrink-0">{{ notificationModal.type === 'error' ? '❌' : notificationModal.type === 'success' ? '✨' : 'ℹ️' }}</span>
          <div>
            <h4 class="text-xs font-extrabold tracking-wide uppercase">{{ notificationModal.title }}</h4>
            <p class="text-xs mt-0.5 opacity-90 leading-relaxed">{{ notificationModal.message }}</p>
          </div>
        </div>
        <button type="button" @click="notificationModal.open = false" class="text-xs opacity-60 hover:opacity-100 p-1">✕</button>
      </div>
    </div>
  </div>
</template>
