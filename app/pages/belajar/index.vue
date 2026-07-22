<script setup lang="ts">
import { computed } from 'vue';

definePageMeta({ layout: 'learning' });

useHead({
  title: 'Pusat Belajar — LMS Saham, WMI, CFA, CTA & CSA',
  meta: [
    {
      name: 'description',
      content: 'Learning Management System investasi: program Fondasi Saham BEI, sertifikasi WMI, CFA Level I, CTA (teknikal), dan CSA (analis efek) — belajar terstruktur dengan praktik di tool analisis nyata.',
    },
  ],
});

interface Lesson { id: string; quiz?: unknown[] }
interface Module { id: string; lessons: Lesson[] }
interface Path { id: string; modules: Module[] }
interface Program {
  id: string; title: string; short: string; category: 'Fondasi' | 'Sertifikasi';
  provider: string; icon: string; accent: string; blurb: string;
  status: 'aktif' | 'pengembangan'; paths: Path[];
}
interface Stats { totalLessons: number; completedLessons: number; percent: number; quizzesTaken: number; avgQuizPct: number; streak: number; lastLessonId: string | null }

const { data } = await useFetch<{ programs: Program[]; progress: { completed: string[] }; stats: Stats }>('/api/learning');

const programs = computed(() => data.value?.programs ?? []);
const stats = computed<Stats>(() => data.value?.stats ?? { totalLessons: 0, completedLessons: 0, percent: 0, quizzesTaken: 0, avgQuizPct: 0, streak: 0, lastLessonId: null });
const done = computed(() => new Set(data.value?.progress?.completed ?? []));

const fondasi = computed(() => programs.value.filter((p) => p.category === 'Fondasi'));
const sertifikasi = computed(() => programs.value.filter((p) => p.category === 'Sertifikasi'));

function lessonsOf(p: Program) { return p.paths.flatMap((path) => path.modules.flatMap((m) => m.lessons)); }
function pDone(p: Program) { return lessonsOf(p).filter((l) => done.value.has(l.id)).length; }
function pTotal(p: Program) { return lessonsOf(p).length; }
function pPct(p: Program) { const t = pTotal(p); return t ? Math.round((pDone(p) / t) * 100) : 0; }

