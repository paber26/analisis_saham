<script setup lang="ts">
import { computed } from 'vue';
import type { SeasonalPeriodStats } from '../../types/seasonal';

const props = defineProps<{
  stats: SeasonalPeriodStats[];
  ihsgStats?: SeasonalPeriodStats[];
  stockCode: string;
}>();

// Compute ECharts option
const chartOption = computed(() => {
  const categories = props.stats.map(s => s.periodLabel);
  const data = props.stats.map(s => {
    const isPositive = s.avgReturn >= 0;
    return {
      value: s.avgReturn,
      itemStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: isPositive
            ? [
                { offset: 0, color: '#10b981' }, // emerald-500
                { offset: 1, color: '#059669' }  // emerald-600
              ]
            : [
                { offset: 0, color: '#f43f5e' }, // rose-500
                { offset: 1, color: '#e11d48' }  // rose-600
              ]
        },
        borderRadius: s.avgReturn >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]
      }
    };
  });

  const hasIhsg = props.ihsgStats && props.stockCode !== 'IHSG';

  const series: any[] = [
    {
      name: props.stockCode,
      type: 'bar',
      barWidth: hasIhsg ? '45%' : '55%',
      data: data
    }
  ];

  if (hasIhsg && props.ihsgStats) {
    series.push({
      name: 'IHSG',
      type: 'line',
      smooth: true,
      showSymbol: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        color: '#60a5fa', // blue-400
        width: 2.5,
        type: 'dashed'
      },
      itemStyle: {
        color: '#3b82f6', // blue-500
        borderColor: '#020617',
        borderWidth: 1.5
      },
      data: props.ihsgStats.map(s => s.avgReturn)
    });
  }

  return {
    backgroundColor: 'transparent',
    legend: {
      show: hasIhsg,
      data: [props.stockCode, 'IHSG'],
      textStyle: {
        color: '#94a3b8',
        fontFamily: 'inherit',
        fontSize: 11
      },
      top: '0%',
      right: '2%'
    },
    grid: {
      left: '3%',
      right: '3%',
      bottom: '3%',
      top: hasIhsg ? '18%' : '12%',
      containLabel: true
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f172a', // slate-900
      borderColor: '#334155', // slate-700
      borderWidth: 1,
      textStyle: {
        color: '#f8fafc' // slate-50
      },
      padding: [10, 14],
      formatter: (params: any) => {
        const item = params[0];
        const val = item.value;
        const index = item.dataIndex;
        const stat = props.stats[index];
        const color = val >= 0 ? '#34d399' : '#f87171'; // emerald-400 : rose-400
        const sign = val > 0 ? '+' : '';
        
        let ihsgHtml = '';
        const ihsgItem = params.find((p: any) => p.seriesName === 'IHSG');
        if (ihsgItem) {
          const ihsgVal = ihsgItem.value;
          const ihsgColor = '#60a5fa'; // blue-400
          const ihsgSign = ihsgVal > 0 ? '+' : '';
          const diffVal = val - ihsgVal;
          const diffColor = diffVal >= 0 ? '#34d399' : '#f87171';
          const diffSign = diffVal > 0 ? '+' : '';
          ihsgHtml = `
            <div style="display: flex; justify-content: space-between; gap: 24px; margin-bottom: 4px;">
              <span style="color: #cbd5e1;">Avg Return IHSG:</span>
              <span style="font-weight: 700; color: ${ihsgColor};">${ihsgSign}${ihsgVal.toFixed(2)}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 24px; margin-bottom: 4px;">
              <span style="color: #cbd5e1;">Alpha vs IHSG:</span>
              <span style="font-weight: 700; color: ${diffColor};">${diffSign}${diffVal.toFixed(2)}%</span>
            </div>
          `;
        }

        return `
          <div style="font-family: inherit; font-size: 13px;">
            <div style="font-weight: 600; margin-bottom: 6px; color: #94a3b8;">${item.name}</div>
            <div style="display: flex; justify-content: space-between; gap: 24px; margin-bottom: 4px;">
              <span style="color: #cbd5e1;">Avg Return ${props.stockCode}:</span>
              <span style="font-weight: 700; color: ${color};">${sign}${val.toFixed(2)}%</span>
            </div>
            ${ihsgHtml}
            <div style="display: flex; justify-content: space-between; gap: 24px; margin-bottom: 4px;">
              <span style="color: #cbd5e1;">Win Rate ${props.stockCode}:</span>
              <span style="font-weight: 700; color: #f8fafc;">${stat.winRate}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 24px;">
              <span style="color: #cbd5e1;">Naik / Turun:</span>
              <span style="font-weight: 500; color: #94a3b8;">${stat.yearsUp} thn / ${stat.yearsDown} thn</span>
            </div>
          </div>
        `;
      }
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: {
        lineStyle: {
          color: '#334155' // slate-700
        }
      },
      axisLabel: {
        color: '#94a3b8', // slate-400
        fontSize: 11,
        fontFamily: 'inherit'
      },
      axisTick: {
        show: false
      }
    },
    yAxis: {
      type: 'value',
      axisLine: {
        show: false
      },
      axisLabel: {
        color: '#94a3b8',
        fontFamily: 'inherit',
        fontSize: 11,
        formatter: '{value}%'
      },
      splitLine: {
        lineStyle: {
          color: '#1e293b', // slate-800
          type: 'dashed'
        }
      }
    },
    series: series
  };
});
</script>

<template>
  <div class="glow-card p-6 rounded-2xl">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
      <div>
        <h4 class="text-lg font-bold text-slate-100">Rata-rata Return Bulanan / Periodik</h4>
        <p class="text-xs text-slate-400">Distribusi rata-rata performa historis saham {{ stockCode }}</p>
      </div>
      <div class="flex items-center gap-4 text-xs font-semibold">
        <div class="flex items-center gap-1.5">
          <span class="w-3 h-3 bg-emerald-500 rounded-sm"></span>
          <span class="text-slate-350">Return Positif</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-3 h-3 bg-rose-500 rounded-sm"></span>
          <span class="text-slate-350">Return Negatif</span>
        </div>
      </div>
    </div>

    <!-- Chart container with ClientOnly to handle ECharts server rendering safety -->
    <div class="h-[320px] w-full">
      <ClientOnly>
        <VChart :option="chartOption" class="w-full h-full" autoresize />
        <template #fallback>
          <div class="w-full h-full flex items-center justify-center text-slate-500 text-sm">
            Memuat grafik...
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
