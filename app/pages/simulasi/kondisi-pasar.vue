<script setup lang="ts">
import { computed } from 'vue';
definePageMeta({ layout: 'simulasi' });
useHead({ title: 'Kondisi Pasar Bull vs Bear | Simulasi Lab' });

interface RegimePoint { date: string; close: number; ma20: number | null; ma50: number | null }
interface RegimeResponse {
  date: string; price: number; changePct: number; score: number; rating: string;
  sma20: number | null; sma50: number | null; sma200: number | null; rsi: number | null; adx: number | null;
  pctFromHigh: number; ret1m: number | null; ret3m: number | null; ret6m: number | null;
  aboveMa50: boolean; ma50AboveMa200: boolean; regime: 'bull' | 'bear' | 'sideways'; label: string;
  confidence: number; stance: { cutloss: string; note: string };
  action: { verdict: string; tone: 'emerald' | 'rose' | 'amber'; detail: string; allocation: string };
  series: RegimePoint[];
}

const date = useSimDate();
const today = new Date().toISOString().split('T')[0]!;
const openPicker = (e: MouseEvent) => { try { (e.currentTarget as HTMLInputElement).showPicker?.(); } catch { /* unsupported */ } };
const { data: reg, pending, error } = await useFetch<RegimeResponse>('/api/sim/regime', { query: { date }, watch: [date] });

const fmtNum = (n: number | null | undefined, d = 1) => n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (n: number | null | undefined, d = 1) => n == null || !Number.isFinite(n) ? '—' : (n >= 0 ? '+' : '') + fmtNum(n, d) + '%';

const regimeTheme = computed(() => {
  const r = reg.value?.regime;
  if (r === 'bull') return { bg: 'from-emerald-500/15 to-emerald-500/5', border: 'border-emerald-500/30', text: 'text-emerald-300', accent: 'text-emerald-400', emoji: '🐂', line: '#34d399' };
  if (r === 'bear') return { bg: 'from-rose-500/15 to-rose-500/5', border: 'border-rose-500/30', text: 'text-rose-300', accent: 'text-rose-400', emoji: '🐻', line: '#fb7185' };
  return { bg: 'from-amber-500/15 to-amber-500/5', border: 'border-amber-500/30', text: 'text-amber-300', accent: 'text-amber-400', emoji: '➡️', line: '#fbbf24' };
});

