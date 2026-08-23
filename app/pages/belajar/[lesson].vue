<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';

definePageMeta({ layout: 'learning' });

interface QuizQuestion { q: string; options: string[]; answer: number; explain?: string }
interface Practice { label: string; to: string; hint: string }
interface Lesson {
  id: string; title: string; summary: string; minutes: number;
  content: string; tags?: string[]; level?: string;
  practice?: Practice; quiz?: QuizQuestion[];
}
interface Module { id: string; title: string; icon: string; lessons: Lesson[] }
interface Path { id: string; title: string; level: string; icon: string; accent: string; modules: Module[] }
interface Program { id: string; short: string; icon: string; paths: Path[] }
interface Progress { completed: string[]; quiz: Record<string, { score: number; total: number }> }

const route = useRoute();
const lessonId = computed(() => String(route.params.lesson));

const { data, refresh } = await useFetch<{ programs: Program[]; progress: Progress }>('/api/learning');
const { renderMarkdown } = useMarkdown();
const { token, setToken, authHeaders } = useAppToken();
const { last: lastSymbol, hydrate } = useLastSymbol();

// Locate the current lesson within the curriculum, plus prev/next.
const located = computed(() => {
  const programs = data.value?.programs ?? [];
  const flat: { program: Program; path: Path; module: Module; lesson: Lesson }[] = [];
  for (const prog of programs) for (const p of prog.paths) for (const m of p.modules) for (const l of m.lessons) flat.push({ program: prog, path: p, module: m, lesson: l });
  const idx = flat.findIndex((f) => f.lesson.id === lessonId.value);
  if (idx < 0 || !flat[idx]) return null;
  return {
    ...flat[idx],
    prev: idx > 0 ? flat[idx - 1]?.lesson ?? null : null,
    next: idx < flat.length - 1 ? flat[idx + 1]?.lesson ?? null : null,
    position: idx + 1,
    total: flat.length,
  };
});

const lesson = computed(() => located.value?.lesson ?? null);

useHead(() => ({ title: lesson.value ? `${lesson.value.title} — Belajar Saham` : 'Belajar Saham' }));

// ---- Progress (optimistic + persisted) ----
const completed = ref<Set<string>>(new Set());
watch(data, (d) => { completed.value = new Set(d?.progress?.completed ?? []); }, { immediate: true });
const isDone = computed(() => completed.value.has(lessonId.value));

const tokenInput = ref('');
const needUnlock = ref(false);
function unlock() { setToken(tokenInput.value); tokenInput.value = ''; needUnlock.value = false; refresh(); }

async function postAction(body: Record<string, unknown>): Promise<boolean> {
  if (!token.value) { needUnlock.value = true; return false; }
  try {
    await $fetch('/api/learning', { method: 'POST', headers: authHeaders.value, body });
    return true;
  } catch {
    return false;
  }
}

async function toggleComplete() {
  const target = !isDone.value;
  // optimistic
  if (target) completed.value.add(lessonId.value); else completed.value.delete(lessonId.value);
  completed.value = new Set(completed.value);
  const ok = await postAction({ action: target ? 'complete' : 'uncomplete', lessonId: lessonId.value });
  if (!ok) { // revert on failure
    if (target) completed.value.delete(lessonId.value); else completed.value.add(lessonId.value);
    completed.value = new Set(completed.value);
  }
}

// ---- Practice link (substitute {symbol}) ----
const practiceTo = computed(() => (lesson.value?.practice?.to ?? '').replace('{symbol}', lastSymbol.value));
const practiceLabel = computed(() => (lesson.value?.practice?.label ?? '').replace('{symbol}', lastSymbol.value));

// ---- Quiz ----
const answers = ref<Record<number, number>>({});
const submitted = ref(false);
const quiz = computed(() => lesson.value?.quiz ?? []);
const quizScore = computed(() => quiz.value.reduce((s, q, i) => s + (answers.value[i] === q.answer ? 1 : 0), 0));
const allAnswered = computed(() => quiz.value.length > 0 && quiz.value.every((_, i) => answers.value[i] !== undefined));

function resetQuizState() { answers.value = {}; submitted.value = false; }
async function submitQuiz() {
  submitted.value = true;
  await postAction({ action: 'quiz', lessonId: lessonId.value, score: quizScore.value, total: quiz.value.length });
}

