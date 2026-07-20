# Analisis Saham IDX

Aplikasi analisis saham Bursa Efek Indonesia (personal) — live di
**https://saham.kuydinas.id**. Dibangun dengan Nuxt 4 SSR + Tailwind + ECharts;
data dari Yahoo Finance dengan cache disk per-hari.

## Fitur

- **/screening** (beranda) — skor teknikal 0-100 untuk ~170 saham likuid
  (MA, RSI, MACD, ADX, Stochastic, Bollinger, volume) + filter lanjutan
- **/analisa/[symbol]** — hub per saham: indikator, support/resistance, pivot,
  fibonacci, rencana trade ATR + kalkulator posisi, musiman, forecast, kesimpulan
- **/forecast** — ensemble Naive/Drift/AR/Holt/Regresi pada log-return,
  walk-forward backtest 3 fold, probabilitas naik, pita volatilitas EWMA
- **/seasonal** — pola musiman bulanan/kuartalan + uji signifikansi t-stat
- **/saham** — chart candlestick ala TradingView + rasio keuangan live
- **/profil-saham** — profil emiten

Detail desain: [ARCHITECTURE.md](ARCHITECTURE.md) · Cara deploy: [DEPLOY.md](DEPLOY.md)

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # produksi → .output/
./deploy.sh        # build + rsync + pm2 restart (butuh .deploy.env)
```