const actionTheme = computed(() => {
  const t = reg.value?.action?.tone;
  if (t === 'emerald') return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', emoji: '🟢' };
  if (t === 'rose') return { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-300', emoji: '🔴' };
  return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', emoji: '🟡' };
});

const chartOption = computed(() => {
  const s = reg.value?.series || [];
  return {
    grid: { left: 8, right: 12, top: 24, bottom: 24, containLabel: true },
    legend: { data: ['IHSG', 'MA20', 'MA50'], textStyle: { color: '#94a3b8', fontSize: 11 }, top: 0, right: 12 },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => (v == null ? '—' : Math.round(v).toLocaleString('id-ID')) },
    xAxis: { type: 'category', data: s.map((p) => p.date), axisLabel: { color: '#64748b', fontSize: 10, showMaxLabel: true }, axisLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: '#64748b', fontSize: 10, formatter: (v: number) => (v / 1000).toFixed(1) + 'k' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      { name: 'IHSG', type: 'line', data: s.map((p) => p.close), showSymbol: false, smooth: true, lineStyle: { width: 2.5, color: regimeTheme.value.line }, areaStyle: { color: 'rgba(56,189,248,0.06)' } },
      { name: 'MA20', type: 'line', data: s.map((p) => p.ma20), showSymbol: false, smooth: true, lineStyle: { width: 1.5, color: '#38bdf8' } },
      { name: 'MA50', type: 'line', data: s.map((p) => p.ma50), showSymbol: false, smooth: true, lineStyle: { width: 1.5, type: 'dashed', color: '#a78bfa' } }
    ]
  };
});
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
    <!-- Header + date -->
    <div class="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 p-6 border border-cyan-500/15">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-2xl font-extrabold text-slate-50 tracking-tight">🐂🐻 Kondisi Pasar — Bull vs Bear</h1>
          <p class="text-sm text-slate-400 mt-1">Posisi IHSG pada tanggal simulasi terpilih (dihitung dari data ≤ tanggal, tanpa lookahead).</p>
        </div>
        <label class="block">
          <span class="text-[11px] font-bold text-slate-500 uppercase">Tanggal simulasi</span>
          <input v-model="date" type="date" :max="today" @click="openPicker" class="mt-1 block bg-slate-950 border border-cyan-500/20 rounded-lg px-3 py-2 text-sm text-slate-100 cursor-pointer [color-scheme:dark]" />
        </label>
      </div>
    </div>

    <div v-if="error" class="rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm px-4 py-3">{{ (error as any)?.data?.statusMessage || 'Gagal memuat kondisi pasar' }}</div>
    <div v-else-if="pending" class="rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-sm px-4 py-6 text-center">Menghitung kondisi pasar…</div>

    <template v-else-if="reg">
      <!-- Regime hero -->
      <div class="rounded-2xl bg-gradient-to-br p-6 border" :class="[regimeTheme.bg, regimeTheme.border]">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-4">
            <div class="text-5xl">{{ regimeTheme.emoji }}</div>
            <div>
              <div class="text-2xl font-black" :class="regimeTheme.text">{{ reg.label }}</div>
              <div class="text-sm text-slate-400">IHSG {{ Math.round(reg.price).toLocaleString('id-ID') }} · <span :class="reg.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(reg.changePct) }}</span> hari itu · keyakinan {{ reg.confidence }}%</div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-[11px] text-slate-500 uppercase font-bold">Rekomendasi Cut-loss</div>
            <div class="text-lg font-extrabold" :class="regimeTheme.accent">{{ reg.stance.cutloss }}</div>
          </div>
        </div>
        <p class="text-xs text-slate-300/80 mt-3 leading-relaxed">{{ reg.stance.note }}</p>
      </div>

      <!-- Market-timing verdict: masuk / selektif / keluar -->
      <div v-if="reg.action" class="rounded-2xl p-5 border" :class="[actionTheme.bg, actionTheme.border]">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-3">
            <span class="text-3xl">{{ actionTheme.emoji }}</span>
            <div>
              <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Rekomendasi Aksi Pasar</div>
              <div class="text-xl font-black" :class="actionTheme.text">{{ reg.action.verdict }}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Saran alokasi</div>
            <div class="text-sm font-extrabold text-slate-100">{{ reg.action.allocation }}</div>
          </div>
        </div>
        <p class="text-xs text-slate-300/80 mt-2.5 leading-relaxed">{{ reg.action.detail }}</p>
      </div>

      <!-- Signals grid -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="text-[10px] text-slate-500 uppercase font-bold">Harga vs MA50</div>
          <div class="text-lg font-extrabold" :class="reg.aboveMa50 ? 'text-emerald-400' : 'text-rose-400'">{{ reg.aboveMa50 ? 'Di atas ▲' : 'Di bawah ▼' }}</div>
          <div class="text-[11px] text-slate-500">MA50 {{ reg.sma50 == null ? '—' : Math.round(reg.sma50).toLocaleString('id-ID') }}</div>
        </div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="text-[10px] text-slate-500 uppercase font-bold">Struktur MA50/MA200</div>
          <div class="text-lg font-extrabold" :class="reg.ma50AboveMa200 ? 'text-emerald-400' : 'text-rose-400'">{{ reg.ma50AboveMa200 ? 'Golden ✦' : 'Death ✕' }}</div>
          <div class="text-[11px] text-slate-500">MA200 {{ reg.sma200 == null ? '—' : Math.round(reg.sma200).toLocaleString('id-ID') }}</div>
        </div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="text-[10px] text-slate-500 uppercase font-bold">RSI · ADX</div>
          <div class="text-lg font-extrabold text-slate-100">{{ fmtNum(reg.rsi, 0) }} · {{ fmtNum(reg.adx, 0) }}</div>
          <div class="text-[11px] text-slate-500">momentum · kekuatan tren</div>
        </div>
        <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
          <div class="text-[10px] text-slate-500 uppercase font-bold">Dari puncak 52-mgg</div>
          <div class="text-lg font-extrabold" :class="reg.pctFromHigh > -10 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(reg.pctFromHigh) }}</div>
          <div class="text-[11px] text-slate-500">skor teknikal {{ fmtNum(reg.score, 0) }}</div>
        </div>
      </div>

      <!-- Momentum -->
      <div class="grid grid-cols-3 gap-3">
        <div v-for="m in [{ l: '1 Bulan', v: reg.ret1m }, { l: '3 Bulan', v: reg.ret3m }, { l: '6 Bulan', v: reg.ret6m }]" :key="m.l" class="rounded-xl bg-slate-900/60 border border-slate-800 p-4 text-center">
          <div class="text-[10px] text-slate-500 uppercase font-bold">Return IHSG {{ m.l }}</div>
          <div class="text-xl font-black" :class="(m.v ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(m.v) }}</div>
        </div>
      </div>

      <!-- Chart -->
      <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-4">
        <div class="text-sm font-bold text-slate-100 mb-2">IHSG &amp; Moving Average (≤ {{ reg.date }})</div>
        <div class="h-72"><VChart :option="chartOption" class="w-full h-full" autoresize /></div>
      </div>

      <!-- CTA -->
      <div class="rounded-2xl bg-cyan-500/5 border border-cyan-500/20 p-5 flex items-center justify-between flex-wrap gap-3">
        <p class="text-sm text-slate-300">Pakai konteks fase pasar ini untuk menyusun keranjang pada tanggal yang sama.</p>
        <NuxtLink to="/simulasi" class="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-colors">▶ Mulai Simulasi tanggal ini</NuxtLink>
      </div>
    </template>
  </div>
</template>
