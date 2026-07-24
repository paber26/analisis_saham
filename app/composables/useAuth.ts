// Login-session auth for the single owner. Once logged in, an httpOnly cookie
// authenticates every request automatically — no APP_TOKEN typing.
//
// Bridge: while logged in we also set the shared `appToken` state to a sentinel
// so the existing token-gated UI (useAppToken) unlocks without touching each
// page. The real auth is the cookie; the sentinel header is ignored server-side.
export function useAuth() {
  const user = useState<string | null>('authUser', () => null);
  const appToken = useState<string>('appToken', () => '');
  const loggedIn = computed(() => !!user.value);

  function syncBridge() {
    if (user.value) appToken.value = '__session__';
  }

  async function refresh() {
    try {
      const d = await $fetch<{ loggedIn: boolean; user: string | null }>('/api/auth/me', {
        headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined
      });
      user.value = d.loggedIn ? d.user : null;
    } catch {
      user.value = null;
    }
    syncBridge();
  }

  async function login(username: string, password: string) {
    const d = await $fetch<{ ok: boolean; user: string }>('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    });
    user.value = d.user;
    syncBridge();
  }

  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      user.value = null;
      appToken.value = '';
      if (import.meta.client) localStorage.removeItem('appToken');
    }
  }

  return { user, loggedIn, refresh, login, logout };
}
