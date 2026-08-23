<script setup lang="ts">
import { provide } from 'vue';
import { createSimulationEngine, SIM_KEY } from '~/composables/useSimulationEngine';
import { createSimUi, SIM_UI_KEY } from '~/composables/useSimUi';

definePageMeta({ layout: 'simulasi' });
useHead({ title: 'Simulasi Mesin Waktu — Reksa Dana Masa Lampau | Saham IDX' });

// Satu instance engine + UI system untuk seluruh halaman & komponen anak
// (komponen mengaksesnya via inject — semantik state identik dengan versi
// monolitik sebelum refactor).
const ui = createSimUi();
const sim = createSimulationEngine(ui);
provide(SIM_UI_KEY, ui);
provide(SIM_KEY, sim);

const route = useRoute();
onMounted(() => {
  sim.loadSavedSessions();
  sim.loadInsights();
  const rid = route.query.review;
  if (rid) sim.openReview(String(rid));
});
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
          <button type="button" class="text-[11px] text-slate-500 hover:text-emerald-400" @click="sim.reset">↺ Mulai ulang</button>
        </div>
      </div>
      <!-- Stepper -->
      <div class="relative z-10 flex items-center gap-2 mt-5 text-[11px] font-bold flex-wrap">
        <span v-for="(s, i) in ['setup','screen','basket','play','result']" :key="s"
          class="px-2.5 py-1 rounded-full border"
          :class="sim.step === s ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-900 text-slate-500 border-slate-800'">
          {{ i + 1 }}. {{ ({setup:'Setup',screen:'Screening',basket:'Racik',play:'Playback',result:'Hasil'} as any)[s] }}
        </span>
      </div>
    </div>

    <div v-if="sim.errorMsg" class="rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm px-4 py-3">{{ sim.errorMsg }}</div>

    <!-- STEP 1: SETUP -->
    <template v-if="sim.step === 'setup'">
      <SetupStep />
    </template>

    <!-- STEP 2: SCREENING -->
    <ScreeningStep v-if="sim.step === 'screen'" />

    <!-- STEP 3: BASKET -->
    <BasketEditor v-if="sim.step === 'basket'" />

    <!-- STEP 4: PLAYBACK -->
    <PlaybackPanel v-if="sim.step === 'play'" />

    <!-- DECISION MODAL -->
    <DecisionModal />

    <!-- STEP 5: RESULT -->
    <ResultStep v-if="sim.step === 'result'" />

    <!-- REVIEW: tinjau sesi tersimpan -->
    <ReviewStep v-if="sim.step === 'review'" />

    <!-- CUSTOM CONFIRMATION POPUP MODAL -->
    <div v-if="ui.confirmModal.open" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md transition-all">
      <div class="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6 space-y-4 text-center transform transition-all scale-100">
        <div class="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-inner"
          :class="ui.confirmModal.type === 'danger' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'">
          <span class="text-2xl">{{ ui.confirmModal.type === 'danger' ? '🗑️' : '⚠️' }}</span>
        </div>

        <div>
          <h3 class="text-base font-extrabold text-slate-100">{{ ui.confirmModal.title }}</h3>
          <p class="text-xs text-slate-400 mt-2 leading-relaxed">{{ ui.confirmModal.message }}</p>
        </div>

        <div class="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            @click="ui.handleCancelModal"
            class="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
          >
            {{ ui.confirmModal.cancelText }}
          </button>
          <button
            type="button"
            @click="ui.handleConfirmModal"
            class="w-full px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg"
            :class="ui.confirmModal.type === 'danger' ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20' : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20'"
          >
            {{ ui.confirmModal.confirmText }}
          </button>
        </div>
      </div>
    </div>

    <!-- CUSTOM TOAST NOTIFICATION POPUP -->
    <div v-if="ui.notificationModal.open" class="fixed top-5 right-5 z-[100] max-w-sm w-full animate-bounce-once">
      <div class="rounded-2xl p-4 border shadow-2xl backdrop-blur-md flex items-start justify-between gap-3"
        :class="ui.notificationModal.type === 'error' ? 'bg-rose-950/90 border-rose-500/40 text-rose-200' : ui.notificationModal.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200' : 'bg-slate-900/90 border-slate-700 text-slate-200'">
        <div class="flex items-start gap-3">
          <span class="text-lg shrink-0">{{ ui.notificationModal.type === 'error' ? '❌' : ui.notificationModal.type === 'success' ? '✨' : 'ℹ️' }}</span>
          <div>
            <h4 class="text-xs font-extrabold tracking-wide uppercase">{{ ui.notificationModal.title }}</h4>
            <p class="text-xs mt-0.5 opacity-90 leading-relaxed">{{ ui.notificationModal.message }}</p>
          </div>
        </div>
        <button type="button" @click="ui.notificationModal.open = false" class="text-xs opacity-60 hover:opacity-100 p-1">✕</button>
      </div>
    </div>
  </div>
</template>
