<script setup lang="ts">
import { companyProfile } from '../../data/companyProfile';

useHead({
  title: 'Profil Perusahaan - Saham IDX Portal',
  meta: [
    {
      name: 'description',
      content: 'Profil singkat, visi, misi, dan informasi kontak Saham IDX Portal.'
    }
  ]
});
</script>

<template>
  <div class="pb-16 bg-slate-950 text-slate-100 flex flex-col flex-grow">
    <main class="max-w-7xl mx-auto px-4 sm:px-6 mt-8 flex-grow w-full space-y-6">
      <section class="glow-card rounded-2xl p-6">
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div class="space-y-2">
            <h2 class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-50">
              {{ companyProfile.name }}
            </h2>
            <p class="text-sm text-slate-300 max-w-2xl">
              {{ companyProfile.tagline }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              Profil
            </span>
            <span class="text-[11px] font-semibold text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
              Informasi
            </span>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="glow-card rounded-2xl p-6">
            <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Tentang</h3>
            <p class="text-sm text-slate-200 leading-relaxed">
              {{ companyProfile.about }}
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="glow-card rounded-2xl p-6">
              <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Visi</h3>
              <p class="text-sm text-slate-200 leading-relaxed">
                {{ companyProfile.vision }}
              </p>
            </div>
            <div class="glow-card rounded-2xl p-6">
              <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Misi</h3>
              <ul class="space-y-2">
                <li
                  v-for="(item, idx) in companyProfile.mission"
                  :key="idx"
                  class="text-sm text-slate-200 flex gap-2"
                >
                  <span class="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400/90 flex-shrink-0" />
                  <span class="leading-relaxed">{{ item }}</span>
                </li>
              </ul>
            </div>
          </div>

          <div class="glow-card rounded-2xl p-6">
            <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Produk & Fitur</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="(p, idx) in companyProfile.products"
                :key="idx"
                class="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 hover:border-slate-700 transition-colors"
              >
                <h4 class="text-base font-bold text-slate-50">{{ p.title }}</h4>
                <p class="text-sm text-slate-300 mt-2 leading-relaxed">{{ p.description }}</p>
                <ul class="mt-3 space-y-1.5">
                  <li
                    v-for="(h, hIdx) in p.highlights"
                    :key="hIdx"
                    class="text-xs text-slate-300 flex gap-2"
                  >
                    <span class="mt-1 h-1.5 w-1.5 rounded-full bg-slate-500/80 flex-shrink-0" />
                    <span>{{ h }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <aside class="space-y-6">
          <div class="glow-card rounded-2xl p-6">
            <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Nilai</h3>
            <div class="space-y-3">
              <div
                v-for="(v, idx) in companyProfile.values"
                :key="idx"
                class="rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <p class="text-sm font-bold text-slate-50">{{ v.title }}</p>
                <p class="text-xs text-slate-300 mt-1 leading-relaxed">{{ v.description }}</p>
              </div>
            </div>
          </div>

          <div class="glow-card rounded-2xl p-6">
            <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Kontak</h3>
            <div class="space-y-3 text-sm">
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">Website</span>
                <span class="text-slate-200 text-right break-all">{{ companyProfile.contacts.website }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">Email</span>
                <span class="text-slate-200 text-right break-all">{{ companyProfile.contacts.email }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-slate-400">Telepon</span>
                <span class="text-slate-200 text-right break-all">{{ companyProfile.contacts.phone }}</span>
              </div>
              <div class="pt-3 border-t border-slate-900">
                <p class="text-slate-400 text-xs mb-2">Alamat</p>
                <p class="text-slate-200 text-sm leading-relaxed">
                  {{ companyProfile.contacts.address }}
                </p>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <p class="text-xs text-amber-200 leading-relaxed">
              {{ companyProfile.legalNote }}
            </p>
          </div>
        </aside>
      </section>
    </main>
  </div>
</template>

