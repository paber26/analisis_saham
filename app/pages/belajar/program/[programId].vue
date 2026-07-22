<script setup lang="ts">
import { computed } from 'vue';

definePageMeta({ layout: 'learning' });

interface Lesson { id: string; title: string; summary: string; minutes: number; quiz?: unknown[] }
interface Module { id: string; title: string; icon: string; lessons: Lesson[] }
interface Path { id: string; title: string; level: string; goal: string; icon: string; modules: Module[] }
interface Program {
  id: string; title: string; short: string; category: string; provider: string;
  icon: string; accent: string; blurb: string; status: string; paths: Path[];
}

const route = useRoute();
const programId = computed(() => String(route.params.programId));

const { data } = await useFetch<{ programs: Program[]; progress: { completed: string[] } }>('/api/learning');
const program = computed(() => (data.value?.programs ?? []).find((p) => p.id === programId.value) ?? null);
const done = computed(() => new Set(data.value?.progress?.completed ?? []));

useHead(() => ({ title: program.value ? `${program.value.title} — Pusat Belajar` : 'Program — Pusat Belajar' }));

function isDone(id: string) { return done.value.has(id); }
const allLessons = computed(() => (program.value?.paths ?? []).flatMap((p) => p.modules.flatMap((m) => m.lessons)));
const doneCount = computed(() => allLessons.value.filter((l) => isDone(l.id)).length);
const pct = computed(() => (allLessons.value.length ? Math.round((doneCount.value / allLessons.value.length) * 100) : 0));
const multiPath = computed(() => (program.value?.paths.length ?? 0) > 1);

const ACCENT: Record<string, { text: string; border: string; bar: string; soft: string }> = {
  emerald: { text: 'text-emerald-400', border: 'border-emerald-500/25', bar: 'bg-emerald-500', soft: 'bg-emerald-500/10' },
  amber: { text: 'text-amber-400', border: 'border-amber-500/25', bar: 'bg-amber-500', soft: 'bg-amber-500/10' },
  sky: { text: 'text-sky-400', border: 'border-sky-500/25', bar: 'bg-sky-500', soft: 'bg-sky-500/10' },
  violet: { text: 'text-violet-400', border: 'border-violet-500/25', bar: 'bg-violet-500', soft: 'bg-violet-500/10' },
  rose: { text: 'text-rose-400', border: 'border-rose-500/25', bar: 'bg-rose-500', soft: 'bg-rose-500/10' },
};
const ac = computed(() => ACCENT[program.value?.accent ?? 'emerald'] ?? ACCENT.emerald);
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
    <template v-if="program">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-1.5 text-xs text-slate-500">
        <NuxtLink to="/belajar" class="hover:text-indigo-300 font-semibold">🏠 Beranda Belajar</NuxtLink>
        <span class="text-slate-700">/</span>
        <span class="text-slate-300">{{ program.icon }} {{ program.short }}</span>
      </div>

      <!-- Program header -->
      <div class="rounded-2xl border bg-slate-900/60 backdrop-blur p-6" :class="ac.border">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-start gap-4">
            <span class="text-4xl">{{ program.icon }}</span>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-md" :class="[ac.soft, ac.text]">{{ program.category }}</span>
                <span v-if="program.status === 'pengembangan'" class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">DIKEMBANGKAN</span>
              </div>
              <h1 class="text-xl font-extrabold text-slate-50 mt-1.5">{{ program.title }}</h1>
              <p class="text-[11px] text-slate-500 mt-0.5">Penyelenggara/asal: {{ program.provider }}</p>
              <p class="text-xs text-slate-400 mt-2 max-w-2xl leading-relaxed">{{ program.blurb }}</p>
            </div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-2xl font-extrabold" :class="ac.text">{{ pct }}%</div>
            <div class="text-[11px] text-slate-500">{{ doneCount }}/{{ allLessons.length }} selesai</div>
          </div>
        </div>
        <div class="mt-4 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all" :class="ac.bar" :style="{ width: pct + '%' }"></div>
        </div>
      </div>

      <!-- WMI worksheet shortcut -->
      <NuxtLink v-if="program.id === 'wmi'" to="/belajar/lembar-kerja"
        class="block rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 hover:border-amber-500/50 transition-all">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-bold text-amber-300 flex items-center gap-2">🧮 Lembar Kerja WMI — 7 kalkulator ujian</span>
          <span class="text-amber-400 text-xs font-bold">Buka →</span>
        </div>
      </NuxtLink>

      <!-- Paths → modules → lessons -->
      <div v-for="path in program.paths" :key="path.id" class="space-y-4">
        <div v-if="multiPath" class="flex items-center gap-2 px-1 pt-2">
          <span class="text-lg">{{ path.icon }}</span>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-md" :class="[ac.soft, ac.text]">{{ path.level }}</span>
              <h2 class="text-sm font-bold text-slate-100">{{ path.title }}</h2>
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5 max-w-2xl">{{ path.goal }}</p>
          </div>
        </div>

        <div v-for="mod in path.modules" :key="mod.id" class="space-y-2">
          <div class="flex items-center gap-2 px-1">
            <span class="text-sm">{{ mod.icon }}</span>
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">{{ mod.title }}</h3>
          </div>
          <NuxtLink v-for="lesson in mod.lessons" :key="lesson.id" :to="`/belajar/${lesson.id}`"
            class="flex items-center gap-3 p-3.5 rounded-xl border transition-all group"
            :class="isDone(lesson.id) ? 'bg-slate-900/80 border-emerald-500/30' : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'">
            <span class="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border"
              :class="isDone(lesson.id) ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-700 text-slate-600'">
              {{ isDone(lesson.id) ? '✓' : '' }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">{{ lesson.title }}</div>
              <div class="text-xs text-slate-500 truncate">{{ lesson.summary }}</div>
            </div>
            <div class="shrink-0 flex items-center gap-2 text-[11px] text-slate-500">
              <span v-if="lesson.quiz && lesson.quiz.length" class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">📝</span>
              <span>⏱ {{ lesson.minutes }}m</span>
              <span class="text-slate-600 group-hover:translate-x-0.5 transition-transform">→</span>
            </div>
          </NuxtLink>
        </div>
      </div>
    </template>

    <div v-else class="rounded-2xl bg-slate-900/70 border border-slate-800 p-12 text-center">
      <p class="text-sm text-slate-400">Program tidak ditemukan.</p>
      <NuxtLink to="/belajar" class="inline-block mt-4 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-xl">← Kembali ke Beranda Belajar</NuxtLink>
    </div>
  </div>
</template>
