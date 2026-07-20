<script setup lang="ts">
import type { SeasonalPeriodStats, PeriodType } from '../../types/seasonal';

defineProps<{
  stats: SeasonalPeriodStats[];
  periodType: PeriodType;
}>();

// Helper to format percentage values
const formatPercent = (val: number) => {
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
};

// Helper for Win Rate color class
const getWinRateColor = (winRate: number) => {
  if (winRate >= 70) return 'text-emerald-400 font-semibold';
  if (winRate >= 50) return 'text-slate-200';
  return 'text-rose-400';
};

// Helper for Win Rate progress bar class
const getWinRateBarColor = (winRate: number) => {
  if (winRate >= 70) return 'bg-emerald-500';
  if (winRate >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
};

// Get name of period column in Indonesian
const getPeriodColumnName = (type: PeriodType) => {
  if (type === 'monthly') return 'Bulan';
  if (type === 'quarterly') return 'Kuartal';
  return 'Periode';
};
</script>

<template>
  <div class="glow-card rounded-2xl p-6 overflow-hidden">
    <div class="mb-4">
      <h4 class="text-lg font-bold text-slate-100">Tabel Statistik Pola Musiman</h4>
      <p class="text-xs text-slate-400">Rincian parameter statistik performa saham per periode</p>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-slate-800 text-slate-450 text-xs font-semibold uppercase tracking-wider">
            <th class="py-4 px-4 text-slate-400">{{ getPeriodColumnName(periodType) }}</th>
            <th class="py-4 px-4 text-right text-slate-400">Rata-rata Return</th>
            <th class="py-4 px-4 text-right text-slate-400">Tahun Naik (&uarr;)</th>
            <th class="py-4 px-4 text-right text-slate-400">Tahun Turun (&darr;)</th>
            <th class="py-4 px-4 text-right text-slate-400">Win Rate</th>
            <th class="py-4 px-4 text-right text-slate-400">Return Tertinggi</th>
            <th class="py-4 px-4 text-right text-slate-400">Return Terendah</th>
            <th class="py-4 px-4 text-right text-slate-400">n</th>
            <th class="py-4 px-4 text-right text-slate-400" title="Uji-t rata-rata return vs 0. |t| ≥ 2 dengan n ≥ 5 = pola signifikan, bukan sekadar noise.">Signifikansi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-850/60 text-sm">
          <tr 
            v-for="stat in stats" 
            :key="stat.periodLabel"
            class="hover:bg-slate-900/40 transition-colors"
          >
            <!-- Period Label -->
            <td class="py-3 px-4 font-semibold text-slate-200">
              {{ stat.periodLabel }}
            </td>
            
            <!-- Avg Return -->
            <td 
              class="py-3 px-4 text-right font-semibold font-display" 
              :class="stat.avgReturn > 0 ? 'text-emerald-400' : stat.avgReturn < 0 ? 'text-rose-400' : 'text-slate-350'"
            >
              {{ formatPercent(stat.avgReturn) }}
            </td>
            
            <!-- Years Up -->
            <td class="py-3 px-4 text-right font-medium text-emerald-500/90 font-display">
              {{ stat.yearsUp }} <span class="text-xs text-slate-500">thn</span>
            </td>
            
            <!-- Years Down -->
            <td class="py-3 px-4 text-right font-medium text-rose-500/90 font-display">
              {{ stat.yearsDown }} <span class="text-xs text-slate-500">thn</span>
            </td>
            
            <!-- Win Rate -->
            <td class="py-3 px-4 text-right">
              <div class="flex items-center justify-end gap-3">
                <span :class="getWinRateColor(stat.winRate)" class="font-display">
                  {{ stat.winRate }}%
                </span>
                <div class="hidden sm:block w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    class="h-full rounded-full"
                    :class="getWinRateBarColor(stat.winRate)"
                    :style="{ width: `${stat.winRate}%` }"
                  ></div>
                </div>
              </div>
            </td>
            
            <!-- Max Return -->
            <td class="py-3 px-4 text-right font-medium text-emerald-400/90 font-display">
              {{ formatPercent(stat.maxReturn) }}
            </td>
            
            <!-- Min Return -->
            <td class="py-3 px-4 text-right font-medium text-rose-400/90 font-display">
              {{ formatPercent(stat.minReturn) }}
            </td>

            <!-- Sample size -->
            <td class="py-3 px-4 text-right text-slate-400 font-display">
              {{ stat.count }} <span class="text-xs text-slate-500">thn</span>
            </td>

            <!-- Statistical significance (t-stat) -->
            <td class="py-3 px-4 text-right">
              <span
                v-if="stat.significant"
                class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border"
                :class="stat.tStat > 0 ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25' : 'text-rose-300 bg-rose-500/10 border-rose-500/25'"
                :title="`t = ${stat.tStat} — pola konsisten secara statistik`"
              >
                ★ Signifikan (t={{ stat.tStat }})
              </span>
              <span v-else class="text-[10px] text-slate-600" :title="`t = ${stat.tStat} — belum cukup bukti statistik`">
                t={{ stat.tStat }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
