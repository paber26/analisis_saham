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
    }
    // NOTE: Edge (Cloudflare) caching of /api/** is disabled via the
    // server/plugins/no-cache-api.ts plugin (routeRules headers don't override
    // defineCachedEventHandler's s-maxage; the beforeResponse hook does).
  },
  echarts: {
    renderer: ['canvas', 'svg'],
    charts: ['BarChart', 'HeatmapChart', 'LineChart', 'CandlestickChart'],
    components: ['TooltipComponent', 'GridComponent', 'VisualMapComponent', 'LegendComponent', 'DataZoomComponent']
  }
})