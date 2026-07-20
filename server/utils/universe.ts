// Default screening universe: liquid IDX names (LQ45 / IDX80 / Kompas100 style
// plus actively-traded mid-caps). Professionals screen liquid stocks; illiquid
// tickers add noise. Any ticker Yahoo does not recognise — or that fails the
// data-quality guard in analyzeTechnical — is simply dropped from results.

const RAW: string[] = [
  // Perbankan & Keuangan
  'BBCA', 'BBRI', 'BMRI', 'BBNI', 'BBTN', 'BRIS', 'BTPS', 'BJBR', 'BJTM',
  'ARTO', 'BBHI', 'AGRO', 'PNBN', 'BNGA', 'NISP', 'MEGA', 'BBKP', 'BNLI',
  'SRTG', 'BFIN', 'PNLF', 'BANK', 'BBSI', 'AMAR',
  // Energi, Batu Bara & Migas
  'ADRO', 'PTBA', 'ITMG', 'BUMI', 'MEDC', 'HRUM', 'INDY', 'ADMR', 'PGAS',
  'AKRA', 'ELSA', 'RAJA', 'DSSA', 'BSSR', 'BYAN', 'PGEO', 'ESSA', 'ENRG',
  'GEMS', 'TOBA', 'DOID', 'DEWA', 'AADI', 'RATU', 'BULL',
  // Logam, Barang Baku & Kimia
  'ANTM', 'INCO', 'TINS', 'MDKA', 'NCKL', 'BRMS', 'PSAB', 'TPIA', 'BRPT',
  'INKP', 'TKIM', 'KRAS', 'AVIA', 'SMGR', 'INTP', 'MBMA', 'AMMN', 'HRTA',
  'ZINC', 'SMBR', 'ARNA', 'TOTO', 'MARK', 'WTON',
  // Telko & Infrastruktur
  'TLKM', 'ISAT', 'EXCL', 'MTEL', 'TOWR', 'TBIG', 'JSMR', 'META', 'BREN',
  // Konstruksi
  'WIKA', 'PTPP', 'WSKT', 'ADHI', 'SSIA',
  // Konsumer & Ritel
  'UNVR', 'ICBP', 'INDF', 'MYOR', 'KLBF', 'SIDO', 'GGRM', 'HMSP', 'AMRT',
  'MAPI', 'ACES', 'ERAA', 'CPIN', 'JPFA', 'MAPA', 'ULTJ', 'TSPC', 'KAEF',
  'MAIN', 'CMRY', 'ROTI', 'LPPF', 'MIDI', 'RALS', 'CLEO', 'GOOD', 'STTP',
  'ADES', 'MLBI', 'DLTA', 'WIIM',
  // Perkebunan & Agri
  'AALI', 'LSIP', 'TBLA', 'TAPG', 'DSNG', 'SSMS',
  // Industri & Otomotif
  'ASII', 'UNTR', 'GJTL', 'DRMA', 'AUTO', 'SMSM', 'IMAS', 'MASA',
  // Teknologi, Digital & Media
  'GOTO', 'BUKA', 'EMTK', 'BELI', 'DCII', 'MTDL', 'WIFI', 'SCMA', 'MNCN',
  'FILM', 'MLPT', 'DMMX',
  // Properti & Real Estate
  'BSDE', 'PWON', 'SMRA', 'CTRA', 'PANI', 'DMAS', 'APLN', 'LPKR', 'CBDK',
  'ASRI', 'KIJA', 'DILD', 'MTLA',
  // Kesehatan & Farmasi
  'MIKA', 'HEAL', 'SILO', 'PRDA', 'SRAJ', 'DVLA', 'BMHS', 'INAF',
  // Transportasi & Logistik
  'SMDR', 'ASSA', 'BIRD', 'TMAS',
  // Aneka & Holding
  'CUAN', 'PTRO', 'MSIN', 'MDIY', 'CDIA'
];

// De-duplicated, uppercased
export const SCREENING_UNIVERSE: string[] = Array.from(new Set(RAW.map((s) => s.toUpperCase())));
