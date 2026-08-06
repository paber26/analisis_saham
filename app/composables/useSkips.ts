import { ref, computed, watch, onMounted } from 'vue';

// Personal "kurang menarik" (skip) list. Mirrors useWatchlist but stores codes
// the user has flagged as not interesting, so they stop appearing in the
// right-rail screening list and the daily digest.
export function useSkips() {
    const codes = useState<string[]>('skipCodes', () => []);
    const loading = useState<boolean>('skipLoading', () => false);
    const loaded = useState<boolean>('skipLoaded', () => false);
    const { authHeaders, token } = useAppToken();
    const { loggedIn } = useAuth();

    async function loadSkips(force = false) {
        if (!token.value && !loggedIn.value) return;
        if (loaded.value && !force) return;
        loading.value = true;
        try {
            const d = await $fetch<any>('/api/skips', { headers: authHeaders.value });
            codes.value = (d.codes || []).map((c: string) => c.toUpperCase());
            loaded.value = true;
        } catch {
            // ignore
        } finally {
            loading.value = false;
        }
    }

    function isSkipped(code: string): boolean {
        const c = (code || '').toUpperCase().trim();
        return codes.value.includes(c);
    }

    async function toggleSkip(code: string) {
        const c = (code || '').toUpperCase().trim();
        if (!c) return;

        const exists = codes.value.includes(c);
        const action = exists ? 'remove' : 'add';

        // Optimistic update
        if (exists) {
            codes.value = codes.value.filter((x) => x !== c);
        } else {
            codes.value = [...codes.value, c];
        }

        try {
            const d = await $fetch<any>('/api/skips', {
                method: 'POST',
                headers: authHeaders.value,
                body: { code: c, action }
            });
            if (d?.codes) {
                codes.value = d.codes.map((x: string) => x.toUpperCase());
            }
        } catch (err) {
            // Revert on error
            if (exists) {
                if (!codes.value.includes(c)) codes.value = [...codes.value, c];
            } else {
                codes.value = codes.value.filter((x) => x !== c);
            }
        }
    }

    watch([token, loggedIn], () => {
        if (token.value || loggedIn.value) {
            loadSkips(true);
        } else {
            codes.value = [];
            loaded.value = false;
        }
    }, { immediate: true });

    onMounted(() => {
        if ((token.value || loggedIn.value) && !loaded.value) {
            loadSkips();
        }
    });

    return {
        codes: computed(() => codes.value),
        loading: computed(() => loading.value),
        loaded: computed(() => loaded.value),
        loadSkips,
        isSkipped,
        toggleSkip
    };
}