import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';

export interface MaterialItem {
  id: string;
  title: string;
  category: 'Dasar Pasar Modal' | 'Analisis Fundamental' | 'Analisis Teknikal' | 'Risk Management' | 'Catatan & Strategi';
  level: 'Dasar' | 'Menengah' | 'Lanjutan';
  summary: string;
  content: string;
  tags: string[];
  updatedAt: string;
  isCustom?: boolean;
}

const STORE_DIR = process.env.DATA_STORE_DIR || './.data-store';
const STORE_FILE = join(STORE_DIR, 'materials.json');

const INITIAL_MATERIALS: MaterialItem[] = [
  {
    id: 'intro-bei',
    title: '1. Pengenalan Pasar Modal, Papan Perdagangan & Mekanisme BEI',
    category: 'Dasar Pasar Modal',
    level: 'Dasar',
    summary: 'Memahami konsep kepemilikan saham, IHSG, fraksi harga, jam perdagangan, Auto Rejection (ARA/ARB), Call Auction (FCA), dan settlement T+2 di BEI.',
    tags: ['BEI', 'Saham', 'Lot', 'Fraksi Harga', 'IHSG', 'Auto Rejection', 'FCA'],
    updatedAt: '2026-07-22',
    content: `### Apa itu Saham & Indeks Harga Saham Gabungan (IHSG)?
Saham adalah bukti kepemilikan nilai atas suatu perseroan terbatas (emiten). Ketika Anda membeli saham di Bursa Efek Indonesia (BEI), Anda resmi menjadi pemegang saham (*shareholder*) dan berhak atas dividen serta suara dalam RUPS.
- **IHSG (Indeks Harga Saham Gabungan)**: Indeks pengukur kinerja pergerakan seluruh saham emiten yang tercatat di BEI.

### Satuan Perdagangan & Aturan Fraksi Harga
- **1 Lot** = 100 lembar saham.
- **Fraksi Harga** (Aturan Minimum Perubahan Harga di BEI):
  - **< Rp 200**: Fraksi Rp 1 (Maksimum perubahan 10 ticks = Rp 10)
  - **Rp 200 - Rp 500**: Fraksi Rp 2 (Maksimum perubahan 10 ticks = Rp 20)
  - **Rp 500 - Rp 2.000**: Fraksi Rp 5 (Maksimum perubahan 10 ticks = Rp 50)
  - **Rp 2.000 - Rp 5.000**: Fraksi Rp 10 (Maksimum perubahan 10 ticks = Rp 100)
  - **≥ Rp 5.000**: Fraksi Rp 25 (Maksimum perubahan 10 ticks = Rp 250)

### Aturan Auto Rejection (ARA & ARB SIMETRIS)
Auto Rejection adalah batas maksimum kenaikan (*Auto Rejection Atas / ARA*) atau penurunan (*Auto Rejection Bawah / ARB*) harga saham dalam satu hari perdagangan:
- **Harga Rp 50 - Rp 200**: Batas ARA & ARB = **35%**
- **Harga > Rp 200 - Rp 5.000**: Batas ARA & ARB = **25%**
- **Harga > Rp 5.000**: Batas ARA & ARB = **20%**

### Papan Perdagangan Bursa Efek Indonesia
1. **Papan Utama**: Emiten besar dengan rekam jejak keuangan dan aset bersih kuat.
2. **Papan Pengembangan**: Emiten skala menengah yang sedang berkembang.
3. **Papan Akselerasi**: Emiten skala kecil/UMKM.
4. **Papan Pemantauan Khusus (FCA - Full Call Auction)**: Saham dalam kriteria khusus (ekuitas negatif, likuiditas sangat rendah, atau tidak membagikan dividen sesuai ketentuan). Perdagangan dilakukan secara kuotasi kolektif (Call Auction) 5 sesi per hari.

### Sesi Perdagangan & Settlement T+2
- **Sesi Pre-Opening**: 08:45 - 08:59 WIB (Penetapan Harga Pembukaan / IEP)
- **Sesi I**: 09:00 - 12:00 WIB (Senin-Kamis), 09:00 - 11:30 WIB (Jumat)
- **Sesi II**: 13:30 - 15:49 WIB (Senin-Kamis), 14:00 - 15:49 WIB (Jumat)
- **Pre-Closing & Post-Trading**: 15:50 - 16:15 WIB
- **Settlement T+2**: Hak transaksi saham dan dana tunai diselesaikan 2 hari kerja setelah tanggal transaksi.`
  },
  {
    id: 'fundamental-ratios',
    title: '2. Rasio Fundamental Utama & Valuasi Saham: PER, PBV, ROE, DER, & DY',
    category: 'Analisis Fundamental',
    level: 'Dasar',
    summary: 'Membedah 5 rasio utama kesehatan emiten, formula DuPont Analysis, dan perbandingan valuasi antar sektor industri BEI.',
    tags: ['PER', 'PBV', 'ROE', 'DER', 'Dividend Yield', 'Valuasi', 'DuPont'],
    updatedAt: '2026-07-22',
    content: `### 1. PER (Price to Earnings Ratio) & PEG Ratio
Mengukur berapa kali lipat harga saham dibanding laba bersih per saham (*EPS*).
- **Rumus**: \`PER = Price / EPS\`
- **Interpretasi**: PER rendah (misal < 10x) dapat menandakan saham *undervalued* atau bisnis sedang mengalami kontraksi.
- **PEG Ratio (PER to Growth)**: \`PEG = PER / Pertumbuhan Laba (%)\`. PEG < 1.0 mengindikasikan harga saham sangat menarik dibanding tingkat pertumbuhannya.

### 2. PBV (Price to Book Value)
Rasio harga saham terhadap nilai buku bersih ekuitas per saham (*BVPS*).
- **Rumus**: \`PBV = Price / BVPS\`
- **Sektor Perbankan**: Sangat relevan untuk emiten bank. Bank KBMI 4 unggulan (BBCA, BBRI, BMRI, BBNI) biasa ditransaksikan di PBV 1.2x hingga 4.5x sesuai kualitas ROE.

### 3. ROE (Return on Equity) & DuPont Analysis
Mengukur efisiensi manajemen dalam menghasilkan laba bersih dari modal ekuitas sendiri.
- **Rumus Dasar**: \`ROE = (Laba Bersih / Total Ekuitas) × 100%\`
- **DuPont Analysis Breakdown**:
  - \`ROE = Net Profit Margin × Asset Turnover × Financial Leverage\`
  - Mengurai apakah tingginya ROE didorong oleh margin keuntungan tebal (NPM), kecepatan efisiensi aset, atau penggunaan utang tinggi (*leverage*).
- **Standar Emas**: ROE > 15% secara konsisten menunjukkan emiten berdaya saing tinggi (*Moat*).

### 4. DER (Debt to Equity Ratio) & Interest Coverage Ratio
Mengukur tingkat utang berbunga dibanding modal ekuitas.
- **Rumus**: \`DER = Total Liabilitas Berbunga / Total Ekuitas\`
- **Batas Aman**: DER < 1.0x (Sektor non-keuangan). Untuk perbankan, rasio dana pihak ketiga (DPK) dievaluasi melalui LDR (Loan to Deposit Ratio).
- **Interest Coverage Ratio (ICR)**: \`EBIT / Beban Bunga\` (> 3x dianggap aman).

### 5. Dividend Yield (DY) & Dividend Payout Ratio (DPR)
- **Dividend Yield**: \`Dividen per Lembar / Harga Saham Saat Ini × 100%\`.
- **DPR**: \`Total Dividen / Laba Bersih × 100%\`. DPR yang konsisten 40-80% menandakan arus kas emiten sangat matang.`
  },
  {
    id: 'financial-analysis',
    title: '3. Analisis Laporan Keuangan: Neraca, Laba Rugi, Cash Flow & Red Flags',
    category: 'Analisis Fundamental',
    level: 'Menengah',
    summary: 'Panduan membaca 3 laporan utama emiten, mengukur Kualitas Laba (Quality of Earnings), dan mendeteksi tanda bahaya (Red Flags).',
    tags: ['Laporan Keuangan', 'Cash Flow', 'Neraca', 'Laba Rugi', 'Red Flags', 'Audit'],
    updatedAt: '2026-07-22',
    content: `### Tiga Pilar Utama Laporan Keuangan
1. **Neraca (Balance Sheet)**: Menampilkan posisi Aset, Liabilitas (Utang), dan Ekuitas pada tanggal tertentu.
2. **Laporan Laba Rugi (Income Statement)**: Menjelaskan Pendapatan (Revenue), Beban Usaha, Laba Usaha (EBIT), dan Laba Bersih (Net Income).
3. **Laporan Arus Kas (Statement of Cash Flows)**: Merekam arus kas riil masuk dan keluar dari 3 aktivitas: Operasi (CFO), Investasi (CFI), dan Pendanaan (CFF).

### Evaluasi Kualitas Laba (Quality of Earnings)
Laba bersih di laporan laba rugi bersifat pencatatan akuntansi (*accrual basis*). Kualitas laba yang sehat harus disokong oleh arus kas operasi riil (*Cash Flow from Operations / CFO*).
- **Rasio Kualitas Laba**: \`CFO / Laba Bersih\`
- **Analisis**: Jika nilai rasio > 1.0, laba emiten terbukti riil dan langsung masuk ke kas perusahaan. Jika < 0.8 secara berturut-turut,waspadai risiko *paper profit*.

### Tanda Bahaya (Red Flags) Laporan Keuangan
- **1. Piutang Usaha Membengkak**: Pendapatan dilaporkan naik tinggi, tetapi piutang usaha (*Accounts Receivable*) melonjak jauh lebih cepat tanpa konversi menjadi kas.
- **2. Persediaan (Inventory) Menumpuk**: Rasio *Days Sales of Inventory (DSI)* meningkat drastis, menandakan produk emiten tidak laku di pasaran.
- **3. Lonjakan Aset Tidak Berwujud (Goodwill)**: Pembelian anak perusahaan dengan harga terlalu tinggi tanpa prospek bisnis yang jelas.
- **4. Pergantian Auditor Independen Berulang**: Terutama jika opini auditor berubah dari Unqualified (WTP) menjadi Qualified atau Adverse.
- **5. Utang Jangka Pendek Tinggi Tanpa Kas Cukup**: Quick Ratio < 1.0 saat utang Obligasi / MTN akan jatuh tempo.`
  },
  {
    id: 'candlestick-sr',
    title: '4. Dasar Analisis Teknikal: Candlestick, Trend, & Support/Resistance',
    category: 'Analisis Teknikal',
    level: 'Dasar',
    summary: 'Pola candlestick reversal/continuation, struktur tren market (Uptrend/Downtrend/Sideways), dan teknik menentukan S/R valid.',
    tags: ['Candlestick', 'Support', 'Resistance', 'Uptrend', 'Price Action', 'Teknikal'],
    updatedAt: '2026-07-22',
    content: `### Anatomi & Psikologi Candlestick
Candlestick merekam pertarungan antara Pembeli (Bulls) dan Penjual (Bears) dalam satu interval periode:
- **Body (Badan)**: Jarak antara Harga Buka (Open) dan Harga Tutup (Close). Badan hijau/putih menandakan Bulls menang.
- **Shadow (Ekor/Sumbu)**: Harga tertinggi (High) dan terendah (Low) yang sempat tersentuh. Ekor bawah panjang menandakan penolakan penurunan harga (*buying pressure*).

### Pola Reversal Kunci (Sinyal Pembalikan Arah)
- **Bullish Engulfing**: Body hijau penuh menutup seluruh body merah hari sebelumnya di area Support.
- **Hammer / Pinbar Bullish**: Ekor bawah panjang minimal 2x panjang body di ujung Downtrend.
- **Morning Star**: Kombinasi 3 candle (Downtrend -> Small Body / Doji -> Big Bullish Candle).

### Analisis Struktur Market (Market Structure)
- **Uptrend**: Terbentuk pola puncak dan lembah yang semakin tinggi: **Higher High (HH)** dan **Higher Low (HL)**. Strategi: *Buy on Breakout / Buy on Dip*.
- **Downtrend**: Terbentuk puncak dan lembah yang semakin rendah: **Lower High (LH)** dan **Lower Low (LL)**. Strategi: *Avoid / Sell / Cut Loss*.
- **Sideways / Consolidating**: Harga bergerak mendatar dalam koridor Support & Resistance.

### Support & Resistance (S/R) & Role Reversal
- **Support**: Level harga di mana dorongan beli diperkirakan cukup kuat untuk menahan penurunan.
- **Resistance**: Level harga di mana tekanan jual diperkirakan menahan kenaikan.
- **Role Reversal (RBS & SBR)**:
  - **Resistance Become Support (RBS)**: Saat resistance berhasil ditembus (*breakout*), level tersebut berubah fungsi menjadi support baru.
  - **Support Become Resistance (SBR)**: Saat support jebol (*breakdown*), level tersebut berubah menjadi resistance baru.`
  },
  {
    id: 'indicators-price-action',
    title: '5. Analisis Teknikal Lanjutan: Moving Average, RSI, MACD, & Smart Money',
    category: 'Analisis Teknikal',
    level: 'Menengah',
    summary: 'Kombinasi indikator tren (EMA 20/50/200), RSI divergence, MACD histogram, serta introduksi Order Block & Supply-Demand.',
    tags: ['EMA', 'RSI', 'MACD', 'Divergence', 'Order Block', 'Smart Money'],
    updatedAt: '2026-07-22',
    content: `### Moving Averages (EMA 20, 50, 200)
- **EMA 20**: Tren jangka pendek (Short-term momentum).
- **EMA 50**: Tren jangka menengah.
- **EMA 200**: Tren utama jangka panjang (Major Trend Baseline). Harga di atas EMA 200 menandakan fase Bullish utama.
- **Golden Cross**: EMA 50 memotong ke atas EMA 200 (Sinyal Bullish jangka panjang).
- **Death Cross**: EMA 50 memotong ke bawah EMA 200 (Sinyal Bearish).

### RSI (Relative Strength Index) & Divergence
Mengukur kecepatan dan perubahan pergerakan harga pada skala 0 - 100.
- **Overbought (> 70)** & **Oversold (< 30)**.
- **Bullish Divergence**: Harga membuat *Lower Low*, tetapi indikator RSI membuat *Higher Low*. Mengindikasikan tekanan jual mulai melemah dan potensi rebound besar.
- **Bearish Divergence**: Harga membuat *Higher High*, tetapi RSI membuat *Lower High*. Menandakan tenaga kenaikan sudah habis.

### MACD (Moving Average Convergence Divergence)
- **MACD Line & Signal Line**: Crossover MACD ke atas Signal Line memberikan konfirmasi momentum beli.
- **MACD Histogram**: Menunjukkan kekuatan dorongan tren. Histogram berpindah dari area negatif ke positif menandakan awal fase penguatan baru.

### Konsep Price Action & Smart Money (SMC)
- **Break of Structure (BOS)**: Penembusan swing high/low yang mengonfirmasi kelanjutan tren utama.
- **Change of Character (CHoCH)**: Penembusan struktur pertama yang menandakan awal perubahan tren dari Bearish ke Bullish (atau sebaliknya).
- **Order Block (OB)**: Area konsolidasi atau candle terakhir sebelum terjadi dorongan harga impulsif. Area ini sering menjadi zona re-entry favorit institusi.`
  },
  {
    id: 'bandarmologi-foreign',
    title: '6. Analisis Bandarmologi & Foreign Flow di Bursa Efek Indonesia',
    category: 'Analisis Teknikal',
    level: 'Lanjutan',
    summary: 'Membaca akumulasi dan distribusi Smart Money lewat Broker Summary, Top Broker Net Buy/Sell, dan jejak Investor Asing.',
    tags: ['Bandarmologi', 'Foreign Flow', 'Broker Summary', 'Akumulasi', 'Distribusi', 'Smart Money'],
    updatedAt: '2026-07-22',
    content: `### Prinsip Utama Bandarmologi
Di pasar saham BEI, harga digerakkan oleh hukum penawaran dan permintaan yang dikuasai oleh pemilik modal besar (Market Maker / Institutional Smart Money). Bandarmologi adalah metode melacak jejak akumulasi dan distribusi modal tersebut.

### Membaca Broker Summary (BroSum)
- **Klasifikasi Kode Broker**:
  - **Asing (Foreign)**: AK, BK, RX, ZP, CS, DB, KZ, LG.
  - **BUMN / Lokal Institusi**: CC, NI, OD, IF.
  - **Retail Popular**: YP, PD, XC, KK, XL, EP.
- **Indikator Akumulasi**: Top 1 sampai Top 3 broker menguasai > 60-70% total volume pembelian (*Net Buy*), sementara penjualan tersebar merata di puluhan broker retail.
- **Indikator Distribusi**: Broker ritel mendominasi pembelian (*Net Buy*), sementara 1-2 broker institusi/asing menjual (*Net Sell*) dalam jumlah masif.

### Fase Siklus Bandar (Bandar Cycle)
1. **Fase Akumulasi**: Harga dijaga mendatar/sideways dalam jangka waktu lama, volume perdagangan tampak sepi, tetapi broker utama terus mengumpulkan barang.
2. **Fase Mark-Up**: Harga didorong naik cepat menembus resistance, menarik perhatian pembeli ritel (FOMO).
3. **Fase Distribusi**: Di area harga tinggi, disebarkan narasi berita sangat positif (catalyst), sementara bandar perlahan jualan ke ritel.
4. **Fase Mark-Down**: Harga dibiarkan turun drastis hingga ritel terpaksa melalukan *Panic Selling / Cut Loss*.

### Foreign Flow Analysis (Aliran Dana Asing)
- Investor Asing mendominasi transaksi pada saham-saham indeks Big Caps (BBCA, BBRI, BMRI, TLKM, ASII).
- **Korelasi Foreign Flow**: Tren akumulasi *Net Foreign Buy* yang konsisten berhari-hari sering kali menjadi penggerak utama penguatan IHSG dan saham perbankan besar.`
  },
  {
    id: 'money-management',
    title: '7. Money Management, Position Sizing, & Manajemen Portofolio',
    category: 'Risk Management',
    level: 'Menengah',
    summary: 'Formula perhitungan lot (Rule 1-2%), Risk to Reward Ratio (RRR), diversifikasi alokasi modal, dan pengendalian drawdown.',
    tags: ['Risk', 'Position Sizing', 'Money Management', 'Stop Loss', 'RRR', 'Drawdown'],
    updatedAt: '2026-07-22',
    content: `### Prinsip Risk Management 1-2% Per Trade
Kunci utama bertahan dalam jangka panjang di pasar saham bukanlah mencari win-rate 100%, melainkan memastikan kerugian pada setiap posisi beli tidak merusak modal portofolio Anda.
- **Aturan**: Maksimal kerugian yang ditoleransi per transaksi adalah **1% hingga 2% dari total modal**.

### Formula Menghitung Jumlah Lot (Position Sizing)
1. **Modal Risiko (Rp)** = Total Portofolio × % Risk (misal 1%)
2. **Jarak Stop Loss per Lembar (Rp)** = Harga Entry - Harga Stop Loss
3. **Jumlah Lembar Saham** = Modal Risiko (Rp) / Jarak Stop Loss per Lembar
4. **Jumlah Lot** = Jumlah Lembar / 100

#### Simulasi Perhitungan Kasus Riil:
- Total Modal Portofolio: **Rp 100.000.000**
- Risiko 1% per Trade: **Rp 1.000.000**
- Buy Saham BBCA di **Rp 10.000**, Rencana Stop Loss di **Rp 9.500** (Jarak SL = Rp 500 / lembar).
- Hitungan Lembar: Rp 1.000.000 / Rp 500 = **2.000 lembar**.
- **Maksimum Posisi Beli** = **20 Lot** (Total Nilai Transaksi: Rp 20.000.000).

### Risk to Reward Ratio (RRR) & Mathematical Expectancy
- Selalu prioritaskan transaksi dengan **RRR minimal 1:2** (misal risiko Rp 500, target keuntungan minimal Rp 1.000).
- **Formula Expectancy**:
  \`Expectancy = (Win Rate % × RRR) - (Loss Rate % × 1)\`
  Dengan RRR 1:2, meskipun Win Rate Anda hanya 40%, sistem Anda tetap mencetak profit konsisten secara matematis!

### Aturan Diversifikasi & Cash Allocation
- **Maksimal Alokasi Per Saham**: 15% - 20% dari total portofolio.
- **Maksimal Alokasi Per Sektor**: 30% (mencegah risiko sistemik sektoral).
- **Cash Reserve**: Menyisakan 10% - 20% porsi kas tunai untuk mengambil peluang saat pasar koreksi tajam.`
  },
  {
    id: 'seasonal-anomalies',
    title: '8. Analisis Musiman (Seasonal Trends) & Anomali Pasar BEI',
    category: 'Catatan & Strategi',
    level: 'Menengah',
    summary: 'Strategi memanfaatkan siklus historis bulanan BEI: Window Dressing Des-Jan, Ramadhan Effect, Sell in May, dan Musim Dividen.',
    tags: ['Seasonal', 'Window Dressing', 'Sell in May', 'Musim Dividen', 'Siklus Komoditas'],
    updatedAt: '2026-07-22',
    content: `### Siklus Historis Pasar Saham Indonesia (BEI)
Pasar saham memiliki pola perilaku berulang yang dipengaruhi oleh siklus laporan keuangan, pembagian dividen, dan penutupan buku tahunan manajer investasi.

### 1. Window Dressing & Santa Claus Rally (November - Desember)
- **Fenomena**: Manajer investasi dan emiten mempercantik performa portofolio (*NAV*) dengan mendorong harga saham-saham *market cap* besar pada akhir tahun.
- **Statistik BEI**: Bulan Desember mencatatkan tingkat probabilitas kenaikan IHSG tertinggi (di atas 85-90% historis).
- **Strategi**: Akumulasi saham *Big Caps* berkualitas sejak pertengahan Oktober atau November.

### 2. January Effect
- Rebound lanjutan awal tahun akibat reinvestasi dana dividen dan alokasi modal baru dari investor institusi.

### 3. Musim Dividen & Dividen Trap (Maret - Mei)
- Rapat Umum Pemegang Saham Annual (RUPST) emiten berlangsung marak pada rentang bulan Maret hingga Mei.
- **Dividen Trap**: Bahaya membeli saham hanya 1 hari sebelum *Cum Date* demi dividen yield tinggi, namun harga saham langsung anjlok melebihi persentase dividen pada saat *Ex Date*.
- **Pencegahan**: Beli saham pembagi dividen rutin jauh sebelum pengumuman resmi RUPST.

### 4. Sell in May and Go Away (Mei - Agustus)
- Setelah musim pembagian dividen dan laporan keuangan Q1 selesai, volume transaksi pasar cenderung menurun (*low volume sideways*) sepanjang pertengahan tahun.

### 5. Siklus Komoditas (Commodity Supercycle)
- Emiten pertambangan & perkebunan di BEI (Batu bara, CPO, Nikel, Emas) sangat tergantung pada harga acuan komoditas dunia (Newcastle Coal, CPO Rotterdam, LME Nickel).
- Penguatan harga komoditas global biasanya memicu *rally* signifikan pada emiten terkait dalam rentang 1-3 bulan berikutnya.`
  },
  {
    id: 'trading-journal',
    title: '9. Jurnal Trading, System Playbook, & Kontrol Bias Psikologi',
    category: 'Catatan & Strategi',
    level: 'Lanjutan',
    summary: 'Membangun Trading System Playbook (Setup Breakout, Pullback, Value), mencatat jurnal transaksi, dan menguasai emosi trading.',
    tags: ['Jurnal', 'Psikologi', 'Checklist', 'Trading System', 'Disiplin', 'Bias Kognitif'],
    updatedAt: '2026-07-22',
    content: `### Tiga Pilar Trading System
Trading atau investasi yang sukses berlandaskan pada 3 hal: **System (Metode), Money (Manajemen Risiko), dan Mind (Psikologi)**.

### Checklist Eksekusi Sebelum Buy (Pre-Trade Checklist)
- [ ] Apakah tren utama mematuhi strategi (misal di atas EMA 200)?
- [ ] Apakah ada Katalis Fundamental / Sentimen (Growth / Laporan Keuangan / Action Emiten)?
- [ ] Di mana titik Stop Loss dan Target Price pasti?
- [ ] Apakah Risk to Reward Ratio (RRR) minimal 1:2?
- [ ] Apakah jumlah lot sudah dihitung sesuai aturan Risk 1% dari modal?

### Manajemen Bias Psikologi Pasar Saham
1. **Loss Aversion (Takut mengakui kekalahan)**: Enggan melakukan *cut loss* pada saham yang trennya sudah rusak karena berharap harga akan kembali. Solusi: Gunakan Automatic Stop Loss Order di aplikasi sekuritas.
2. **Confirmation Bias**: Hanya mencari artikel berita atau opini forum yang mendukung saham merugi yang sedang dipegang. Solusi: Selalu analisis skenario terburuk (*bearish case*).
3. **FOMO (Fear of Missing Out)**: Membeli di harga puncak setelah saham naik puluhan persen dalam hitungan hari. Solusi: Jika ketinggalan *breakout*, tunggu fase *retest / pullback* ke area support.

### Struktur Jurnal Trading Ideal
Setiap transaksi wajib dicatat dalam jurnal berisi kolom:
- **Tanggal & Kode Saham**
- **Skenario Setup**: (Breakout, Retest Support, Undervalued Value Play)
- **Harga Entry, Target Price, & Stop Loss**
- **Jumlah Lot & Risk (Rp)**
- **Hasil Akhir (P/L Rp & %)**
- **Catatan Evaluasi**: Apakah eksekusi sesuai rencana awal atau dipengaruhi emosi?`
  }
];

