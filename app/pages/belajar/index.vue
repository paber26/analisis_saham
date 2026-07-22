<script setup lang="ts">
import { computed, ref } from 'vue';

useHead({
  title: 'Belajar Terpandu Saham BEI — Jalur Pemula hingga Lanjutan',
  meta: [
    {
      name: 'description',
      content: 'Jalur belajar saham terstruktur: teori → praktik langsung di tool analisis nyata → kuis → progres tersimpan. Dari pemula hingga strategi lanjutan di Bursa Efek Indonesia.',
    },
  ],
});

interface Lesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  quiz?: unknown[];
}
interface Module { id: string; title: string; icon: string; lessons: Lesson[] }
interface Path {
  id: string; title: string; level: string; goal: string; icon: string;
  accent: string; modules: Module[];
}
interface Stats {
  totalLessons: number; completedLessons: number; percent: number;
  quizzesTaken: number; avgQuizPct: number; streak: number; lastLessonId: string | null;
}
interface Progress { completed: string[]; quiz: Record<string, { score: number; total: number }>; lastLessonId: string | null }

const { data, refresh } = await useFetch<{ paths: Path[]; progress: Progress; stats: Stats }>('/api/learning');

const { token, setToken, clearToken } = useAppToken();
const tokenInput = ref('');
function unlock() { setToken(tokenInput.value); tokenInput.value = ''; refresh(); }

const paths = computed(() => data.value?.paths ?? []);
const stats = computed<Stats>(() => data.value?.stats ?? { totalLessons: 0, completedLessons: 0, percent: 0, quizzesTaken: 0, avgQuizPct: 0, streak: 0, lastLessonId: null });
const completedSet = computed(() => new Set(data.value?.progress?.completed ?? []));

function isDone(id: string) { return completedSet.value.has(id); }
function pathLessons(p: Path) { return p.modules.flatMap((m) => m.lessons); }
function pathDone(p: Path) { return pathLessons(p).filter((l) => isDone(l.id)).length; }
function pathPct(p: Path) { const t = pathLessons(p).length; return t ? Math.round((pathDone(p) / t) * 100) : 0; }

