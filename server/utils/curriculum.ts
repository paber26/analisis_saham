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

// A Program groups one or more paths under a named track/certification.
export interface Program {
  id: string;
  title: string;
  short: string;                       // sidebar/nav short name (e.g. "WMI")
  category: 'Fondasi' | 'Sertifikasi';
  provider: string;                    // issuing body / origin
  icon: string;
  accent: string;                      // tailwind color token
  blurb: string;
  status: 'aktif' | 'pengembangan';    // content maturity flag
  paths: LearningPath[];
}

// Base paths (grouped into Programs further below).
const BASE_PATHS: LearningPath[] = [
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

// ======================================================================
// Certification programs (CFA / CTA / CSA)
// Faithful syllabus scaffolds with a genuine intro lesson per topic area.
// Depth is grown over time — including materials the user summarizes in.
// ======================================================================

const CFA_PATH: LearningPath = {
  id: 'cfa-l1',
  title: 'CFA Program — Level I',
  level: 'Profesi',
  goal: 'Ikhtisar 10 area topik CFA Level I: dari Etika hingga Manajemen Portofolio, sebagai peta belajar dan tempat merangkum materi lebih dalam.',
  icon: '📘',
  accent: 'sky',
  modules: [
    {
      id: 'cfa-ethics', title: 'Ethical & Professional Standards', icon: '⚖️',
      lessons: [{
        id: 'l-cfa-ethics', title: 'Kode Etik & Standar Perilaku Profesional', minutes: 12,
        summary: 'Enam komponen Kode Etik CFA dan tujuh Standar Perilaku Profesional yang menjadi fondasi ujian.',
        content: `### Mengapa Etika = Bobot Terbesar
Etika adalah salah satu area berbobot tertinggi di Level I dan sering menentukan kelulusan (*ethics adjustment*).

### Kode Etik (Code of Ethics)
Bertindak dengan **integritas, kompetensi, kehati-hatian, hormat**, dan mendahulukan integritas pasar modal serta kepentingan klien di atas kepentingan pribadi.

### Tujuh Standar Perilaku Profesional (Standards of Professional Conduct)
1. **Professionalism** — pengetahuan hukum, independensi & objektivitas, misrepresentasi, misconduct.
2. **Integrity of Capital Markets** — material nonpublic information, market manipulation.
3. **Duties to Clients** — loyalitas/kehati-hatian, fair dealing, suitability, performance presentation, kerahasiaan.
4. **Duties to Employers** — loyalitas, additional compensation, tanggung jawab supervisor.
5. **Investment Analysis & Recommendations** — diligence, komunikasi, retensi catatan.
6. **Conflicts of Interest** — disclosure, prioritas transaksi, referral fees.
7. **Responsibilities as a CFA Member/Candidate.**

> Kunci ujian: kenali pelanggaran spesifik pada studi kasus, bukan sekadar hafal judul standar.`,
        quiz: [
          { q: 'Informasi material nonpublik masuk ke standar…', options: ['Professionalism', 'Integrity of Capital Markets', 'Duties to Employers', 'Conflicts of Interest'], answer: 1 },
          { q: 'Mendahulukan kepentingan klien di atas kepentingan pribadi adalah bagian dari…', options: ['Kode Etik & Duties to Clients', 'Derivatif', 'Ekonomi', 'Quant'], answer: 0 },
        ],
      }],
    },
    {
      id: 'cfa-quant', title: 'Quantitative Methods', icon: '📐',
      lessons: [{
        id: 'l-cfa-quant', title: 'Time Value of Money, Statistik & Probabilitas', minutes: 11,
        summary: 'TVM, ukuran pemusatan & sebaran, distribusi, sampling, dan dasar regresi.',
        content: `### Cakupan
- **Time Value of Money** — PV/FV, anuitas, NPV & IRR.
- **Statistik deskriptif** — mean, median, varians, skewness, kurtosis.
- **Probabilitas** — ekspektasi, kovarians, Bayes.
- **Distribusi** — normal, lognormal, Student-t; *confidence interval*.
- **Sampling & hipotesis** — central limit theorem, uji-t/z, p-value.
- **Regresi linear** sederhana.

### Fokus Level I
Perhitungan TVM dan interpretasi statistik dominan. Kuasai kalkulator finansial (BA II Plus).

> Latih inti TVM di Lembar Kerja WMI (#tvm) — konsepnya identik.`,
        practice: { label: 'Latihan TVM di Lembar Kerja', to: '/belajar/lembar-kerja#tvm', hint: 'PV/FV & anuitas sama persis dengan materi Quant CFA.' },
      }],
    },
    {
      id: 'cfa-econ', title: 'Economics', icon: '🌐',
      lessons: [{
        id: 'l-cfa-econ', title: 'Mikro, Makro, Siklus Bisnis & Nilai Tukar', minutes: 10,
        summary: 'Permintaan-penawaran, struktur pasar, agregat makro, kebijakan moneter/fiskal, dan kurs.',
        content: `### Mikroekonomi
Elastisitas, teori produksi & biaya, struktur pasar (persaingan sempurna → monopoli).

### Makroekonomi
PDB, agregat demand/supply, **siklus bisnis**, inflasi & pengangguran, **kebijakan moneter & fiskal**.

### Ekonomi Internasional
Perdagangan, neraca pembayaran, rezim & penentuan **nilai tukar** (paritas suku bunga & daya beli).

> Hubungkan ke pasar riil: rezim makro menentukan *market regime* — lihat halaman Pasar di aplikasi analisis.`,
        practice: { label: 'Lihat Market Regime (Pasar)', to: '/pasar', hint: 'Konteks makro tempat teori ekonomi bertemu data BEI.' },
      }],
    },
    {
      id: 'cfa-fra', title: 'Financial Statement Analysis', icon: '🧾',
      lessons: [{
        id: 'l-cfa-fra', title: 'Membaca & Menganalisis 3 Laporan Keuangan', minutes: 12,
        summary: 'Income statement, balance sheet, cash flow, kualitas laba, dan analisis rasio.',
        content: `### Tiga Laporan
- **Income Statement** — revenue → net income (accrual).
- **Balance Sheet** — aset, liabilitas, ekuitas.
- **Cash Flow** — CFO/CFI/CFF; rekonsiliasi laba ke kas.

### Analisis
- **Rasio**: aktivitas, likuiditas, solvabilitas, profitabilitas, valuasi — plus **DuPont** (ROE).
- **Kualitas laba**: CFO vs net income; deteksi *earnings manipulation*.
- **Inventory (FIFO/LIFO)**, depresiasi, pajak tangguhan, lease.

> Terapkan di data emiten nyata: buka Chart & Keuangan sebuah saham BEI.`,
        practice: { label: 'Buka Chart & Keuangan', to: '/saham?symbol=BBCA', hint: 'Analisis laporan keuangan emiten sungguhan.' },
      }],
    },
    {
      id: 'cfa-corp', title: 'Corporate Issuers', icon: '🏢',
      lessons: [{
        id: 'l-cfa-corp', title: 'Tata Kelola, Struktur Modal & Capital Budgeting', minutes: 9,
        summary: 'Governance & stakeholder, WACC, capital budgeting (NPV/IRR), dan struktur modal.',
        content: `### Topik Inti
- **Corporate governance** & analisis pemangku kepentingan.
- **Capital budgeting** — NPV, IRR, payback; keputusan investasi.
- **Cost of capital** — WACC, biaya utang & ekuitas.
- **Leverage** operasional & finansial; struktur modal (Modigliani-Miller sebagai kerangka).
- **Working capital** management.

> WACC memakai *cost of equity* dari CAPM — jembatan ke topik Equity & Portfolio.`,
      }],
    },
    {
      id: 'cfa-equity', title: 'Equity Investments', icon: '📊',
      lessons: [{
        id: 'l-cfa-equity', title: 'Pasar Ekuitas & Model Valuasi Saham', minutes: 10,
        summary: 'Efisiensi pasar, indeks, dan valuasi (DDM, multiplier, FCFE).',
        content: `### Cakupan
- **Struktur & efisiensi pasar** (weak/semi-strong/strong).
- **Indeks** ekuitas: konstruksi & bias.
- **Valuasi**: **DDM/Gordon**, *multiplier* (P/E, P/B, EV/EBITDA), pendekatan *free cash flow*.
- **Industry & company analysis** (Porter's five forces).

> Gordon Growth identik dengan Lembar Kerja WMI (#gordon); bandingkan output dengan PER live di Hub Analisa.`,
        practice: { label: 'Buka Hub Analisa', to: '/analisa/BBCA', hint: 'Cocokkan valuasi teori dengan rasio live emiten.' },
      }],
    },
    {
      id: 'cfa-fi', title: 'Fixed Income', icon: '🏦',
      lessons: [{
        id: 'l-cfa-fi', title: 'Obligasi: Harga, Yield, Durasi & Risiko Kredit', minutes: 11,
        summary: 'Fitur obligasi, penetapan harga, kurva yield, durasi/konveksitas, dan risiko kredit.',
        content: `### Topik Inti
- **Fitur & jenis** obligasi; pasar penerbitan.
- **Penetapan harga** = PV arus kas; hubungan harga–yield.
- **Yield**: current yield, YTM, spot/forward.
- **Risiko suku bunga**: **durasi Macaulay/modified, konveksitas**.
- **Risiko kredit**: rating, spread, recovery.
- **Sekuritisasi** (ABS/MBS) dasar.

> Latih harga & durasi di Lembar Kerja WMI (#bond).`,
        practice: { label: 'Latihan Valuasi Obligasi', to: '/belajar/lembar-kerja#bond', hint: 'Harga, current yield, dan durasi identik materi CFA Fixed Income.' },
      }],
    },
    {
      id: 'cfa-deriv', title: 'Derivatives', icon: '🔀',
      lessons: [{
        id: 'l-cfa-deriv', title: 'Forward, Futures, Opsi & Swap', minutes: 9,
        summary: 'Karakteristik derivatif, penetapan harga dasar, dan penggunaan hedging.',
        content: `### Cakupan
- **Forward & futures** — mekanisme, marking-to-market, *cost of carry*.
- **Opsi** — call/put, payoff, *put-call parity*, faktor penentu harga (dasar Black-Scholes).
- **Swap** — arus kas, penggunaan.
- **Arbitrase & replikasi** sebagai prinsip penetapan harga.

> Fokus Level I: intuisi payoff & no-arbitrage, bukan matematika berat.`,
      }],
    },
    {
      id: 'cfa-alt', title: 'Alternative Investments', icon: '🏗️',
      lessons: [{
        id: 'l-cfa-alt', title: 'Real Estate, PE, Hedge Fund & Komoditas', minutes: 8,
        summary: 'Karakteristik aset alternatif, struktur biaya, dan peran diversifikasi.',
        content: `### Kelas Aset
- **Private equity & venture capital**, **hedge funds** (strategi & biaya "2 dan 20"), **real estate**, **komoditas**, **infrastruktur**.
- **Karakteristik**: likuiditas rendah, biaya tinggi, potensi diversifikasi & *return* non-korelasi.
- **Isu**: valuasi, *survivorship/backfill bias* pada data.

> Peran utama dalam portofolio: diversifikasi terhadap saham/obligasi tradisional.`,
      }],
    },
    {
      id: 'cfa-pm', title: 'Portfolio Management', icon: '💼',
      lessons: [{
        id: 'l-cfa-pm', title: 'Proses Portofolio, Teori Pasar Modal & Risiko', minutes: 10,
        summary: 'IPS, teori portofolio, CAPM/SML, dan manajemen risiko.',
        content: `### Proses
- **Investment Policy Statement (IPS)** — tujuan (return/risiko) & batasan (likuiditas, horizon, pajak, hukum, unik).
- **Teori portofolio**: efficient frontier, **CML**, diversifikasi.
- **CAPM & SML**, beta, risiko sistematis vs tidak sistematis.
- **Manajemen risiko**: pengukuran, alokasi, rebalancing.

> CAPM & portofolio 2-aset dapat dilatih di Lembar Kerja WMI (#capm, #portfolio2) dan diamati di halaman Portofolio.`,
        practice: { label: 'Buka Portofolio', to: '/portofolio', hint: 'Alokasi, korelasi & risiko portofolio nyata Anda.' },
      }],
    },
  ],
};

const CTA_PATH: LearningPath = {
  id: 'cta-core',
  title: 'Certified Technical Analyst — Inti',
  level: 'Profesi',
  goal: 'Pendalaman analisis teknikal tingkat profesional: teori Dow, pola & tren, indikator, Elliott/Fibonacci, hingga desain sistem & manajemen risiko.',
  icon: '📈',
  accent: 'violet',
  modules: [
    {
      id: 'cta-dow', title: 'Teori Dow & Filosofi Teknikal', icon: '📜',
      lessons: [{
        id: 'l-cta-dow', title: 'Fondasi Analisis Teknikal & Teori Dow', minutes: 9,
        summary: 'Tiga premis teknikal, enam prinsip Teori Dow, dan peran volume.',
        content: `### Tiga Premis Analisis Teknikal
1. **Harga mendiskon segalanya** (market action discounts everything).
2. **Harga bergerak dalam tren.**
3. **Sejarah berulang** (psikologi pasar konstan).

### Enam Prinsip Teori Dow
Indeks mendiskon semua · pasar punya tiga tren (primer/sekunder/minor) · tren primer tiga fase (akumulasi–partisipasi–distribusi) · indeks harus saling konfirmasi · **volume mengonfirmasi tren** · tren berlaku sampai sinyal pembalikan jelas.

> Fondasi ini menghubungkan seluruh modul CTA berikutnya.`,
        practice: { label: 'Amati tren di Chart', to: '/saham?symbol=BBCA', hint: 'Identifikasi fase tren & konfirmasi volume pada grafik nyata.' },
      }],
    },
    {
      id: 'cta-pattern', title: 'Analisis Tren & Pola Harga', icon: '📐',
      lessons: [{
        id: 'l-cta-pattern', title: 'Garis Tren, Pola Pembalikan & Kelanjutan', minutes: 10,
        summary: 'Support/resistance, channel, head & shoulders, triangle, flag, dan target proyeksi.',
        content: `### Struktur & Level
Garis tren, channel, **support/resistance**, dan *role reversal*.

### Pola Pembalikan (Reversal)
Head & Shoulders (+ inverse), double/triple top-bottom, rounding.

### Pola Kelanjutan (Continuation)
Triangle (symmetrical/ascending/descending), flag, pennant, rectangle.

### Pengukuran Target
Tinggi pola diproyeksikan dari titik breakout untuk estimasi target harga; konfirmasi dengan volume.

> Hub Analisa aplikasi mengklaster support/resistance ber-ATR secara otomatis.`,
        practice: { label: 'Lihat level S/R otomatis', to: '/analisa/BBCA', hint: 'Bandingkan level algoritmik dengan pola manual Anda.' },
      }],
    },
    {
      id: 'cta-indicator', title: 'Indikator & Osilator', icon: '📉',
      lessons: [{
        id: 'l-cta-indicator', title: 'Moving Average, Momentum & Volume', minutes: 10,
        summary: 'MA/EMA, RSI, MACD, stochastic, Bollinger Bands, divergence, dan indikator volume.',
        content: `### Kategori Indikator
- **Tren**: MA/EMA, MACD, ADX.
- **Momentum/Osilator**: RSI, Stochastic, CCI — kondisi *overbought/oversold* & **divergence**.
- **Volatilitas**: Bollinger Bands, ATR.
- **Volume**: OBV, volume profile.

### Prinsip Pemakaian
Gabungkan indikator yang **saling melengkapi** (tren + momentum), hindari redundansi. Sinyal terbaik = konfluensi beberapa alat + struktur harga.

> Grid indikator Hub Analisa menghitung RSI/MACD/ADX/BB/ATR live.`,
        practice: { label: 'Buka grid indikator', to: '/analisa/BBCA', hint: 'Cocokkan sinyal indikator dengan teori CTA.' },
      }],
    },
    {
      id: 'cta-elliott', title: 'Elliott Wave & Fibonacci', icon: '🌊',
      lessons: [{
        id: 'l-cta-elliott', title: 'Struktur Gelombang & Rasio Fibonacci', minutes: 9,
        summary: 'Pola 5-3 Elliott, aturan gelombang, dan retracement/extension Fibonacci.',
        content: `### Elliott Wave
Tren impulsif **5 gelombang** searah tren + koreksi **3 gelombang** (A-B-C). Aturan inti: gelombang 2 tak menembus awal 1; gelombang 3 bukan terpendek; gelombang 4 tak tumpang tindih 1.

### Fibonacci
- **Retracement**: 23,6% · 38,2% · 50% · 61,8% · 78,6% — area koreksi potensial.
- **Extension**: 127,2% · 161,8% — target proyeksi.

> Kombinasikan retracement Fibonacci dengan level S/R & Elliott untuk konfluensi.`,
      }],
    },
    {
      id: 'cta-system', title: 'Sistem Trading & Manajemen Risiko', icon: '🛡️',
      lessons: [{
        id: 'l-cta-system', title: 'Desain Sistem, Backtest & Position Sizing', minutes: 10,
        summary: 'Membangun aturan objektif, validasi backtest, expectancy, dan manajemen risiko.',
        content: `### Sistem yang Teruji
Aturan **entry/exit objektif**, lalu **backtest tanpa look-ahead** (sinyal ≤ t, entry t+1, biaya & slippage dimodelkan).

### Metrik
Win rate, **expectancy** = (WinRate×RRR) − (LossRate×1), max drawdown, Sharpe. Selalu banding **buy & hold IHSG**.

### Manajemen Risiko
Risiko 1–2% per posisi, *position sizing* dari stop, RRR ≥ 1:2.

> Uji strategi pada data BEI nyata di halaman Backtest.`,
        practice: { label: 'Buka Backtest Strategi', to: '/backtest', hint: 'Validasi sistem teknikal vs benchmark IHSG.' },
        quiz: [
          { q: 'Aturan anti look-ahead pada backtest berarti sinyal hari-t memakai data…', options: ['≤ t', 'Termasuk esok', 'Seluruh masa depan', 'Acak'], answer: 0 },
        ],
      }],
    },
  ],
};

const CSA_PATH: LearningPath = {
  id: 'csa-core',
  title: 'Certified Securities Analyst — Inti',
  level: 'Profesi',
  goal: 'Analisis efek tingkat lanjut ala CSA (TICMI): pendekatan top-down, laporan keuangan lanjutan, valuasi ekuitas (DCF/FCF), analisis fixed income, dan etika analis.',
  icon: '📗',
  accent: 'rose',
  modules: [
    {
      id: 'csa-topdown', title: 'Analisis Ekonomi & Industri (Top-Down)', icon: '🔭',
      lessons: [{
        id: 'l-csa-topdown', title: 'Pendekatan Top-Down: Makro → Sektor → Emiten', minutes: 9,
        summary: 'Menghubungkan siklus ekonomi, rotasi sektor, dan pemilihan emiten.',
        content: `### Kerangka Top-Down
1. **Makro** — siklus ekonomi, suku bunga, inflasi, nilai tukar.
2. **Industri/Sektor** — analisis **Porter's five forces**, siklus & sensitivitas sektor terhadap makro.
3. **Perusahaan** — posisi kompetitif, *moat*, kualitas manajemen.

### Rotasi Sektor
Tiap fase siklus memihak sektor berbeda (mis. defensif saat perlambatan, siklikal saat ekspansi).

> Lihat rotasi sektor & breadth pada halaman Pasar aplikasi.`,
        practice: { label: 'Lihat rotasi sektor (Pasar)', to: '/pasar', hint: 'Data breadth & kekuatan sektor BEI aktual.' },
      }],
    },
    {
      id: 'csa-fsa', title: 'Analisis Laporan Keuangan Lanjutan', icon: '🔬',
      lessons: [{
        id: 'l-csa-fsa', title: 'Kualitas Laba, Common-Size & Red Flags', minutes: 11,
        summary: 'Analisis vertikal/horizontal, DuPont, akrual, dan deteksi manipulasi.',
        content: `### Teknik
- **Common-size** (vertikal) & analisis tren (horizontal).
- **DuPont** bertingkat untuk membedah ROE.
- **Accruals ratio** & kualitas laba (CFO vs net income).

### Red Flags
Piutang/persediaan tumbuh melebihi penjualan, kapitalisasi biaya agresif, *related party*, pergantian auditor, arus kas operasi negatif kronis.

> Terapkan pada laporan keuangan emiten di menu Chart & Keuangan.`,
        practice: { label: 'Analisis keuangan emiten', to: '/saham?symbol=BBCA', hint: 'Uji kualitas laba pada emiten nyata.' },
      }],
    },
    {
      id: 'csa-equity', title: 'Valuasi Ekuitas (DCF & Relatif)', icon: '💵',
      lessons: [{
        id: 'l-csa-equity', title: 'FCFF/FCFE, DDM & Valuasi Relatif', minutes: 12,
        summary: 'Membangun model arus kas terdiskonto dan valuasi multiplier.',
        content: `### Absolute (DCF)
- **FCFF** = arus kas ke seluruh penyedia modal (didiskon dengan **WACC**).
- **FCFE** = arus kas ke pemegang saham (didiskon dengan *cost of equity*).
- **DDM/Gordon** untuk emiten dividen stabil; model dua/tiga tahap untuk pertumbuhan berubah.

### Relatif (Multiplier)
P/E, P/B, EV/EBITDA, PEG — bandingkan antar-peer & historis. Pahami *driver* tiap multiple.

### Terminal Value
Bagian terbesar nilai DCF → uji sensitivitas terhadap g & discount rate.

> Latih Gordon di Lembar Kerja (#gordon) & CAPM (#capm) untuk discount rate.`,
        practice: { label: 'Latihan valuasi saham', to: '/belajar/lembar-kerja#gordon', hint: 'Gordon Growth + CAPM = fondasi DCF.' },
        quiz: [
          { q: 'FCFF didiskon menggunakan…', options: ['Cost of equity', 'WACC', 'Risk-free rate', 'Dividend yield'], answer: 1 },
        ],
      }],
    },
    {
      id: 'csa-fi', title: 'Analisis Efek Pendapatan Tetap', icon: '🏦',
      lessons: [{
        id: 'l-csa-fi', title: 'Valuasi Obligasi, Kurva Yield & Risiko', minutes: 10,
        summary: 'Harga & yield, durasi/konveksitas, kurva imbal hasil, dan analisis kredit.',
        content: `### Inti
- **Harga = PV arus kas**; hubungan harga–yield terbalik.
- **Durasi & konveksitas** untuk risiko suku bunga.
- **Kurva yield** (normal/inverted) & implikasi ekonomi.
- **Analisis kredit**: rating, spread, *default & recovery*.

> Praktik hitung di Lembar Kerja Obligasi (#bond).`,
        practice: { label: 'Lembar Kerja Obligasi', to: '/belajar/lembar-kerja#bond', hint: 'Harga, current yield & durasi.' },
      }],
    },
    {
      id: 'csa-ethics', title: 'Etika & Standar Analis Efek', icon: '⚖️',
      lessons: [{
        id: 'l-csa-ethics', title: 'Independensi, Objektivitas & Konflik Kepentingan', minutes: 8,
        summary: 'Standar profesional analis, pengungkapan konflik, dan integritas riset.',
        content: `### Prinsip
- **Independensi & objektivitas** riset — bebas tekanan emiten/banking.
- **Pengungkapan konflik kepentingan** (kepemilikan, hubungan bisnis).
- **Basis wajar & memadai** untuk rekomendasi; retensi catatan.
- **Larangan** penyalahgunaan informasi material nonpublik & manipulasi pasar.

> Selaras dengan Kode Etik CFA & aturan OJK bagi analis/WMI.`,
      }],
    },
  ],
};

// ======================================================================
// PROGRAMS — top-level grouping consumed by the API & LMS pages.
// ======================================================================
export const PROGRAMS: Program[] = [
  {
    id: 'fondasi',
    title: 'Fondasi Saham BEI',
    short: 'Fondasi Saham',
    category: 'Fondasi',
    provider: 'Kurikulum Mandiri',
    icon: '🌱',
    accent: 'emerald',
    blurb: 'Dari nol hingga mahir: pemula, menengah, dan lanjutan — mekanisme bursa, fundamental, teknikal, hingga strategi & validasi.',
    status: 'aktif',
    paths: BASE_PATHS.filter((p) => ['pemula', 'menengah', 'lanjutan'].includes(p.id)),
  },
  {
    id: 'wmi',
    title: 'Wakil Manajer Investasi (WMI)',
    short: 'Sertifikasi WMI',
    category: 'Sertifikasi',
    provider: 'OJK / TICMI',
    icon: '🎓',
    accent: 'amber',
    blurb: 'Persiapan izin profesi WMI: regulasi & etika, valuasi, teori portofolio, CAPM, evaluasi kinerja — plus 7 lembar kerja perhitungan ujian.',
    status: 'aktif',
    paths: BASE_PATHS.filter((p) => p.id === 'wmi'),
  },
  {
    id: 'cfa',
    title: 'CFA Program — Level I',
    short: 'CFA Level I',
    category: 'Sertifikasi',
    provider: 'CFA Institute',
    icon: '📘',
    accent: 'sky',
    blurb: 'Peta 10 area topik CFA Level I dari Etika hingga Portfolio Management. Kerangka global untuk memperdalam ilmu.',
    status: 'pengembangan',
    paths: [CFA_PATH],
  },
  {
    id: 'cta',
    title: 'Certified Technical Analyst (CTA)',
    short: 'CTA — Teknikal',
    category: 'Sertifikasi',
    provider: 'Technical Analysis',
    icon: '📈',
    accent: 'violet',
    blurb: 'Analisis teknikal tingkat profesional: Teori Dow, pola & tren, indikator, Elliott/Fibonacci, hingga desain sistem trading.',
    status: 'pengembangan',
    paths: [CTA_PATH],
  },
  {
    id: 'csa',
    title: 'Certified Securities Analyst (CSA)',
    short: 'CSA — Analis Efek',
    category: 'Sertifikasi',
    provider: 'TICMI',
    icon: '📗',
    accent: 'rose',
    blurb: 'Analisis efek lanjutan: top-down, laporan keuangan mendalam, valuasi DCF/FCF, fixed income, dan etika analis.',
    status: 'pengembangan',
    paths: [CSA_PATH],
  },
];

// Backward-compatible flat path list (all programs' paths).
export const CURRICULUM: LearningPath[] = PROGRAMS.flatMap((p) => p.paths);

// ---- Derived helpers (pure) ----

export function allLessons(): Lesson[] {
  return CURRICULUM.flatMap((p) => p.modules.flatMap((m) => m.lessons));
}

export function totalLessonCount(): number {
  return allLessons().length;
}

export function findLesson(lessonId: string): {
  program: Program;
  path: LearningPath;
  module: LearningModule;
  lesson: Lesson;
} | null {
  for (const program of PROGRAMS) {
    for (const path of program.paths) {
      for (const module of path.modules) {
        const lesson = module.lessons.find((l) => l.id === lessonId);
        if (lesson) return { program, path, module, lesson };
      }
    }
  }
  return null;
}

export function findProgram(programId: string): Program | null {
  return PROGRAMS.find((p) => p.id === programId) ?? null;
}

// Flat ordered lesson ids for prev/next navigation (program → path → module).
export function orderedLessonIds(): string[] {
  return allLessons().map((l) => l.id);
}
