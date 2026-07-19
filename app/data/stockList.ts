// Single source of truth for the IDX stock selector shown on every page.
// Previously this ~60-line <optgroup> block was copy-pasted into 3 pages.

export interface StockOption {
  code: string;
  name: string;
}

export interface StockGroup {
  label: string;
  options: StockOption[];
}

export const STOCK_GROUPS: StockGroup[] = [
  {
    label: 'Perbankan & Keuangan',
    options: [
      { code: 'BBCA', name: 'Bank Central Asia Tbk' },
      { code: 'BBRI', name: 'Bank Rakyat Indonesia Tbk' },
      { code: 'BMRI', name: 'Bank Mandiri Tbk' },
      { code: 'BBNI', name: 'Bank Negara Indonesia Tbk' },
      { code: 'BBTN', name: 'Bank Tabungan Negara Tbk' }
    ]
  },
  {
    label: 'Energi & Tambang',
    options: [
      { code: 'ADRO', name: 'Adaro Energy Indonesia Tbk' },
      { code: 'PTBA', name: 'Bukit Asam Tbk' },
      { code: 'BUMI', name: 'Bumi Resources Tbk' },
      { code: 'MEDC', name: 'Medco Energi Internasional Tbk' },
      { code: 'HRUM', name: 'Harum Energy Tbk' }
    ]
  },
  {
    label: 'Infrastruktur & Telko',
    options: [
      { code: 'TLKM', name: 'Telkom Indonesia Tbk' },
      { code: 'ISAT', name: 'Indosat Ooredoo Hutchison Tbk' },
      { code: 'EXCL', name: 'XL Axiata Tbk' },
      { code: 'JSMR', name: 'Jasa Marga Tbk' },
      { code: 'PGAS', name: 'Perusahaan Gas Negara Tbk' }
    ]
  },
  {
    label: 'Konsumer & Ritel',
    options: [
      { code: 'UNVR', name: 'Unilever Indonesia Tbk' },
      { code: 'ICBP', name: 'Indofood CBP Sukses Makmur Tbk' },
      { code: 'INDF', name: 'Indofood Sukses Makmur Tbk' },
      { code: 'MYOR', name: 'Mayora Indah Tbk' },
      { code: 'ACES', name: 'Aspirasi Hidup Indonesia Tbk (Ace Hardware)' }
    ]
  },
  {
    label: 'Barang Baku & Logam',
    options: [
      { code: 'ANTM', name: 'Aneka Tambang Tbk' },
      { code: 'INCO', name: 'Vale Indonesia Tbk' },
      { code: 'TPIA', name: 'Chandra Asri Pacific Tbk' },
      { code: 'KRAS', name: 'Krakatau Steel Tbk' },
      { code: 'MDKA', name: 'Merdeka Gold Copper Tbk' }
    ]
  },
  {
    label: 'Industri & Otomotif',
    options: [
      { code: 'ASII', name: 'Astra International Tbk' },
      { code: 'UNTR', name: 'United Tractors Tbk' }
    ]
  },
  {
    label: 'Teknologi & Digital',
    options: [
      { code: 'GOTO', name: 'GoTo Gojek Tokopedia Tbk' },
      { code: 'BUKA', name: 'Bukalapak.com Tbk' }
    ]
  },
  {
    label: 'Kesehatan & Farmasi',
    options: [
      { code: 'KLBF', name: 'Kalbe Farma Tbk' },
      { code: 'MIKA', name: 'Mitra Keluarga Karyasehat Tbk' }
    ]
  },
  {
    label: 'Properti & Real Estate',
    options: [
      { code: 'BSDE', name: 'Bumi Serpong Damai Tbk' },
      { code: 'PWON', name: 'Pakuwon Jati Tbk' },
      { code: 'SMRA', name: 'Summarecon Agung Tbk' }
    ]
  }
];

// Flat set of every selectable preset code (incl. the IHSG index) used to
// decide whether a symbol from the URL matches a dropdown option.
export const KNOWN_CODES: Set<string> = new Set<string>([
  'IHSG',
  ...STOCK_GROUPS.flatMap((g) => g.options.map((o) => o.code))
]);
