// Remembers the last stock the user looked at, shared across all pages
// (localStorage). Lets navigation default to "my last symbol" instead of BBCA.
export function useLastSymbol() {
  const last = useState<string>('lastSymbol', () => 'BBCA');

  // Call from onMounted so SSR + first client render stay 'BBCA' (no hydration
  // mismatch); the persisted value is applied right after mount.
  function hydrate() {
    if (import.meta.client) {
      const s = localStorage.getItem('lastSymbol');
      if (s) last.value = s;
    }
  }

  function setLast(sym: string | null | undefined) {
    // Client-only: keep SSR + first client render on the default so nav-link
    // hrefs don't hydration-mismatch; updates happen reactively after mount.
    if (!import.meta.client) return;
    const s = (sym || '').toUpperCase().replace('.JK', '').trim();
    if (!s || s === 'CUSTOM' || s === 'IHSG') return;
    last.value = s;
    localStorage.setItem('lastSymbol', s);
  }

  return { last, setLast, hydrate };
}
