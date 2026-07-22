// Curriculum definition for the guided learning module (/belajar).
//
// This is the *structure* of learning — ordered paths → modules → lessons.
// Lesson prose is NOT duplicated here: a lesson references an existing
// education material by `materialId` (see materialsStore.ts) so the two stay in
// sync. A lesson may instead carry inline `content` when it teaches one of the
// app's own tools (forecast/backtest) that has no standalone article.
//
// Each lesson optionally links to a real tool in the app (`practice`) so theory
// is immediately exercised on live BEI data — the core "learn by doing" idea —
// and optionally carries a short `quiz` checkpoint.

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number; // index of the correct option
  explain?: string;
}

export interface PracticeLink {
  label: string;
  to: string;   // route; "{symbol}" is replaced client-side with the last symbol
  hint: string;
}

export interface Lesson {
  id: string;             // stable, unique — the key used for progress tracking
  title: string;
  summary: string;
  minutes: number;        // estimated time
  materialId?: string;    // pull prose from materialsStore by this id
  content?: string;       // inline prose fallback (tool-literacy lessons)
  practice?: PracticeLink;
  quiz?: QuizQuestion[];
}

export interface LearningModule {
  id: string;
  title: string;
  icon: string;
  lessons: Lesson[];
}

export interface LearningPath {
  id: string;
  title: string;
  level: 'Pemula' | 'Menengah' | 'Lanjutan' | 'Profesi';
  goal: string;
  icon: string;
  accent: string;         // tailwind color token for the path (e.g. 'emerald')
  modules: LearningModule[];
}

