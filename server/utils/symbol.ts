// Shared symbol helpers used by all Yahoo Finance server routes.
// Keeps the IHSG / .JK normalization logic in a single place.

/**
 * Normalize a user-provided ticker into a Yahoo Finance symbol.
 * - 'IHSG'            -> '^JKSE' (Jakarta Composite Index)
 * - 4-letter tickers  -> 'BBCA.JK' (Indonesian Stock Exchange suffix)
 * - Anything starting with '^' or already ending in '.JK' is kept as-is
 * - Other symbols are kept as-is (enables US tickers like 'AAPL')
 */
export function normalizeSymbol(rawSymbol: string | undefined | null): string {
  const symbol = (rawSymbol || 'BBCA').toUpperCase().trim();
  if (symbol === 'IHSG') return '^JKSE';
  if (symbol.startsWith('^') || symbol.endsWith('.JK')) return symbol;
  return `${symbol}.JK`;
}

/**
 * Resolve a human-readable display name for a returned Yahoo symbol,
 * falling back to a sensible label when the API does not provide one.
 */
export function resolveDisplayName(returnedSymbol: string, apiName?: string | null): string {
  if (returnedSymbol === '^JKSE') return 'Indeks Harga Saham Gabungan (IHSG)';
  if (apiName && apiName !== returnedSymbol) return apiName;
  if (returnedSymbol.endsWith('.JK')) return `PT ${returnedSymbol.replace('.JK', '')} Tbk`;
  return apiName || returnedSymbol;
}

// Standard headers so Yahoo Finance does not reject the request as a bot.
export const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};
