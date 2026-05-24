<script setup lang="ts">
import type { DashboardSummary, PeriodType } from '../../types/seasonal';

const props = defineProps<{
  summary: DashboardSummary;
  periodType: PeriodType;
}>();

// Helper to format percentage values
const formatPercent = (val: number) => {
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
};

// Get name of period type in Indonesian
const getPeriodTypeName = (type: PeriodType) => {
  if (type === 'monthly') return 'Bulan';
  if (type === 'quarterly') return 'Kuartal';
  return 'Tahun';
};
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
    <!-- Average Return Card -->
    <div class="glow-card p-5 rounded-2xl flex flex-col justify-between">
      <div>
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Return per {{ getPeriodTypeName(periodType) }}</span>
        <h3 class="text-2xl font-bold mt-2 font-display" :class="summary.avgReturn > 0 ? 'text-emerald-400' : summary.avgReturn < 0 ? 'text-rose-400' : 'text-slate-300'">
          {{ formatPercent(summary.avgReturn) }}
        </h3>
      </div>
      <div class="mt-4 flex items-center text-xs">
        <span :class="summary.avgReturn > 0 ? 'bg-emerald-500/10 text-emerald-400' : summary.avgReturn < 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'" class="px-2 py-0.5 rounded-full font-medium">
          {{ summary.avgReturn > 0 ? 'Bullish Bias' : summary.avgReturn < 0 ? 'Bearish Bias' : 'Neutral' }}
        </span>
      </div>
    </div>

    <!-- Win Rate Card -->
    <div class="glow-card p-5 rounded-2xl flex flex-col justify-between">
      <div>
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overall Win Rate</span>
        <h3 class="text-2xl font-bold mt-2 font-display text-slate-50">
          {{ summary.winRate }}%
        </h3>
      </div>
      <div class="mt-4">
        <div class="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
          <div 
            class="h-full rounded-full transition-all duration-500" 
            :class="summary.winRate >= 60 ? 'bg-emerald-500' : summary.winRate >= 45 ? 'bg-amber-500' : 'bg-rose-500'"
            :style="{ width: `${summary.winRate}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Best Period Card -->
    <div class="glow-card p-5 rounded-2xl flex flex-col justify-between">
      <div>
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Best {{ getPeriodTypeName(periodType) }}</span>
        <h3 class="text-2xl font-bold mt-2 font-display text-emerald-400" v-if="summary.bestPeriod">
          {{ summary.bestPeriod.label }}
        </h3>
        <h3 class="text-2xl font-bold mt-2 font-display text-slate-50" v-else>-</h3>
      </div>
      <div class="mt-4 flex items-center justify-between text-xs">
        <span class="text-slate-400">Rata-rata return</span>
        <span class="font-semibold text-emerald-400" v-if="summary.bestPeriod">
          {{ formatPercent(summary.bestPeriod.value) }}
        </span>
        <span class="text-slate-400" v-else>-</span>
      </div>
    </div>

    <!-- Worst Period Card -->
    <div class="glow-card p-5 rounded-2xl flex flex-col justify-between">
      <div>
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Worst {{ getPeriodTypeName(periodType) }}</span>
        <h3 class="text-2xl font-bold mt-2 font-display text-rose-400" v-if="summary.worstPeriod">
          {{ summary.worstPeriod.label }}
        </h3>
        <h3 class="text-2xl font-bold mt-2 font-display text-slate-50" v-else>-</h3>
      </div>
      <div class="mt-4 flex items-center justify-between text-xs">
        <span class="text-slate-400">Rata-rata return</span>
        <span class="font-semibold text-rose-400" v-if="summary.worstPeriod">
          {{ formatPercent(summary.worstPeriod.value) }}
        </span>
        <span class="text-slate-400" v-else>-</span>
      </div>
    </div>

    <!-- Total Years Card -->
    <div class="glow-card p-5 rounded-2xl flex flex-col justify-between">
      <div>
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rentang Data</span>
        <h3 class="text-2xl font-bold mt-2 font-display text-slate-50">
          {{ summary.totalYears }} Tahun
        </h3>
      </div>
      <div class="mt-4 flex items-center text-xs">
        <span class="text-slate-400 font-medium">Data Historis Lengkap</span>
      </div>
    </div>
  </div>
</template>