// Reset transient state and mark "visited" when the lesson changes.
watch(lessonId, () => resetQuizState(), { immediate: true });
onMounted(() => {
  hydrate();
  if (token.value) postAction({ action: 'visit', lessonId: lessonId.value });
});
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
    <template v-if="lesson && located">
      <!-- Breadcrumb -->
      <div class="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <NuxtLink to="/belajar" class="hover:text-indigo-300 font-semibold">🏠 Belajar</NuxtLink>
        <span class="text-slate-700">/</span>
        <NuxtLink :to="`/belajar/program/${located.program.id}`" class="hover:text-indigo-300">{{ located.program.icon }} {{ located.program.short }}</NuxtLink>
        <span class="text-slate-700">/</span>
        <span class="text-slate-300">{{ located.module.icon }} {{ located.module.title }}</span>
      </div>

      <!-- Lesson header -->
      <div class="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Lesson {{ located.position }}/{{ located.total }}
          </span>
          <span v-if="lesson.level" class="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-950 text-slate-400 border border-slate-800">
            Tingkat: {{ lesson.level }}
          </span>
          <span class="text-[11px] text-slate-500">⏱ {{ lesson.minutes }} menit</span>
          <span v-if="isDone" class="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950">✓ Selesai</span>
        </div>
        <h1 class="text-2xl font-extrabold text-slate-50 tracking-tight leading-snug">{{ lesson.title }}</h1>
        <p class="text-sm text-slate-400 italic bg-slate-950 p-3 rounded-xl border border-slate-800/80">{{ lesson.summary }}</p>
      </div>

      <!-- Practice CTA (learn by doing) -->
      <div v-if="lesson.practice" class="rounded-2xl bg-gradient-to-r from-emerald-500/10 to-slate-900/40 border border-emerald-500/25 p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">🧪 Praktik Langsung</div>
            <p class="text-xs text-slate-300 leading-relaxed">{{ lesson.practice.hint }}</p>
          </div>
          <NuxtLink :to="practiceTo" class="shrink-0 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all">
            {{ practiceLabel }} →
          </NuxtLink>
        </div>
      </div>

      <!-- Lesson content -->
      <article
        class="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 text-sm text-slate-300 leading-relaxed prose prose-invert max-w-none"
        v-html="renderMarkdown(lesson.content)"
      ></article>

      <!-- Quiz -->
      <div v-if="quiz.length" class="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 space-y-5">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-bold text-slate-100 flex items-center gap-2">📝 Kuis Pemahaman</h2>
          <span v-if="submitted" class="text-sm font-extrabold" :class="quizScore === quiz.length ? 'text-emerald-400' : 'text-amber-400'">
            Skor {{ quizScore }}/{{ quiz.length }}
          </span>
        </div>

        <div v-for="(q, qi) in quiz" :key="qi" class="space-y-2">
          <div class="text-sm font-semibold text-slate-200">{{ qi + 1 }}. {{ q.q }}</div>
          <div class="grid gap-2">
            <button
              v-for="(opt, oi) in q.options"
              :key="oi"
              type="button"
              :disabled="submitted"
              @click="answers[qi] = oi"
              class="text-left px-3.5 py-2.5 rounded-xl border text-xs transition-all disabled:cursor-default"
              :class="[
                submitted
                  ? (oi === q.answer
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                      : (answers[qi] === oi ? 'bg-rose-500/10 border-rose-500/40 text-rose-300' : 'bg-slate-950 border-slate-800 text-slate-400'))
                  : (answers[qi] === oi ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-100' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600')
              ]"
            >
              <span class="inline-flex items-center gap-2">
                <span class="w-4 h-4 rounded-full border flex items-center justify-center text-[9px]"
                  :class="answers[qi] === oi ? 'border-emerald-400 bg-emerald-400 text-slate-950' : 'border-slate-600'">
                  {{ String.fromCharCode(65 + oi) }}
                </span>
                {{ opt }}
              </span>
            </button>
          </div>
          <p v-if="submitted && q.explain" class="text-[11px] text-slate-400 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
            💡 {{ q.explain }}
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            v-if="!submitted"
            :disabled="!allAnswered"
            @click="submitQuiz"
            class="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-bold rounded-xl transition-all"
          >
            Kumpulkan Jawaban
          </button>
          <button
            v-else
            @click="resetQuizState"
            class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
          >
            Ulangi Kuis
          </button>
          <span v-if="!allAnswered && !submitted" class="text-[11px] text-slate-500">Jawab semua pertanyaan dulu.</span>
        </div>
      </div>

      <!-- Unlock prompt (only shown when a write was attempted without token) -->
      <div v-if="needUnlock && !token" class="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4">
        <p class="text-xs text-amber-300 mb-2">🔐 Masukkan token akses agar progres & skor kuis tersimpan.</p>
        <div class="flex gap-2 max-w-sm">
          <input v-model="tokenInput" type="password" placeholder="Token akses" class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" @keyup.enter="unlock" />
          <button class="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl" @click="unlock">Buka</button>
        </div>
      </div>

      <!-- Complete + navigation -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <button
          @click="toggleComplete"
          class="px-5 py-3 text-sm font-bold rounded-xl transition-all"
          :class="isDone
            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'"
        >
          {{ isDone ? '↺ Tandai belum selesai' : '✓ Tandai lesson selesai' }}
        </button>

        <div class="flex items-center gap-2">
          <NuxtLink
            v-if="located.prev"
            :to="`/belajar/${located.prev.id}`"
            class="px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >← Sebelumnya</NuxtLink>
          <NuxtLink
            v-if="located.next"
            :to="`/belajar/${located.next.id}`"
            class="px-4 py-2.5 bg-slate-900 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 text-xs font-bold rounded-xl transition-colors"
          >Lesson berikutnya →</NuxtLink>
          <NuxtLink
            v-else
            to="/belajar"
            class="px-4 py-2.5 bg-slate-900 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 text-xs font-bold rounded-xl transition-colors"
          >Selesai — kembali ke jalur ✓</NuxtLink>
        </div>
      </div>
    </template>

    <!-- Not found -->
    <div v-else class="rounded-2xl bg-slate-900/70 border border-slate-800 p-12 text-center">
      <p class="text-sm text-slate-400">Lesson tidak ditemukan.</p>
      <NuxtLink to="/belajar" class="inline-block mt-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl">← Kembali ke Jalur Belajar</NuxtLink>
    </div>
  </div>
</template>
