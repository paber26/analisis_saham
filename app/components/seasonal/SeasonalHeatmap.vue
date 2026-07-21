<script setup lang="ts">
import { computed } from 'vue';
import type { StockMonthlyData, PeriodType, SeasonalPeriodStats } from '../../types/seasonal';
import { aggregateDataByPeriod } from '../../utils/seasonalCalculator';

const props = defineProps<{
  history: StockMonthlyData[];
  stats: SeasonalPeriodStats[];
  periodType: PeriodType;
  stockCode: string;
}>();

// Compute the heatmap config
const chartOption = computed(() => {
  // Aggregate data by selected period
  const aggregated = aggregateDataByPeriod(props.history, props.periodType);

  // Extract unique sorted years and period labels
  const years = Array.from(new Set(props.history.map(h => h.year))).sort((a, b) => a - b);
  const periodLabels = props.periodType === 'yearly' ? ['Return Tahunan'] : props.stats.map(s => s.periodLabel);

  // Map to [xIndex, yIndex, value] format
  const seriesData = aggregated.map(item => {
    const xIndex = props.periodType === 'yearly' ? 0 : periodLabels.indexOf(item.periodLabel);
    const yIndex = years.indexOf(item.year);
    return [xIndex, yIndex, item.returnVal];
  });

  // Calculate dynamic min/max for visual map range
  const returns = aggregated.map(d => d.returnVal);
  let maxVal = Math.max(...returns, 5);
  let minVal = Math.min(...returns, -5);

  // Make the color scale balanced around 0 if possible
  const limit = Math.max(Math.abs(maxVal), Math.abs(minVal));
  // Round to nearest integer for cleaner visual map scale
  const visualLimit = Math.ceil(limit);

  return {
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      backgroundColor: '#0f172a', // slate-900
      borderColor: '#334155', // slate-700
      borderWidth: 1,
      textStyle: {
        color: '#f8fafc' // slate-50
      },
      padding: [8, 12],
      formatter: (params: any) => {
        const val = params.data[2];
        const periodName = periodLabels[params.data[0]];
        const yearName = years[params.data[1]];
        const color = val >= 0 ? '#34d399' : '#f87171'; // emerald-400 : rose-400
        const sign = val > 0 ? '+' : '';
        return `
          <div style="font-family: inherit; font-size: 13px;">
            <div style="font-weight: 600; margin-bottom: 4px; color: #94a3b8;">${periodName} ${yearName}</div>
            <div style="display: flex; justify-content: space-between; gap: 16px;">
              <span style="color: #cbd5e1;">Return:</span>
              <span style="font-weight: 755; color: ${color};">${sign}${val.toFixed(2)}%</span>
            </div>
          </div>
        `;
      }
    },
    grid: {
      left: '3%',
      right: '3%',
      bottom: '10%',
      top: '12%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      position: 'top',
      data: periodLabels,
      splitArea: {
        show: true,
        areaStyle: {
          color: ['rgba(30, 41, 59, 0.1)', 'rgba(30, 41, 59, 0.2)']
        }
      },
      axisLine: {
        lineStyle: {
          color: '#334155'
        }
      },
      axisLabel: {
        color: '#94a3b8',
        fontFamily: 'inherit',
        fontSize: 11
      }
    },
    yAxis: {
      type: 'category',
      data: years.map(String),
      splitArea: {
        show: true,
        areaStyle: {
          color: ['rgba(30, 41, 59, 0.1)', 'rgba(30, 41, 59, 0.2)']
        }
      },
      axisLine: {
        lineStyle: {
          color: '#334155'
        }
      },
      axisLabel: {
        color: '#94a3b8',
        fontFamily: 'inherit',
        fontSize: 11
      }
    },
    visualMap: {
      min: -visualLimit,
      max: visualLimit,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      // Red for negative, dark slate for neutral, Emerald green for positive
      inRange: {
        color: ['#f43f5e', '#1e293b', '#10b981']
      },
      textStyle: {
        color: '#94a3b8',
        fontFamily: 'inherit',
        fontSize: 10
      },
      itemWidth: 12,
      itemHeight: 180,
      formatter: (value: number) => {
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(0)}%`;
      }
    },
    series: [
      {
        name: 'Return Heatmap',
        type: 'heatmap',
        data: seriesData,
        label: {
          show: props.periodType !== 'monthly', // Hide text labels on monthly to prevent overlap clutter, show on quarterly/yearly
          formatter: (params: any) => {
            const val = params.data[2];
            const sign = val > 0 ? '+' : '';
            return `${sign}${val.toFixed(1)}%`;
          },
          color: '#ffffff',
          fontWeight: '500',
          fontSize: 10,
          fontFamily: 'inherit'
        },
        itemStyle: {
          borderColor: '#020617', // Match body bg (slate-955)
          borderWidth: 1.5
        }
      }
    ]
  };
});

const getPeriodTypeName = (type: PeriodType) => {
  if (type === 'monthly') return 'Bulan';
  if (type === 'quarterly') return 'Kuartal';
  return 'Tahun';
};
</script>

<template>
  <div class="glow-card p-6 rounded-2xl">
    <div class="mb-6">
      <h4 class="text-lg font-bold text-slate-100">Heatmap Return Saham</h4>
      <p class="text-xs text-slate-400">Peta performa historis {{ stockCode }} berdasarkan Tahun vs {{ getPeriodTypeName(periodType) }}</p>
    </div>

    <div class="h-[380px] w-full">
      <ClientOnly>
        <VChart :option="chartOption" class="w-full h-full" autoresize />
        <template #fallback>
          <div class="w-full h-full flex items-center justify-center text-slate-500 text-sm">
            Memuat heatmap...
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
