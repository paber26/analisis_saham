import { getQuery } from 'h3';
import { YAHOO_HEADERS } from '../utils/symbol';

interface SearchResultItem {
  symbol: string; // Yahoo symbol, e.g. 'BUMI.JK'
  code: string;   // Display code, e.g. 'BUMI' (or 'IHSG' for the index)
  name: string;
  exchange: string;
  type: string;
}

// Live ticker search across the *entire* Indonesia Stock Exchange (~900 emiten)
// by proxying Yahoo Finance search and keeping only Jakarta-listed symbols.
// This removes the need for a hand-maintained stock list or a database.
export default defineCachedEventHandler(async (event): Promise<{ results: SearchResultItem[] }> => {
  const query = getQuery(event);
  const q = ((query.q as string) || '').trim();

  if (q.length < 1) return { results: [] };

  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=25&newsCount=0&enableFuzzyQuery=false`;

  const data: any = await $fetch<any>(url, { headers: YAHOO_HEADERS }).catch((err) => {
    console.error('Yahoo Finance search error:', err);
    return null;
  });

  const quotes: any[] = data?.quotes || [];

  const results: SearchResultItem[] = quotes
    // Keep only Indonesia Stock Exchange symbols (.JK) plus the IHSG index.
    .filter((item) => {
      const sym: string = item.symbol || '';
      return sym.endsWith('.JK') || sym === '^JKSE';
    })
    .map((item) => {
      const sym: string = item.symbol;
      const isIndex = sym === '^JKSE';
      return {
        symbol: sym,
        code: isIndex ? 'IHSG' : sym.replace('.JK', ''),
        name: isIndex
          ? 'Indeks Harga Saham Gabungan (IHSG)'
          : item.longname || item.shortname || sym.replace('.JK', ''),
        exchange: item.exchDisp || item.exchange || 'IDX',
        type: item.quoteType || 'EQUITY'
      };
    });

  return { results };
}, {
  maxAge: 60 * 60 * 6, // 6 hours
  swr: true,
  name: 'search',
  getKey: (event) => ((getQuery(event).q as string) || '').trim().toUpperCase()
});
