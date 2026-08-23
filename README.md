# Analisis Saham IDX

Aplikasi analisis saham Bursa Efek Indonesia (personal) — live di
**https://saham.kuydinas.id**. Dibangun dengan Nuxt 4 SSR + Tailwind + ECharts;
data dari Yahoo Finance (cache disk per-hari) dan Stockbit (bandar/broker).

## Fitur

### Analisis pasar & saham
- **/screening** (beranda) — skor teknikal 0-100 untuk ~900 emiten
  (MA, RSI, MACD, ADX, Stochastic, Bollinger, volume), faktor **QVM**
  (Value-Quality-Momentum persentil lintas-universe), filter lanjutan +
  preset ("Murah + Uptrend", outperformer RS, dsb.)
- **/analisa/[symbol]** — hub per saham: indikator, support/resistance, pivot,
  fibonacci, rencana trade ATR + kalkulator posisi, risiko (vol, VaR 95%,
  max drawdown, beta vs IHSG), musiman, forecast, tren skor, kesimpulan
- **/pasar** — market breadth (% di atas MA200/MA50, RSI rata-rata, regime
  risk-on/off) + rotasi sektor
- **/forecast** — ensemble Naive/Drift/AR/Holt/Regresi pada log-return,
  walk-forward backtest, probabilitas naik, pita volatilitas EWMA
- **/seasonal** — pola musiman bulanan/kuartalan + uji signifikansi t-stat
- **/saham** — chart candlestick ala TradingView + rasio keuangan live
- **/profil-saham** — profil emiten
- **/bandar/[symbol]** — deteksi akumulasi/distribusi broker via Stockbit
  (owner-only; token disinkron otomatis oleh [extension Chrome](extension/))

### Pengelolaan uang
- **/watchlist** — daftar pantauan
- **/portofolio** — valuasi P&L, matriks korelasi (warning >0.7), risiko
  portofolio (vol, VaR, drawdown, beta)
- **/backtest** — simulasi strategi bulanan (skor teknikal / MA200 /
  golden cross) vs IHSG + event study sinyal
- **/simulasi** — Simulasi Lab "time-machine": jalankan dana riil di masa lalu,
  keputusan per-periode, cut-loss regime-aware, vs IHSG (layout terpisah)

### Lainnya
- **/belajar** — LMS *learn-by-doing*: program Fondasi + sertifikasi
  (WMI/CFA/CTA/CSA), kuis, progres & streak tersimpan ([LEARNING.md](LEARNING.md))
- **/pengembangan** — blueprint arsitektur aplikasi yang bisa dieksekusi
  asisten ([docs](pengembangan/))
- Login auth pribadi, digest email harian, snapshot screener via cron
  (`/api/sync`), histori harian tersimpan (file + Postgres)

## Kualitas & pengujian

```bash
npm run test        # vitest — unit test engine analitik (46 test)
npm run typecheck   # vue-tsc ketat
npm run build       # produksi → .output/
./deploy.sh         # build + rsync + pm2 restart (butuh .deploy.env)
```

CI (GitHub Actions): `typecheck` → `test` → `build` pada tiap push/PR.
Test menargetkan fungsi murni di `server/utils` (teknikal, levels, forecast,
faktor QVM, portofolio, backtest) termasuk kasus anti look-ahead.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:3000
```

Detail desain: [ARCHITECTURE.md](ARCHITECTURE.md) · Rencana pengembangan:
[pengembangan/](pengembangan/) · Cara deploy: [DEPLOY.md](DEPLOY.md)
