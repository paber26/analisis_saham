// Default screening universe: the most liquid IDX names (LQ45 / IDX80 / Kompas100
// style). Professionals screen liquid stocks; illiquid tickers add noise.
// Any ticker Yahoo does not recognise is simply dropped by the screener.

export const SCREENING_UNIVERSE: string[] = [
  // Perbankan & Keuangan
  'BBCA', 'BBRI', 'BMRI', 'BBNI', 'BBTN', 'BRIS', 'BTPS', 'BJBR', 'BJTM',
  'ARTO', 'BBHI', 'AGRO', 'PNBN', 'BNGA', 'NISP', 'MEGA', 'BBKP', 'BNLI',
  // Energi, Batu Bara & Migas
  'ADRO', 'PTBA', 'ITMG', 'BUMI', 'MEDC', 'HRUM', 'INDY', 'ADMR', 'PGAS',
  'AKRA', 'ELSA', 'RAJA', 'DSSA', 'BSSR', 'BYAN', 'PGEO', 'ESSA', 'ENRG',
  // Logam & Barang Baku
  'ANTM', 'INCO', 'TINS', 'MDKA', 'NCKL', 'BRMS', 'PSAB', 'TPIA', 'BRPT',
  'INKP', 'TKIM', 'KRAS', 'AVIA', 'SMGR', 'INTP', 'MBMA', 'AMMN',
  // Telko & Infrastruktur
  'TLKM', 'ISAT', 'EXCL', 'MTEL', 'TOWR', 'TBIG', 'JSMR', 'META', 'BREN',
  // Konsumer & Ritel
  'UNVR', 'ICBP', 'INDF', 'MYOR', 'KLBF', 'SIDO', 'GGRM', 'HMSP', 'AMRT',
  'MAPI', 'ACES', 'ERAA', 'CPIN', 'JPFA', 'MAPA', 'ULTJ', 'TSPC', 'KAEF',
  'MAIN', 'CMRY', 'ROTI',
  // Industri & Otomotif
  'ASII', 'UNTR', 'GJTL', 'DRMA', 'AUTO',
  // Teknologi & Digital
  'GOTO', 'BUKA', 'EMTK', 'BELI', 'DCII', 'MTDL', 'WIFI',
  // Properti & Real Estate
  'BSDE', 'PWON', 'SMRA', 'CTRA', 'PANI', 'DMAS', 'APLN', 'LPKR', 'CBDK',
  // Kesehatan & Farmasi
  'MIKA', 'HEAL', 'SILO', 'PRDA', 'SRAJ',
  // Aneka konglomerat & lainnya
  'CUAN', 'BRPT', 'EMTK', 'PTRO', 'MSIN', 'SMDR', 'ASSA'
];
