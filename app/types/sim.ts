// Shared contracts for the Simulasi Lab (mirror server API shapes).

export interface AsOfRow {
  code: string; name: string; asOfDate: string; price: number; score: number;
  rating: 'Kuat' | 'Menarik' | 'Netral' | 'Lemah';
  rsi: number | null; rs3m: number | null; atrPct: number | null; volRatio: number | null;
  pctFromHigh: number; changePct: number;
}

export interface PriceBar { date: string; open: number; high: number; low: number; close: number; volume: number }

export interface BasketItem {
  code: string;
  name: string;
  entryPrice: number;
  rating: string;
  score?: number | null;
  rs3m?: number | null;
  rsi?: number | null;
  pctFromHigh?: number | null;
  weightPct: number;
  lots: number;
}

export interface Decision { date: string; code: string; action: 'HOLD' | 'SELL' | 'AVERAGE_DOWN' | 'BUY'; lots: number; price: number; unrealizedPct: number; rating: string }

export interface DecRow {
  code: string;
  name: string;
  price: number;
  avgPrice: number;
  plPct: number;
  lots: number;
  rating: string;
  score?: number | null;
  rs3m?: number | null;
  rsi?: number | null;
  pctFromHigh?: number | null;
  action: 'HOLD' | 'SELL' | 'SELL_50' | 'AVERAGE_DOWN';
  avgDownLots: number;
}

export type SimStep = 'setup' | 'screen' | 'basket' | 'play' | 'result' | 'review';
export type SortKey = 'code' | 'price' | 'rating' | 'score' | 'rs3m' | 'rsi' | 'pctFromHigh';
export type SortOrder = 'asc' | 'desc';

export interface RecoNote { code: string; name: string; score: number; rating: string; reasons: string[]; cautions: string[] }
