// Lightweight single-user access token for personal data (watchlist/portfolio).
// Stored in localStorage; sent as the `x-app-token` header on write/read calls.
export function useAppToken() {
  const token = useState<string>('appToken', () => '');

  if (import.meta.client && !token.value) {
    token.value = localStorage.getItem('appToken') || '';
  }

  function setToken(t: string) {
    token.value = (t || '').trim();
    if (import.meta.client) localStorage.setItem('appToken', token.value);
  }
  function clearToken() {
    token.value = '';
    if (import.meta.client) localStorage.removeItem('appToken');
  }

  const authHeaders = computed(() => ({ 'x-app-token': token.value }));
  return { token, setToken, clearToken, authHeaders };
}
