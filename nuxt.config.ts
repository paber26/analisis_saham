// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', 'nuxt-echarts'],
  css: ['~/assets/css/main.css'],
  future: {
    compatibilityVersion: 4,
  },
  echarts: {
    renderer: ['canvas', 'svg'],
    charts: ['BarChart', 'HeatmapChart', 'LineChart', 'CandlestickChart'],
    components: ['TooltipComponent', 'GridComponent', 'VisualMapComponent', 'LegendComponent', 'DataZoomComponent']
  }
})