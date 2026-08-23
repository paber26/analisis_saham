<script setup lang="ts">
import { ref, watchEffect } from 'vue';

definePageMeta({ layout: false });

const { login, loggedIn } = useAuth();
const route = useRoute();
const router = useRouter();

const username = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

const dest = () => (route.query.redirect as string) || '/';
// If already logged in, don't show the form.
watchEffect(() => {
  if (loggedIn.value) router.replace(dest());
});

async function submit() {
  if (busy.value) return;
  error.value = '';
  busy.value = true;
  try {
    await login(username.value, password.value);
    router.replace(dest());
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Login gagal. Coba lagi.';
  } finally {
    busy.value = false;
  }
}

useHead({ title: 'Masuk — Analisis Saham' });
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 font-sans">
    <div class="w-full max-w-sm">
      <div class="flex items-center gap-3 mb-6 justify-center">
        <div class="p-2 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div>
          <h1 class="text-base font-bold text-slate-50">Saham IDX <span class="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">PRO</span></h1>
          <p class="text-[11px] text-slate-400">Masuk untuk akses penuh</p>
        </div>
      </div>

      <form class="glow-card rounded-2xl p-6 space-y-4 bg-slate-900/40 border border-slate-800" @submit.prevent="submit">
        <div class="space-y-1">
          <label class="text-[11px] font-semibold text-slate-400 uppercase">Username</label>
          <input
            v-model="username" type="text" autocomplete="username" required
            class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            placeholder="username" />
        </div>
        <div class="space-y-1">
          <label class="text-[11px] font-semibold text-slate-400 uppercase">Password</label>
          <input
            v-model="password" type="password" autocomplete="current-password" required
            class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            placeholder="••••••••" />
        </div>

        <p v-if="error" class="text-[12px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {{ error }}
        </p>

        <button
          type="submit" :disabled="busy"
          class="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-bold text-sm py-2.5 transition-colors">
          {{ busy ? 'Memproses…' : 'Masuk' }}
        </button>
      </form>

      <p class="text-center text-[11px] text-slate-600 mt-4">
        Akses pribadi. Setelah masuk, semua fitur (watchlist, portofolio, alert) terbuka otomatis.
      </p>
    </div>
  </div>
</template>
