// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', 'nuxt-echarts'],
  css: ['~/assets/css/main.css'],
  future: {
    compatibilityVersion: 4,
  },
  nitro: {
    // Persist the API cache to disk (survives restarts/deploys). Kept OUTSIDE
    // .output so deploy's `rsync --delete` doesn't wipe it. Combined with the
    // day-based cache keys, data is fetched from Yahoo at most once per day.
    storage: {
      cache: { driver: 'fs', base: process.env.NITRO_CACHE_DIR || './.cache' }
    },
    // Don't let Cloudflare (or any shared cache) cache API responses at the edge
    // — freshness is controlled at the origin (fs cache + daily sync). Without
    // this, defineCachedEventHandler's s-maxage makes CF serve stale data,
    // even across deploys.
    routeRules: {
      '/api/**': { headers: { 'cache-control': 'no-store' } }
    }
  },
  echarts: {
    renderer: ['canvas', 'svg'],
    charts: ['BarChart', 'HeatmapChart', 'LineChart', 'CandlestickChart'],
    components: ['TooltipComponent', 'GridComponent', 'VisualMapComponent', 'LegendComponent', 'DataZoomComponent']
  }
})