const ACCENT: Record<string, { text: string; border: string; bar: string; soft: string }> = {
  emerald: { text: 'text-emerald-400', border: 'border-emerald-500/25', bar: 'bg-emerald-500', soft: 'bg-emerald-500/10' },
  amber: { text: 'text-amber-400', border: 'border-amber-500/25', bar: 'bg-amber-500', soft: 'bg-amber-500/10' },
  sky: { text: 'text-sky-400', border: 'border-sky-500/25', bar: 'bg-sky-500', soft: 'bg-sky-500/10' },
  violet: { text: 'text-violet-400', border: 'border-violet-500/25', bar: 'bg-violet-500', soft: 'bg-violet-500/10' },
  rose: { text: 'text-rose-400', border: 'border-rose-500/25', bar: 'bg-rose-500', soft: 'bg-rose-500/10' },
};
function ac(p: Program) { return ACCENT[p.accent] ?? ACCENT.emerald; }
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
    <!-- Hero -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-950 p-6 sm:p-8 border border-indigo-500/20 shadow-xl">
      <div class="absolute -right-10 -bottom-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3">
            <span class="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
            PUSAT BELAJAR · LEARNING MANAGEMENT SYSTEM
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-50 tracking-tight">Selamat datang di Pusat Belajar</h1>
          <p class="text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
            Ruang belajar terpisah dari dashboard analisis. Pilih sebuah <span class="text-indigo-300 font-semibold">program</span> — dari Fondasi Saham hingga sertifikasi profesi — lalu belajar bertahap dengan praktik langsung di tool analisis nyata.
          </p>
        </div>
        <NuxtLink v-if="stats.lastLessonId" :to="`/belajar/${stats.lastLessonId}`"
          class="shrink-0 px-5 py-3 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
          ▶ Lanjutkan Belajar
        </NuxtLink>
      </div>
      <div class="relative z-10 grid grid-cols-3 gap-3 mt-6 max-w-md">
        <div class="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
          <div class="text-lg font-extrabold text-indigo-300">{{ stats.percent }}%</div>
          <div class="text-[10px] text-slate-500">{{ stats.completedLessons }}/{{ stats.totalLessons }} lesson</div>
        </div>
        <div class="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
          <div class="text-lg font-extrabold text-slate-100">{{ stats.quizzesTaken }}</div>
          <div class="text-[10px] text-slate-500">kuis · avg {{ stats.avgQuizPct }}%</div>
        </div>
        <div class="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
          <div class="text-lg font-extrabold text-amber-400">🔥 {{ stats.streak }}</div>
          <div class="text-[10px] text-slate-500">hari streak</div>
        </div>
      </div>
    </div>

    <!-- Fondasi -->
    <section class="space-y-3">
      <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">🌱 Program Fondasi</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <NuxtLink v-for="p in fondasi" :key="p.id" :to="`/belajar/program/${p.id}`"
          class="block rounded-2xl border bg-slate-900/60 backdrop-blur p-5 hover:-translate-y-0.5 transition-all group" :class="ac(p).border">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3 min-w-0">
              <span class="text-2xl shrink-0">{{ p.icon }}</span>
              <div class="min-w-0">
                <h3 class="text-base font-bold text-slate-50 group-hover:text-indigo-300 transition-colors">{{ p.title }}</h3>
                <p class="text-[11px] text-slate-500">{{ p.provider }}</p>
              </div>
            </div>
            <span class="text-lg font-extrabold shrink-0" :class="ac(p).text">{{ pPct(p) }}%</span>
          </div>
          <p class="text-xs text-slate-400 mt-3 leading-relaxed">{{ p.blurb }}</p>
          <div class="mt-4 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all" :class="ac(p).bar" :style="{ width: pPct(p) + '%' }"></div>
          </div>
          <div class="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{{ pDone(p) }}/{{ pTotal(p) }} lesson selesai</span>
            <span :class="ac(p).text" class="font-bold">Buka program →</span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- Sertifikasi -->
    <section class="space-y-3">
      <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">🏅 Program Sertifikasi</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink v-for="p in sertifikasi" :key="p.id" :to="`/belajar/program/${p.id}`"
          class="block rounded-2xl border bg-slate-900/60 backdrop-blur p-5 hover:-translate-y-0.5 transition-all group relative" :class="ac(p).border">
          <span v-if="p.status === 'pengembangan'" class="absolute top-3 right-3 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">DIKEMBANGKAN</span>
          <div class="flex items-start gap-3">
            <span class="text-2xl shrink-0">{{ p.icon }}</span>
            <div class="min-w-0">
              <h3 class="text-sm font-bold text-slate-50 group-hover:text-indigo-300 transition-colors leading-snug">{{ p.short }}</h3>
              <p class="text-[11px] text-slate-500">{{ p.provider }}</p>
            </div>
          </div>
          <p class="text-xs text-slate-400 mt-3 leading-relaxed line-clamp-3">{{ p.blurb }}</p>
          <div class="mt-4 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all" :class="ac(p).bar" :style="{ width: pPct(p) + '%' }"></div>
          </div>
          <div class="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{{ pDone(p) }}/{{ pTotal(p) }} lesson</span>
            <span :class="ac(p).text" class="font-bold">{{ pPct(p) }}%</span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- Add-your-own-material info -->
    <section class="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/5 to-slate-900/40 p-5">
      <div class="flex items-start gap-3">
        <span class="text-2xl">📥</span>
        <div>
          <h3 class="text-sm font-bold text-indigo-200">Menambah materi Anda sendiri</h3>
          <p class="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Punya makalah, catatan, atau PDF pembelajaran yang belum ada di sini? Berikan garis besarnya (atau file-nya) kepada asisten — akan dirangkum dan dimasukkan sebagai lesson ke dalam program yang sesuai. Materi baru langsung muncul di LMS setelah diperbarui.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>