export const CURRICULUM: LearningPath[] = [
  {
    id: 'pemula',
    title: 'Jalur Pemula — Fondasi Investor BEI',
    level: 'Pemula',
    goal: 'Dari nol memahami mekanisme bursa, cara menilai perusahaan, membaca grafik dasar, dan menjaga modal — siap membuka posisi pertama dengan sadar risiko.',
    icon: '🌱',
    accent: 'emerald',
    modules: [
      {
        id: 'pemula-pasar',
        title: 'Mengenal Pasar Modal',
        icon: '🏛️',
        lessons: [
          {
            id: 'l-intro-bei',
            materialId: 'intro-bei',
            title: 'Mekanisme Bursa: Lot, Fraksi, ARA/ARB & T+2',
            summary: 'Cara kerja BEI: satuan lot, fraksi harga, auto rejection, papan perdagangan, jam sesi, dan settlement.',
            minutes: 8,
            practice: {
              label: 'Buka Screening Saham',
              to: '/screening',
              hint: 'Lihat daftar emiten nyata BEI — perhatikan rentang harga & kelompoknya.',
            },
            quiz: [
              {
                q: '1 lot saham di BEI sama dengan berapa lembar?',
                options: ['10 lembar', '100 lembar', '500 lembar', '1.000 lembar'],
                answer: 1,
                explain: 'Sejak 2014, 1 lot = 100 lembar saham.',
              },
              {
                q: 'Settlement T+2 berarti hak dana/saham diselesaikan…',
                options: ['Hari yang sama', '1 hari kerja setelah transaksi', '2 hari kerja setelah transaksi', '2 minggu setelah transaksi'],
                answer: 2,
              },
              {
                q: 'Batas Auto Rejection untuk saham berharga di atas Rp 5.000 adalah…',
                options: ['35%', '25%', '20%', 'Tidak ada batas'],
                answer: 2,
                explain: 'Semakin tinggi harga, semakin kecil persen ARA/ARB: >Rp5.000 = 20%.',
              },
            ],
          },
        ],
      },
      {
        id: 'pemula-nilai',
        title: 'Menilai Perusahaan',
        icon: '💰',
        lessons: [
          {
            id: 'l-fundamental-ratios',
            materialId: 'fundamental-ratios',
            title: 'Rasio Fundamental: PER, PBV, ROE, DER, DY',
            summary: 'Lima rasio inti kesehatan emiten dan cara membaca valuasi murah/mahal.',
            minutes: 10,
            practice: {
              label: 'Lihat rasio live di Hub Analisa {symbol}',
              to: '/analisa/{symbol}',
              hint: 'Chip fundamental (PER/PBV/ROE/DY) di header adalah data live — bandingkan dengan teori.',
            },
            quiz: [
              {
                q: 'PER rendah (misal < 10x) umumnya menandakan…',
                options: ['Saham pasti mahal', 'Potensi undervalued atau bisnis sedang kontraksi', 'Perusahaan bangkrut', 'Dividen besar'],
                answer: 1,
              },
              {
                q: 'ROE > 15% konsisten menunjukkan…',
                options: ['Utang besar', 'Emiten berdaya saing tinggi (moat)', 'Harga saham murah', 'Likuiditas rendah'],
                answer: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'pemula-grafik',
        title: 'Membaca Grafik',
        icon: '📈',
        lessons: [
          {
            id: 'l-candlestick-sr',
            materialId: 'candlestick-sr',
            title: 'Candlestick, Tren & Support/Resistance',
            summary: 'Anatomi candle, struktur tren (HH/HL), dan menentukan level S/R yang valid.',
            minutes: 10,
            practice: {
              label: 'Buka Chart {symbol}',
              to: '/saham?symbol={symbol}',
              hint: 'Cari pola candle & level support/resistance pada grafik harian sungguhan.',
            },
            quiz: [
              {
                q: 'Uptrend dikonfirmasi oleh pola…',
                options: ['Lower High & Lower Low', 'Higher High & Higher Low', 'Doji berulang', 'Volume nol'],
                answer: 1,
              },
              {
                q: 'Saat resistance ditembus (breakout), level itu cenderung berubah menjadi…',
                options: ['Resistance lebih kuat', 'Support baru (role reversal)', 'Tidak berpengaruh', 'Garis tren turun'],
                answer: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'pemula-risiko',
        title: 'Menjaga Modal',
        icon: '🛡️',
        lessons: [
          {
            id: 'l-money-management',
            materialId: 'money-management',
            title: 'Money Management & Position Sizing',
            summary: 'Aturan risiko 1–2% per transaksi, menghitung lot dari stop loss, dan Risk-to-Reward.',
            minutes: 9,
            practice: {
              label: 'Coba kalkulator posisi di Hub Analisa {symbol}',
              to: '/analisa/{symbol}',
              hint: 'Bagian rencana trade ATR punya kalkulator ukuran posisi — masukkan modal & % risiko.',
            },
            quiz: [
              {
                q: 'Aturan umum kerugian maksimum per transaksi adalah…',
                options: ['1–2% dari total modal', '10% dari total modal', '50% dari total modal', 'Bebas tanpa batas'],
                answer: 0,
              },
              {
                q: 'Dengan RRR 1:2 dan win rate 40%, sistem trading secara matematis…',
                options: ['Pasti rugi', 'Tetap bisa profit konsisten', 'Impas selamanya', 'Tergantung berita'],
                answer: 1,
                explain: 'Expectancy = (0.4 × 2) − (0.6 × 1) = +0.2 → positif.',
              },
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'menengah',
    title: 'Jalur Menengah — Analis Mandiri',
    level: 'Menengah',
    goal: 'Membaca laporan keuangan, memadukan indikator teknikal, memanfaatkan pola musiman, dan mengelola portofolio secara terukur.',
    icon: '📊',
    accent: 'sky',
    modules: [
      {
        id: 'menengah-lapkeu',
        title: 'Membedah Laporan Keuangan',
        icon: '🧾',
        lessons: [
          {
            id: 'l-financial-analysis',
            materialId: 'financial-analysis',
            title: 'Neraca, Laba Rugi, Cash Flow & Red Flags',
            summary: 'Tiga laporan utama, kualitas laba (CFO/Net Income), dan mendeteksi tanda bahaya.',
            minutes: 12,
            practice: {
              label: 'Buka Chart & Keuangan {symbol}',
              to: '/saham?symbol={symbol}',
              hint: 'Telaah data keuangan emiten — cek apakah laba disokong arus kas operasi.',
            },
            quiz: [
              {
                q: 'Rasio kualitas laba yang sehat adalah CFO / Laba Bersih…',
                options: ['< 0', '> 1,0', 'Selalu = 0,5', 'Tidak relevan'],
                answer: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'menengah-indikator',
        title: 'Indikator & Momentum',
        icon: '📉',
        lessons: [
          {
            id: 'l-indicators',
            materialId: 'indicators-price-action',
            title: 'Moving Average, RSI, MACD & Smart Money',
            summary: 'EMA 20/50/200, RSI divergence, MACD histogram, plus dasar Order Block.',
            minutes: 11,
            practice: {
              label: 'Lihat grid indikator di Hub Analisa {symbol}',
              to: '/analisa/{symbol}',
              hint: 'Grid indikator menghitung RSI/MACD/ADX live — cocokkan sinyalnya dengan teori.',
            },
            quiz: [
              {
                q: 'Golden Cross terjadi saat…',
                options: ['EMA 50 memotong ke bawah EMA 200', 'EMA 50 memotong ke atas EMA 200', 'RSI menembus 70', 'Harga menyentuh support'],
                answer: 1,
              },
              {
                q: 'Bullish divergence: harga Lower Low sementara RSI…',
                options: ['Lower Low juga', 'Higher Low', 'Datar di 50', 'Overbought'],
                answer: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'menengah-musiman',
        title: 'Pola Musiman',
        icon: '🗓️',
        lessons: [
          {
            id: 'l-seasonal',
            materialId: 'seasonal-anomalies',
            title: 'Seasonality & Anomali Pasar BEI',
            summary: 'Window dressing, January effect, musim dividen, Sell in May, siklus komoditas.',
            minutes: 9,
            practice: {
              label: 'Buka analisis Pola Musiman {symbol}',
              to: '/seasonal?symbol={symbol}',
              hint: 'Halaman ini menghitung return bulanan 10 tahun + signifikansi t-stat — bukti empiris seasonality.',
            },
          },
        ],
      },
      {
        id: 'menengah-portofolio',
        title: 'Mengelola Portofolio',
        icon: '💼',
        lessons: [
          {
            id: 'l-portfolio-literacy',
            title: 'Diversifikasi, Korelasi & Risiko Portofolio',
            summary: 'Membaca alokasi, korelasi antar-holding, dan metrik risiko (volatilitas, VaR, drawdown) pada portofolio nyata.',
            minutes: 8,
            content: `### Dari Satu Saham ke Portofolio
Menganalisa satu saham saja tidak cukup — yang menentukan kekayaan jangka panjang adalah **komposisi portofolio** secara keseluruhan.

### Tiga Ukuran Risiko Portofolio
1. **Alokasi (Weight)**: berapa persen modal di tiap saham/sektor. Konsentrasi berlebih = risiko sistemik.
2. **Korelasi**: bila banyak holding bergerak searah (korelasi > 0,7), diversifikasi Anda semu — turun bareng saat pasar jatuh.
3. **Volatilitas & VaR**: seberapa besar potensi kerugian harian pada tingkat keyakinan 95%; plus *max drawdown* historis.

### Aturan Praktis
- Maksimal **15–20%** modal per satu saham.
- Maksimal **~30%** per sektor.
- Sisakan **10–20%** kas untuk peluang saat koreksi.

> Aplikasi ini menghitung valuasi, matriks korelasi, dan risiko portofolio Anda secara otomatis di halaman Portofolio.`,
            practice: {
              label: 'Buka Portofolio saya',
              to: '/portofolio',
              hint: 'Masukkan holding untuk melihat alokasi, heatmap korelasi, volatilitas, VaR & drawdown dihitung otomatis.',
            },
            quiz: [
              {
                q: 'Dua holding dengan korelasi > 0,7 berarti diversifikasi Anda…',
                options: ['Sangat kuat', 'Semu — keduanya cenderung turun bersamaan', 'Tidak berisiko', 'Bebas pajak'],
                answer: 1,
              },
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'lanjutan',
    title: 'Jalur Lanjutan — Strategi & Validasi',
    level: 'Lanjutan',
    goal: 'Melacak jejak smart money, memahami forecast probabilistik, memvalidasi strategi lewat backtest, dan berdisiplin dengan jurnal trading.',
    icon: '🎯',
    accent: 'violet',
    modules: [
      {
        id: 'lanjutan-bandar',
        title: 'Smart Money & Foreign Flow',
        icon: '🕵️',
        lessons: [
          {
            id: 'l-bandarmologi',
            materialId: 'bandarmologi-foreign',
            title: 'Bandarmologi & Aliran Dana Asing',
            summary: 'Membaca broker summary, siklus akumulasi–distribusi, dan korelasi foreign flow dengan IHSG.',
            minutes: 10,
            practice: {
              label: 'Buka halaman Pasar (Market Breadth)',
              to: '/pasar',
              hint: 'Amati regime pasar & rotasi sektor — konteks makro tempat smart money bergerak.',
            },
          },
        ],
      },
      {
        id: 'lanjutan-forecast',
        title: 'Forecast Probabilistik',
        icon: '🔮',
        lessons: [
          {
            id: 'l-forecast-literacy',
            title: 'Membaca Forecast dengan Jujur (Bukan Ramalan Pasti)',
            summary: 'Mengapa harga harian ≈ random walk, arti pita proyeksi ~80%, probabilitas arah, dan rezim volatilitas.',
            minutes: 9,
            content: `### Forecast ≠ Kepastian
Harga saham harian mendekati **random walk** — sangat sulit dikalahkan model apa pun. Karena itu forecast di aplikasi ini diposisikan sebagai **indikasi arah & rentang probabilistik**, bukan target harga pasti.

### Cara Membacanya
- **Pita proyeksi (~80%)**: rentang harga yang secara statistik menampung ~80% skenario, dihitung dari volatilitas terkini (EWMA). Pita lebar = ketidakpastian tinggi.
- **P(naik besok)**: peluang arah dari distribusi return — angka 55% berarti sedikit condong naik, bukan jaminan.
- **Rezim volatilitas**: membandingkan volatilitas sekarang vs median 1 tahun (rendah/normal/tinggi).
- **Selalu vs baseline**: model dibandingkan *naive/random walk*. Jika model tak mengalahkan baseline, sistem menampilkannya apa adanya — itu kejujuran, bukan kelemahan.

> Prinsip inti: percayai **proses & probabilitas**, bukan satu angka ajaib.`,
            practice: {
              label: 'Buka Forecast {symbol}',
              to: '/forecast?symbol={symbol}',
              hint: 'Perhatikan pita proyeksi, probabilitas arah, dan perbandingan model vs baseline naive.',
            },
            quiz: [
              {
                q: 'Pita proyeksi ~80% yang lebar menandakan…',
                options: ['Harga pasti naik', 'Ketidakpastian tinggi', 'Volatilitas nol', 'Sinyal jual'],
                answer: 1,
              },
              {
                q: 'Jika sebuah model tidak mengalahkan baseline naive, sistem sebaiknya…',
                options: ['Menyembunyikannya', 'Menampilkannya apa adanya (jujur)', 'Memaksa beli', 'Menghapus data'],
                answer: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'lanjutan-backtest',
        title: 'Validasi Strategi',
        icon: '🧪',
        lessons: [
          {
            id: 'l-backtest-literacy',
            title: 'Backtest Tanpa Menipu Diri (Anti Look-Ahead)',
            summary: 'Mengapa strategi wajib diuji pada data historis, aturan anti look-ahead, dan metrik jujur vs buy & hold IHSG.',
            minutes: 10,
            content: `### Kenapa Backtest?
Keyakinan bukan bukti. Sebuah strategi (mis. "skor teknikal ≥ 70") harus **dibuktikan** pada data historis sebelum dipercaya — atau ditunjukkan bahwa ia sekadar *noise*.

### Aturan Wajib: Tanpa Look-Ahead
- Sinyal di hari-*t* hanya boleh memakai data **≤ t** (tidak mengintip masa depan).
- Entry dieksekusi di harga **open t+1**, bukan close hari sinyal.
- **Biaya transaksi & slippage** dimodelkan — tanpa ini hasil backtest terlalu indah.

### Metrik yang Jujur
- **CAGR, Win Rate, Max Drawdown, Sharpe/Sortino**.
- **Selalu dibandingkan buy & hold IHSG** → hitung *alpha*. Kalau strategi kalah dari sekadar memegang indeks, ia tidak layak.

> Filosofi yang sama dengan forecasting: walk-forward, jujur terhadap baseline.`,
            practice: {
              label: 'Buka Backtest Strategi',
              to: '/backtest',
              hint: 'Jalankan strategi & bandingkan kurva ekuitas vs IHSG — perhatikan drawdown dan alpha.',
            },
            quiz: [
              {
                q: 'Aturan anti look-ahead mengharuskan sinyal hari-t memakai data…',
                options: ['Sampai hari t saja (≤ t)', 'Termasuk hari esok', 'Seluruh masa depan', 'Acak'],
                answer: 0,
              },
            ],
          },
        ],
      },
      {
        id: 'lanjutan-jurnal',
        title: 'Disiplin & Psikologi',
        icon: '🧠',
        lessons: [
          {
            id: 'l-trading-journal',
            materialId: 'trading-journal',
            title: 'Jurnal Trading, Playbook & Kontrol Bias',
            summary: 'Membangun sistem (setup), mencatat jurnal transaksi, dan menaklukkan bias psikologi.',
            minutes: 9,
            practice: {
              label: 'Simpan playbook di Materi Edukasi',
              to: '/edukasi',
              hint: 'Gunakan fitur catatan pribadi untuk menulis checklist & jurnal trading Anda sendiri.',
            },
            quiz: [
              {
                q: 'Solusi terbaik melawan bias Loss Aversion (enggan cut loss) adalah…',
                options: ['Menambah posisi (average down) tanpa rencana', 'Memakai automatic stop loss order', 'Menutup aplikasi', 'Menunggu tanpa batas'],
                answer: 1,
              },
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'wmi',
    title: 'Jalur Profesi — Wakil Manajer Investasi (WMI)',
    level: 'Profesi',
    goal: 'Persiapan izin profesi WMI (OJK): regulasi & kode etik, nilai waktu uang, valuasi saham & obligasi, teori portofolio & CAPM, hingga evaluasi kinerja — dilengkapi lembar kerja perhitungan yang lazim dipakai untuk lulus ujian.',
    icon: '🎓',
    accent: 'amber',
    modules: [
      {
        id: 'wmi-profesi',
        title: 'Profesi, Regulasi & Etika',
        icon: '🏛️',
        lessons: [
          {
            id: 'l-wmi-profesi',
            title: 'Mengenal Profesi WMI: Izin OJK, TICMI & Kode Etik',
            summary: 'Peran dan ruang lingkup Wakil Manajer Investasi, jalur sertifikasi, batasan investasi reksa dana, dan pilar kode etik.',
            minutes: 12,
            content: `### Apa itu Wakil Manajer Investasi (WMI)?
WMI adalah orang perseorangan yang mendapat **izin dari OJK** untuk bertindak mewakili Manajer Investasi mengelola portofolio efek untuk kepentingan nasabah (Kontrak Pengelolaan Dana / KPD) atau mengelola **Reksa Dana**. WMI adalah salah satu dari tiga izin wakil di pasar modal:
- **WMI** — pengelolaan portofolio/investasi (buy-side).
- **WPPE** (Wakil Perantara Pedagang Efek) — broker/dealer.
- **WPEE** (Wakil Penjamin Emisi Efek) — underwriting.

### Jalur Memperoleh Izin
1. **Lulus ujian standar profesi** yang diselenggarakan Panitia Standar Profesi (materi & pelatihan lazim melalui **TICMI** — The Indonesia Capital Market Institute).
2. **Mengajukan izin ke OJK** dengan bukti kelulusan + syarat administratif (tidak pernah dihukum tindak pidana keuangan, dsb).
3. Menjaga izin lewat **Program Pendidikan Berkelanjutan (PPL)**.

### Cakupan Ujian WMI (garis besar)
1. **Ekonomi, Keuangan & Analisis Investasi** — makroekonomi, nilai waktu uang, analisis laporan keuangan.
2. **Valuasi Efek** — saham (DDM, relatif), obligasi (harga, YTM, durasi).
3. **Teori Portofolio & Manajemen Investasi** — Markowitz, CAPM, alokasi aset, diversifikasi.
4. **Evaluasi Kinerja & Manajemen Risiko** — Sharpe/Treynor/Jensen, VaR, benchmark.
5. **Reksa Dana** — jenis, NAB/Unit, biaya.
6. **Etika & Peraturan Pasar Modal** — UU Pasar Modal, POJK reksa dana, kode etik.

### Batasan Investasi Reksa Dana (contoh aturan wajib hafal)
- Maksimum **10%** NAB pada efek satu emiten (kecuali SBN).
- Maksimum **5%** NAB pada efek yang diterbitkan satu pihak untuk *money market*.
- Larangan konflik kepentingan & *front running*.

### Pilar Kode Etik WMI
- **Integritas & Objektivitas** — bebas benturan kepentingan.
- **Kehati-hatian (Prudent Man Rule)** — mengelola dana orang lain seperti dana sendiri yang berhati-hati.
- **Kerahasiaan** data nasabah.
- **Kepatuhan** pada hukum & peraturan.

> Prinsip inti WMI: **fidusia** — mendahulukan kepentingan nasabah di atas kepentingan pribadi/perusahaan.`,
            practice: {
              label: 'Lihat Cetak Biru Institusional WMI',
              to: '/pengembangan',
              hint: 'Halaman Arsitektur WMI merangkum 3 pilar pengelolaan reksa dana & guardrail portofolio institusional.',
            },
            quiz: [
              {
                q: 'WMI memperoleh izin resmi dari…',
                options: ['BEI', 'OJK', 'KSEI', 'TICMI'],
                answer: 1,
                explain: 'TICMI menyelenggarakan pelatihan/ujian; izin profesi diterbitkan OJK.',
              },
              {
                q: 'Batas maksimum investasi reksa dana pada efek satu emiten (non-SBN) umumnya…',
                options: ['5% NAB', '10% NAB', '25% NAB', 'Tanpa batas'],
                answer: 1,
              },
              {
                q: 'Prinsip fidusia mewajibkan WMI…',
                options: ['Mendahulukan kepentingan pribadi', 'Mendahulukan kepentingan nasabah', 'Menjamin untung pasti', 'Menghindari diversifikasi'],
                answer: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'wmi-ekonomi',
        title: 'Ekonomi & Nilai Waktu Uang',
        icon: '⏳',
        lessons: [
          {
            id: 'l-wmi-tvm',
            title: 'Nilai Waktu Uang (Time Value of Money) & Anuitas',
            summary: 'Konsep PV/FV, diskonto, anuitas, dan tingkat diskonto — fondasi seluruh valuasi.',
            minutes: 11,
            content: `### Prinsip Dasar
Uang Rp 1 hari ini bernilai lebih dari Rp 1 di masa depan karena bisa diinvestasikan. Seluruh valuasi (saham, obligasi, proyek) bermuara pada **mendiskonto arus kas masa depan** ke nilai sekarang.

### Rumus Inti
- **Future Value**: \`FV = PV × (1 + r)^n\`
- **Present Value**: \`PV = FV / (1 + r)^n\`
- **FV Anuitas (ordinary)**: \`FV = PMT × [((1+r)^n − 1) / r]\`
- **PV Anuitas (ordinary)**: \`PV = PMT × [(1 − (1+r)^-n) / r]\`
- **Perpetuitas**: \`PV = PMT / r\`

di mana *r* = tingkat bunga/diskonto per periode, *n* = jumlah periode, *PMT* = pembayaran berkala.

### Tingkat Diskonto (Discount Rate)
Semakin tinggi risiko/inflasi, semakin tinggi *r* → nilai sekarang arus kas masa depan makin kecil. Inilah mengapa saat suku bunga acuan naik, valuasi aset cenderung turun.

> Gunakan **Lembar Kerja Nilai Waktu Uang** untuk latihan hitung PV/FV & anuitas seperti soal ujian.`,
            practice: {
              label: 'Buka Lembar Kerja: Nilai Waktu Uang',
              to: '/belajar/lembar-kerja#tvm',
              hint: 'Hitung FV, PV, dan anuitas secara interaktif.',
            },
            quiz: [
              {
                q: 'Bila tingkat diskonto naik, nilai sekarang (PV) arus kas masa depan…',
                options: ['Naik', 'Turun', 'Tetap', 'Menjadi nol'],
                answer: 1,
              },
              {
                q: 'PV dari perpetuitas Rp 100/tahun pada r = 10% adalah…',
                options: ['Rp 100', 'Rp 1.000', 'Rp 10.000', 'Tak terhingga'],
                answer: 1,
                explain: 'PV = PMT / r = 100 / 0,10 = 1.000.',
              },
            ],
          },
        ],
      },
      {
        id: 'wmi-valuasi',
        title: 'Valuasi Efek',
        icon: '🧮',
        lessons: [
          {
            id: 'l-wmi-valuasi-saham',
            title: 'Valuasi Saham: Dividend Discount Model (Gordon Growth)',
            summary: 'Menghitung nilai wajar saham dari dividen & pertumbuhan, plus PER justified.',
            minutes: 10,
            content: `### Dividend Discount Model (DDM)
Nilai saham = present value dari seluruh dividen masa depan.

### Model Pertumbuhan Konstan (Gordon Growth)
Bila dividen tumbuh konstan sebesar *g* selamanya:
\`\`\`
P0 = D1 / (r − g)
D1 = D0 × (1 + g)
\`\`\`
- **P0** = nilai wajar saham hari ini
- **D0** = dividen terakhir dibayar; **D1** = dividen tahun depan
- **r** = tingkat pengembalian disyaratkan (dari CAPM)
- **g** = pertumbuhan dividen (syarat: **g < r**)

### PER Justified (Turunan)
\`PER wajar = (D1/EPS1) / (r − g)\` = *payout ratio* / (r − g). Berguna membandingkan dengan PER pasar: bila PER pasar < PER justified → berpotensi *undervalued*.

### Keterbatasan
Sensitif terhadap asumsi *g* dan *r*; tidak cocok untuk emiten tanpa dividen atau pertumbuhan tak stabil (pakai FCF/relatif).

> Latih di **Lembar Kerja Valuasi Saham (Gordon Growth)** lalu bandingkan dengan harga & PER live di Hub Analisa.`,
            practice: {
              label: 'Buka Lembar Kerja: Valuasi Saham',
              to: '/belajar/lembar-kerja#gordon',
              hint: 'Masukkan D0, g, dan r untuk mendapat nilai wajar P0 & PER justified.',
            },
            quiz: [
              {
                q: 'Syarat agar model Gordon Growth valid adalah…',
                options: ['g > r', 'g = r', 'g < r', 'g = 0 selalu'],
                answer: 2,
              },
              {
                q: 'Saham dengan D1 = Rp 200, r = 12%, g = 4%. Nilai wajar P0 ≈…',
                options: ['Rp 1.667', 'Rp 2.500', 'Rp 5.000', 'Rp 800'],
                answer: 1,
                explain: 'P0 = 200 / (0,12 − 0,04) = 200 / 0,08 = 2.500.',
              },
            ],
          },
          {
            id: 'l-wmi-valuasi-obligasi',
            title: 'Valuasi Obligasi: Harga, YTM, Durasi & Konveksitas',
            summary: 'Menghitung harga obligasi dari kupon & yield, current yield, serta durasi Macaulay/modified.',
            minutes: 12,
            content: `### Harga Obligasi = PV Seluruh Arus Kas
\`\`\`
Harga = Σ [ Kupon / (1+y)^t ]  +  Nilai Nominal / (1+y)^n
\`\`\`
- **Kupon** = tingkat kupon × nilai nominal
- **y** = yield to maturity (per periode); **n** = jumlah periode

### Hubungan Harga & Yield (WAJIB paham)
- **y > kupon** → harga di **bawah** par (*discount*).
- **y = kupon** → harga **sama** dengan par.
- **y < kupon** → harga di **atas** par (*premium*).
- Harga dan yield **bergerak berlawanan arah**.

### Ukuran Imbal Hasil
- **Current Yield** = Kupon tahunan / Harga pasar.
- **YTM** = yield yang menyamakan PV arus kas dengan harga pasar (dicari iteratif).

### Durasi & Risiko Suku Bunga
- **Durasi Macaulay** = rata-rata tertimbang waktu penerimaan arus kas.
- **Durasi Modified** = Macaulay / (1 + y) → **estimasi % perubahan harga** untuk perubahan yield 1%.
  \`ΔHarga% ≈ − Durasi Modified × Δy\`
- **Konveksitas** mengoreksi estimasi durasi untuk perubahan yield besar (hubungan harga-yield melengkung, bukan lurus).

> Gunakan **Lembar Kerja Valuasi Obligasi** untuk menghitung harga, current yield, dan durasi.`,
            practice: {
              label: 'Buka Lembar Kerja: Valuasi Obligasi',
              to: '/belajar/lembar-kerja#bond',
              hint: 'Hitung harga obligasi, current yield, dan durasi Macaulay/modified.',
            },
            quiz: [
              {
                q: 'Jika YTM > tingkat kupon, obligasi diperdagangkan…',
                options: ['Di atas par (premium)', 'Sama dengan par', 'Di bawah par (discount)', 'Tanpa harga'],
                answer: 2,
              },
              {
                q: 'Durasi modified 5 dan yield naik 1%, harga obligasi kira-kira…',
                options: ['Naik 5%', 'Turun 5%', 'Tetap', 'Turun 1%'],
                answer: 1,
                explain: 'ΔHarga% ≈ −DurasiMod × Δy = −5 × 1% = −5%.',
              },
            ],
          },
        ],
      },
      {
        id: 'wmi-portofolio',
        title: 'Teori Portofolio & CAPM',
        icon: '📊',
        lessons: [
          {
            id: 'l-wmi-portfolio-theory',
            title: 'Teori Portofolio Markowitz & Diversifikasi',
            summary: 'Return & risiko portofolio, peran korelasi, dan efficient frontier.',
            minutes: 11,
            content: `### Return & Risiko Portofolio 2 Aset
\`\`\`
E(Rp) = w1·E(R1) + w2·E(R2)
σp²   = w1²σ1² + w2²σ2² + 2·w1·w2·ρ12·σ1·σ2
\`\`\`
- **w** = bobot; **σ** = deviasi standar (risiko); **ρ12** = korelasi antar aset.

### Kunci Diversifikasi
Risiko portofolio **lebih kecil** dari rata-rata tertimbang risiko masing-masing aset **selama ρ < 1**. Semakin rendah (apalagi negatif) korelasi, semakin besar manfaat diversifikasi.

### Efficient Frontier & Portofolio Optimal
- **Efficient frontier** = kumpulan portofolio dengan return tertinggi pada tiap tingkat risiko.
- Menambahkan **aset bebas risiko (Rf)** menghasilkan **Capital Market Line (CML)**; titik singgungnya = **portofolio pasar (market portfolio)**.

### Risiko Sistematis vs Tidak Sistematis
- **Tidak sistematis** (spesifik emiten) → bisa dihilangkan lewat diversifikasi.
- **Sistematis** (pasar) → tidak bisa didiversifikasi, diukur oleh **beta (β)**.

> Latih di **Lembar Kerja Portofolio 2 Aset**, lalu lihat matriks korelasi & risiko portofolio nyata Anda di halaman Portofolio.`,
            practice: {
              label: 'Buka Lembar Kerja: Portofolio 2 Aset',
              to: '/belajar/lembar-kerja#portfolio2',
              hint: 'Ubah bobot & korelasi untuk melihat efek diversifikasi pada risiko portofolio.',
            },
            quiz: [
              {
                q: 'Manfaat diversifikasi paling besar ketika korelasi antar aset…',
                options: ['= +1', 'Mendekati 0 atau negatif', 'Selalu positif tinggi', 'Tidak berpengaruh'],
                answer: 1,
              },
              {
                q: 'Risiko yang TIDAK bisa dihilangkan lewat diversifikasi disebut…',
                options: ['Risiko tidak sistematis', 'Risiko spesifik', 'Risiko sistematis (pasar)', 'Risiko likuiditas'],
                answer: 2,
              },
            ],
          },
          {
            id: 'l-wmi-capm',
            title: 'CAPM, Beta & Security Market Line (SML)',
            summary: 'Menghitung tingkat pengembalian disyaratkan dari beta & premi risiko pasar.',
            minutes: 10,
            content: `### Capital Asset Pricing Model
\`\`\`
E(R) = Rf + β × (Rm − Rf)
\`\`\`
- **Rf** = tingkat bebas risiko (mis. yield SBN).
- **Rm** = ekspektasi return pasar (IHSG).
- **(Rm − Rf)** = **premi risiko pasar** (*market risk premium*).
- **β (beta)** = sensitivitas aset terhadap pergerakan pasar.

### Membaca Beta
- **β = 1** → bergerak seiring pasar.
- **β > 1** → lebih agresif/volatil dari pasar.
- **β < 1** → lebih defensif.
- **β < 0** → berlawanan arah pasar (langka).

### Security Market Line (SML)
Garis yang memetakan E(R) terhadap β. Saham **di atas SML** → *undervalued* (return ditawarkan > yang disyaratkan); **di bawah SML** → *overvalued*.

### Pemakaian
Output CAPM (*r*) menjadi input **tingkat diskonto** untuk DDM/valuasi — menyambungkan teori portofolio dengan valuasi.

> Hitung E(R) di **Lembar Kerja CAPM/SML** dan pakai hasilnya sebagai *r* di lembar kerja valuasi saham.`,
            practice: {
              label: 'Buka Lembar Kerja: CAPM / SML',
              to: '/belajar/lembar-kerja#capm',
              hint: 'Masukkan Rf, Rm, dan beta untuk mendapat tingkat pengembalian disyaratkan.',
            },
            quiz: [
              {
                q: 'Saham dengan β = 1,5; Rf = 6%; Rm = 12%. E(R) menurut CAPM =…',
                options: ['12%', '15%', '18%', '9%'],
                answer: 1,
                explain: 'E(R) = 6% + 1,5 × (12% − 6%) = 6% + 9% = 15%.',
              },
              {
                q: 'Saham yang berada DI ATAS Security Market Line dinilai…',
                options: ['Overvalued', 'Undervalued', 'Wajar (fair)', 'Tidak bisa dinilai'],
                answer: 1,
              },
            ],
          },
        ],
      },
      {
        id: 'wmi-kinerja',
        title: 'Evaluasi Kinerja & Reksa Dana',
        icon: '💼',
        lessons: [
          {
            id: 'l-wmi-kinerja',
            title: 'Evaluasi Kinerja: Sharpe, Treynor, Jensen & NAB Reksa Dana',
            summary: 'Mengukur kinerja disesuaikan risiko dan menghitung Nilai Aktiva Bersih per unit.',
            minutes: 12,
            content: `### Kinerja Disesuaikan Risiko (Risk-Adjusted Return)
Return mentah menyesatkan tanpa memperhitungkan risiko. Tiga ukuran wajib WMI:
\`\`\`
Sharpe  = (Rp − Rf) / σp        → per unit risiko TOTAL (deviasi standar)
Treynor = (Rp − Rf) / βp        → per unit risiko SISTEMATIS (beta)
Jensen α = Rp − [Rf + βp(Rm − Rf)]  → return di atas ekspektasi CAPM
\`\`\`
- **Sharpe** cocok untuk portofolio yang belum terdiversifikasi penuh (pakai risiko total).
- **Treynor** cocok bila portofolio bagian dari portofolio besar yang terdiversifikasi (pakai beta).
- **Jensen's Alpha > 0** → manajer menambah nilai (*outperform* setelah disesuaikan risiko).
- **Information Ratio** = (Rp − Rbenchmark) / tracking error → konsistensi alpha.

### Nilai Aktiva Bersih (NAB / NAV) Reksa Dana
\`\`\`
NAB = Total Nilai Pasar Aset − Total Kewajiban
NAB per Unit (NAB/UP) = NAB / Jumlah Unit Penyertaan beredar
\`\`\`
- Harga beli/jual investor mengacu **NAB/UP** akhir hari.
- **Unit diperoleh** = Dana investasi / NAB/UP (setelah biaya pembelian bila ada).
- **Expense Ratio** = total biaya / rata-rata NAB → makin rendah makin baik.

> Gunakan **Lembar Kerja Evaluasi Kinerja** & **Lembar Kerja NAB Reksa Dana**, lalu bandingkan dengan Sharpe/risiko portofolio nyata Anda.`,
            practice: {
              label: 'Buka Lembar Kerja: Evaluasi Kinerja & NAB',
              to: '/belajar/lembar-kerja#performance',
              hint: 'Hitung Sharpe/Treynor/Jensen dan NAB per unit reksa dana.',
            },
            quiz: [
              {
                q: 'Ukuran kinerja yang memakai risiko SISTEMATIS (beta) adalah…',
                options: ['Sharpe Ratio', 'Treynor Ratio', 'Standard deviation', 'Current yield'],
                answer: 1,
              },
              {
                q: 'Alpha Jensen yang positif berarti portofolio…',
                options: ['Kalah dari ekspektasi CAPM', 'Sesuai ekspektasi CAPM', 'Mengalahkan ekspektasi CAPM (menambah nilai)', 'Tidak berisiko'],
                answer: 2,
              },
              {
                q: 'NAB per Unit dihitung dari…',
                options: ['Total aset ÷ jumlah unit', '(Total aset − kewajiban) ÷ jumlah unit penyertaan', 'Kewajiban ÷ unit', 'Return ÷ risiko'],
                answer: 1,
              },
            ],
          },
        ],
      },
    ],
  },
];

// ---- Derived helpers (pure) ----

export function allLessons(): Lesson[] {
  return CURRICULUM.flatMap((p) => p.modules.flatMap((m) => m.lessons));
}

export function totalLessonCount(): number {
  return allLessons().length;
}

export function findLesson(lessonId: string): {
  path: LearningPath;
  module: LearningModule;
  lesson: Lesson;
} | null {
  for (const path of CURRICULUM) {
    for (const module of path.modules) {
      const lesson = module.lessons.find((l) => l.id === lessonId);
      if (lesson) return { path, module, lesson };
    }
  }
  return null;
}

// Flat ordered lesson ids for prev/next navigation.
export function orderedLessonIds(): string[] {
  return allLessons().map((l) => l.id);
}