function ensureDirectoryExists() {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
}

export function getMaterials(): MaterialItem[] {
  try {
    ensureDirectoryExists();
    if (!existsSync(STORE_FILE)) {
      writeFileSync(STORE_FILE, JSON.stringify(INITIAL_MATERIALS, null, 2), 'utf-8');
      return INITIAL_MATERIALS;
    }
    const raw = readFileSync(STORE_FILE, 'utf-8');
    const items = JSON.parse(raw) as MaterialItem[];
    if (Array.isArray(items) && items.length > 0) {
      const itemMap = new Map<string, MaterialItem>();
      for (const item of items) {
        itemMap.set(item.id, item);
      }
      for (const initMat of INITIAL_MATERIALS) {
        const existing = itemMap.get(initMat.id);
        if (!existing || !existing.isCustom) {
          itemMap.set(initMat.id, initMat);
        }
      }
      const merged = Array.from(itemMap.values());
      writeFileSync(STORE_FILE, JSON.stringify(merged, null, 2), 'utf-8');
      return merged;
    }
    return INITIAL_MATERIALS;
  } catch (err) {
    console.error('Failed reading materials store:', err);
    return INITIAL_MATERIALS;
  }
}

export function saveMaterials(materials: MaterialItem[]): boolean {
  try {
    ensureDirectoryExists();
    const tempFile = `${STORE_FILE}.tmp.${Date.now()}`;
    writeFileSync(tempFile, JSON.stringify(materials, null, 2), 'utf-8');
    renameSync(tempFile, STORE_FILE);
    return true;
  } catch (err) {
    console.error('Failed saving materials store:', err);
    return false;
  }
}

