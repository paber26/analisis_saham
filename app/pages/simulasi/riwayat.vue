<script setup lang="ts">
import { ref, computed } from 'vue';
definePageMeta({ layout: 'simulasi' });
useHead({ title: 'Bank Pembelajaran — Riwayat Simulasi | Simulasi Lab' });

interface Summary { id: string; startDate: string; horizonDays: number; status: string; picks: string[]; totalReturnPct: number | null; alphaPct: number | null }
interface Rule { kind: 'do' | 'avoid' | 'neutral'; title: string; detail: string; samples: number; avgReturnPct: number }
interface Insights { sessions: number; settledSessions: number; totalDecisions: number; avgSessionReturnPct: number | null; rules: Rule[] }

const { data: sessData, refresh: refreshSessions } = await useFetch<{ sessions: Summary[] }>('/api/sim/sessions', { default: () => ({ sessions: [] }) });
const { data: insData } = await useFetch<Insights>('/api/sim/insights', { default: () => ({ sessions: 0, settledSessions: 0, totalDecisions: 0, avgSessionReturnPct: null, rules: [] }) });

const sessions = computed(() => sessData.value?.sessions ?? []);
const insights = computed(() => insData.value);

const fmtNum = (n: number | null | undefined, d = 1) => n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtPct = (n: number | null | undefined, d = 1) => n == null || !Number.isFinite(n) ? '—' : (n >= 0 ? '+' : '') + fmtNum(n, d) + '%';

const winners = computed(() => sessions.value.filter((s) => (s.totalReturnPct ?? 0) > 0).length);
const beatIhsg = computed(() => sessions.value.filter((s) => (s.alphaPct ?? 0) > 0).length);

const busy = ref('');
async function del(id: string) {
  if (import.meta.client && !window.confirm('Hapus sesi ini?')) return;
  busy.value = id;
  try { await $fetch(`/api/sim/session/${id}`, { method: 'DELETE' }); await refreshSessions(); } catch {} finally { busy.value = ''; }
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
    <div class="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 p-6 border border-cyan-500/15">
      <h1 class="text-2xl font-extrabold text-slate-50 tracking-tight">📚 Bank Pembelajaran</h1>
      <p class="text-sm text-slate-400 mt-1">Semua simulasi tersimpan &amp; pola yang dipelajari darinya.</p>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Sesi tersimpan</div><div class="text-2xl font-black text-cyan-300">{{ sessions.length }}</div></div>
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Sesi cuan</div><div class="text-2xl font-black text-emerald-400">{{ winners }}<span class="text-sm text-slate-500 font-bold">/{{ sessions.length }}</span></div></div>
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Mengalahkan IHSG</div><div class="text-2xl font-black text-emerald-400">{{ beatIhsg }}<span class="text-sm text-slate-500 font-bold">/{{ sessions.length }}</span></div></div>
      <div class="rounded-xl bg-slate-900/60 border border-slate-800 p-4"><div class="text-[10px] text-slate-500 uppercase font-bold">Rata-rata return/sesi</div><div class="text-2xl font-black" :class="(insights?.avgSessionReturnPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(insights?.avgSessionReturnPct) }}</div></div>
    </div>

    <!-- Insights -->
    <div v-if="insights?.rules?.length" class="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-3">
      <div class="text-sm font-bold text-slate-100">🧠 Aturan lakukan/hindari ({{ insights.settledSessions }} sesi · {{ insights.totalDecisions }} keputusan)</div>
      <div class="grid sm:grid-cols-2 gap-2">
        <div v-for="(r, i) in insights.rules" :key="i" class="rounded-xl border p-3" :class="r.kind === 'do' ? 'bg-emerald-500/5 border-emerald-500/20' : r.kind === 'avoid' ? 'bg-rose-500/5 border-rose-500/20' : 'bg-slate-800/40 border-slate-700'">
          <div class="text-xs font-bold flex items-center justify-between" :class="r.kind === 'do' ? 'text-emerald-300' : r.kind === 'avoid' ? 'text-rose-300' : 'text-slate-300'">
            <span>{{ r.kind === 'do' ? '✅' : r.kind === 'avoid' ? '⛔' : '•' }} {{ r.title }}</span>
            <span class="tabular-nums">{{ fmtPct(r.avgReturnPct) }}</span>
          </div>
          <div class="text-[11px] text-slate-400 mt-1">{{ r.detail }} <span class="text-slate-600">(n={{ r.samples }})</span></div>
        </div>
      </div>
    </div>

    <!-- Sessions grid -->
    <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-3">
      <div class="flex items-center justify-between"><h2 class="text-lg font-bold text-slate-100">Riwayat Simulasi</h2><span class="text-[11px] text-slate-500">{{ sessions.length }} sesi</span></div>
      <p v-if="!sessions.length" class="text-xs text-slate-500">Belum ada sesi. Jalankan simulasi lalu simpan.</p>
      <div v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <div v-for="s in sessions" :key="s.id" class="group rounded-xl bg-slate-950/60 border border-slate-800 hover:border-cyan-500/40 p-3.5 transition-colors">
          <div class="flex items-center justify-between gap-2">
            <span class="font-bold text-slate-100 text-sm">📅 {{ s.startDate }}</span>
            <div class="flex items-center gap-2">
              <span v-if="s.totalReturnPct != null" class="text-sm font-bold tabular-nums" :class="s.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'">{{ fmtPct(s.totalReturnPct) }}</span>
              <button @click="del(s.id)" :disabled="busy === s.id" title="Hapus" class="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-60 group-hover:opacity-100 transition-colors">🗑</button>
            </div>
          </div>
          <div v-if="s.alphaPct != null" class="mt-1"><span class="text-[10px] font-bold px-2 py-0.5 rounded-full border" :class="s.alphaPct >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'">{{ s.alphaPct >= 0 ? '🚀 +' : '🔻 ' }}{{ fmtNum(s.alphaPct, 1) }}% vs IHSG</span></div>
          <div class="text-[11px] text-slate-400 mt-1.5 truncate">{{ s.picks.join(' · ') }}</div>
          <div class="text-[10px] text-slate-600 mt-1 flex items-center justify-between">
            <span>horizon {{ s.horizonDays }} hari · {{ s.status }}</span>
            <NuxtLink :to="`/simulasi?review=${s.id}`" class="text-cyan-400 font-semibold hover:text-cyan-300">tinjau →</NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