// Static accent class maps (avoid dynamic Tailwind purge issues)
const ACCENT: Record<string, { text: string; bg: string; border: string; ring: string; bar: string }> = {
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', ring: 'text-emerald-400', bar: 'bg-emerald-500' },
  sky: { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/25', ring: 'text-sky-400', bar: 'bg-sky-500' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/25', ring: 'text-violet-400', bar: 'bg-violet-500' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25', ring: 'text-amber-400', bar: 'bg-amber-500' },
};
function accent(p: Path) { return ACCENT[p.accent] ?? ACCENT.emerald; }
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
    <!-- Header Banner -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 border border-slate-800 shadow-xl">
      <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            BELAJAR TERPANDU · LEARN BY DOING
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-50 tracking-tight">
            Jalur Belajar Saham BEI
          </h1>
          <p class="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
            Belajar bertahap: <span class="text-emerald-400 font-semibold">teori</span> →
            <span class="text-emerald-400 font-semibold">praktik langsung</span> di tool analisis nyata aplikasi ini →
            <span class="text-emerald-400 font-semibold">kuis</span>. Progres tersimpan otomatis.
          </p>
        </div>

        <!-- Continue learning -->
        <NuxtLink
          v-if="stats.lastLessonId"
          :to="`/belajar/${stats.lastLessonId}`"
          class="shrink-0 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
        >
          ▶ Lanjutkan Belajar
        </NuxtLink>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="glow-card rounded-2xl p-5">
        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Progres Total</div>
        <div class="mt-1 flex items-end gap-2">
          <span class="text-2xl font-extrabold text-emerald-400">{{ stats.percent }}%</span>
          <span class="text-xs text-slate-400 mb-1">{{ stats.completedLessons }}/{{ stats.totalLessons }} lesson</span>
        </div>
        <div class="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full bg-emerald-500 rounded-full transition-all" :style="{ width: stats.percent + '%' }"></div>
        </div>
      </div>
      <div class="glow-card rounded-2xl p-5">
        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kuis Dikerjakan</div>
        <div class="mt-1 text-2xl font-extrabold text-slate-100">{{ stats.quizzesTaken }}</div>
        <div class="text-xs text-slate-400">Rata-rata skor {{ stats.avgQuizPct }}%</div>
      </div>
      <div class="glow-card rounded-2xl p-5">
        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Streak Belajar</div>
        <div class="mt-1 text-2xl font-extrabold text-amber-400">🔥 {{ stats.streak }}</div>
        <div class="text-xs text-slate-400">hari berturut-turut</div>
      </div>
      <div class="glow-card rounded-2xl p-5 flex flex-col justify-between">
        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status Progres</div>
        <div v-if="token" class="mt-1">
          <div class="text-sm font-bold text-emerald-400">✓ Tersimpan</div>
          <button class="text-[11px] text-slate-500 hover:text-slate-300 mt-1" @click="clearToken(); refresh()">🔒 Kunci</button>
        </div>
        <div v-else class="mt-1 space-y-1.5">
          <div class="flex gap-1.5">
            <input v-model="tokenInput" type="password" placeholder="Token akses" class="min-w-0 flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" @keyup.enter="unlock" />
            <button class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg" @click="unlock">Buka</button>
          </div>
          <p class="text-[10px] text-slate-500">Buka kunci agar progres & kuis tersimpan.</p>
        </div>
      </div>
    </div>

    <!-- Lembar Kerja WMI shortcut -->
    <NuxtLink
      to="/belajar/lembar-kerja"
      class="block rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 to-slate-900/40 p-5 hover:border-amber-500/50 transition-all group"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-start gap-3">
          <span class="text-2xl">🧮</span>
          <div>
            <div class="text-sm font-bold text-amber-300">Lembar Kerja WMI (7 Kalkulator Ujian)</div>
            <p class="text-xs text-slate-400 mt-0.5 max-w-2xl leading-relaxed">
              Nilai waktu uang · valuasi saham (Gordon) · valuasi obligasi &amp; durasi · portofolio 2 aset · CAPM/SML · Sharpe/Treynor/Jensen · NAB reksa dana.
            </p>
          </div>
        </div>
        <span class="shrink-0 text-amber-400 text-xs font-bold group-hover:translate-x-0.5 transition-transform">Buka lembar kerja →</span>
      </div>
    </NuxtLink>

    <!-- Learning Paths -->
    <div class="space-y-6">
      <div
        v-for="p in paths"
        :key="p.id"
        class="rounded-2xl border bg-slate-900/60 backdrop-blur overflow-hidden"
        :class="accent(p).border"
      >
        <!-- Path header -->
        <div class="p-6 border-b border-slate-800/80">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="flex items-start gap-4">
              <div class="text-3xl leading-none">{{ p.icon }}</div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded-md" :class="[accent(p).bg, accent(p).text]">{{ p.level }}</span>
                </div>
                <h2 class="text-lg font-extrabold text-slate-50 mt-1.5">{{ p.title }}</h2>
                <p class="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">{{ p.goal }}</p>
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="text-2xl font-extrabold" :class="accent(p).text">{{ pathPct(p) }}%</div>
              <div class="text-[11px] text-slate-500">{{ pathDone(p) }}/{{ pathLessons(p).length }} selesai</div>
            </div>
          </div>
          <div class="mt-4 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all" :class="accent(p).bar" :style="{ width: pathPct(p) + '%' }"></div>
          </div>
        </div>

        <!-- Modules & lessons -->
        <div class="p-4 sm:p-6 space-y-5">
          <div v-for="mod in p.modules" :key="mod.id">
            <div class="flex items-center gap-2 mb-2 px-1">
              <span class="text-sm">{{ mod.icon }}</span>
              <h3 class="text-xs font-bold text-slate-300 uppercase tracking-wider">{{ mod.title }}</h3>
            </div>
            <div class="space-y-2">
              <NuxtLink
                v-for="lesson in mod.lessons"
                :key="lesson.id"
                :to="`/belajar/${lesson.id}`"
                class="flex items-center gap-3 p-3.5 rounded-xl border transition-all group"
                :class="isDone(lesson.id)
                  ? 'bg-slate-900/80 border-emerald-500/30'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'"
              >
                <!-- Completion check -->
                <span
                  class="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border"
                  :class="isDone(lesson.id)
                    ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                    : 'border-slate-700 text-slate-600'"
                >
                  {{ isDone(lesson.id) ? '✓' : '' }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors truncate">
                    {{ lesson.title }}
                  </div>
                  <div class="text-xs text-slate-500 truncate">{{ lesson.summary }}</div>
                </div>
                <div class="shrink-0 flex items-center gap-2 text-[11px] text-slate-500">
                  <span v-if="lesson.quiz && lesson.quiz.length" class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">📝 kuis</span>
                  <span>⏱ {{ lesson.minutes }}m</span>
                  <span class="text-slate-600 group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer link to library -->
    <div class="glow-card rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-sm font-bold text-slate-100">Butuh referensi lengkap atau ingin mencatat?</div>
        <p class="text-xs text-slate-400 mt-0.5">Semua materi juga tersedia di perpustakaan, tempat Anda bisa menambah catatan pribadi.</p>
      </div>
      <NuxtLink to="/edukasi" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors">
        📚 Buka Perpustakaan &amp; Catatan
      </NuxtLink>
    </div>
  </div>
</template>
