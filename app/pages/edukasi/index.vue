<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

useHead({
  title: 'Pusat Edukasi & Catatan Belajar Saham - Saham IDX',
  meta: [
    {
      name: 'description',
      content: 'Pusat edukasi materi dasar hingga lanjutan analisis saham BEI, serta tempat menyimpan dan mengelola catatan belajar investasi pribadi.'
    }
  ]
});

interface MaterialItem {
  id: string;
  title: string;
  category: 'Dasar Pasar Modal' | 'Analisis Fundamental' | 'Analisis Teknikal' | 'Risk Management' | 'Catatan & Strategi';
  level: 'Dasar' | 'Menengah' | 'Lanjutan';
  summary: string;
  content: string;
  tags: string[];
  updatedAt: string;
  isCustom?: boolean;
}

const materials = ref<MaterialItem[]>([]);
const isPending = ref(true);
const selectedCategory = ref<string>('Semua');
const searchQuery = ref<string>('');
const selectedMaterial = ref<MaterialItem | null>(null);

// Modal state for adding/editing material
const showModal = ref(false);
const isEditing = ref(false);
const formId = ref('');
const formTitle = ref('');
const formCategory = ref<MaterialItem['category']>('Dasar Pasar Modal');
const formLevel = ref<MaterialItem['level']>('Dasar');
const formSummary = ref('');
const formContent = ref('');
const formTags = ref('');
const isSubmitting = ref(false);
const formError = ref('');

const categories = ['Semua', 'Dasar Pasar Modal', 'Analisis Fundamental', 'Analisis Teknikal', 'Risk Management', 'Catatan & Strategi'];

async function fetchMaterials() {
  isPending.value = true;
  try {
    const res = await $fetch<{ success: boolean; data: MaterialItem[] }>('/api/materials');
    if (res.success) {
      materials.value = res.data;
      if (!selectedMaterial.value && materials.value.length > 0) {
        selectedMaterial.value = materials.value[0];
      }
    }
  } catch (err) {
    console.error('Error loading materials:', err);
  } finally {
    isPending.value = false;
  }
}

const filteredMaterials = computed(() => {
  return materials.value.filter(m => {
    const matchesCategory = selectedCategory.value === 'Semua' || m.category === selectedCategory.value;
    const query = searchQuery.value.toLowerCase().trim();
    const matchesSearch = !query ||
      m.title.toLowerCase().includes(query) ||
      m.summary.toLowerCase().includes(query) ||
      m.content.toLowerCase().includes(query) ||
      m.tags.some(t => t.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });
});

function openAddModal() {
  isEditing.value = false;
  formId.value = '';
  formTitle.value = '';
  formCategory.value = 'Dasar Pasar Modal';
  formLevel.value = 'Dasar';
  formSummary.value = '';
  formContent.value = '';
  formTags.value = '';
  formError.value = '';
  showModal.value = true;
}

function openEditModal(mat: MaterialItem) {
  isEditing.value = true;
  formId.value = mat.id;
  formTitle.value = mat.title;
  formCategory.value = mat.category;
  formLevel.value = mat.level;
  formSummary.value = mat.summary;
  formContent.value = mat.content;
  formTags.value = mat.tags.join(', ');
  formError.value = '';
  showModal.value = true;
}

async function handleSaveMaterial() {
  if (!formTitle.value.trim() || !formContent.value.trim()) {
    formError.value = 'Judul dan konten materi wajib diisi.';
    return;
  }

  isSubmitting.value = true;
  formError.value = '';

  try {
    const res = await $fetch<{ success: boolean; data: MaterialItem[] }>('/api/materials', {
      method: 'POST',
      body: {
        id: formId.value,
        title: formTitle.value,
        category: formCategory.value,
        level: formLevel.value,
        summary: formSummary.value,
        content: formContent.value,
        tags: formTags.value
      }
    });

    if (res.success) {
      materials.value = res.data;
      showModal.value = false;
      const updated = materials.value.find(m => m.title === formTitle.value.trim());
      if (updated) selectedMaterial.value = updated;
    }
  } catch (err: any) {
    formError.value = err.data?.statusMessage || 'Gagal menyimpan catatan materi.';
  } finally {
    isSubmitting.value = false;
  }
}

async function handleDeleteMaterial(id: string) {
  if (!confirm('Apakah Anda yakin ingin menghapus catatan materi ini?')) return;
  try {
    const res = await $fetch<{ success: boolean; data: MaterialItem[] }>(`/api/materials?id=${id}`, {
      method: 'DELETE'
    });
    if (res.success) {
      materials.value = res.data;
      if (selectedMaterial.value?.id === id) {
        selectedMaterial.value = materials.value[0] || null;
      }
    }
  } catch (err) {
    alert('Gagal menghapus materi');
  }
}

function formatMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto text-emerald-400 font-mono text-xs my-3"><code>$1</code></pre>')
    .replace(/^#### (.*$)/gim, '<h4 class="text-sm font-bold text-slate-200 mt-4 mb-2">$1</h4>')
    .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-emerald-400 mt-5 mb-2 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-slate-100 mt-6 mb-3 border-b border-slate-800 pb-1.5">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-xl font-extrabold text-slate-50 mt-6 mb-4">$1</h1>')
    .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-emerald-500 bg-slate-950/80 p-3 rounded-r-xl my-3 text-slate-300 italic">$1</blockquote>')
    .replace(/^- \[ \] (.*$)/gim, '<li class="ml-4 list-none text-slate-300 py-0.5 flex items-center gap-2"><span class="w-3.5 h-3.5 inline-block border border-slate-700 rounded bg-slate-950"></span> $1</li>')
    .replace(/^- \[x\] (.*$)/gim, '<li class="ml-4 list-none text-slate-200 py-0.5 flex items-center gap-2"><span class="w-3.5 h-3.5 inline-flex items-center justify-center border border-emerald-500 rounded bg-emerald-500 text-slate-950 text-[10px] font-bold">✓</span> $1</li>')
    .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-slate-300 py-0.5">$1</li>')
    .replace(/^([0-9]+)\. (.*$)/gim, '<li class="ml-4 list-decimal text-slate-300 py-0.5">$2</li>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-100 font-bold">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="text-emerald-300 font-medium">$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-300 font-mono text-xs border border-slate-800">$1</code>')
    .replace(/\n/g, '<br/>');
}

onMounted(fetchMaterials);
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
    <!-- Header Banner -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 border border-slate-800 shadow-xl">
      <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            PUSAT PENGETAHUAN & CATATAN BELAJAR
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-50 tracking-tight">
            Materi Edukasi &amp; Catatan Saham Pribadi
          </h1>
          <p class="text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
            Wadah penyimpanan ringkasan, analisis, dan teori saham yang Anda pelajari. Anda dapat <span class="text-emerald-400 font-semibold">membaca materi standar</span> maupun <span class="text-emerald-400 font-semibold">menambahkan catatan pribadi baru</span> agar dapat dibaca kembali kapan saja secara online.
          </p>
        </div>

        <button
          @click="openAddModal"
          class="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
        >
          <span>➕</span> Tambah Catatan Baru
        </button>
      </div>
    </div>

    <!-- Filter & Search Controls -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
      <!-- Search Input -->
      <div class="relative w-full sm:w-80">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari materi, konsep, atau tag..."
          class="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <svg class="w-4 h-4 text-slate-500 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <!-- Category Filter Pills -->
      <div class="flex flex-wrap items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
        <button
          v-for="cat in categories"
          :key="cat"
          @click="selectedCategory = cat"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          :class="[
            selectedCategory === cat
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
          ]"
        >
          {{ cat }}
        </button>
      </div>
    </div>

    <!-- Main Content Grid (List + Reader) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <!-- Left Column: Material List -->
      <div class="lg:col-span-5 space-y-3">
        <div class="flex items-center justify-between px-1">
          <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Daftar Materi ({{ filteredMaterials.length }})
          </h2>
        </div>

        <div v-if="isPending" class="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-xs text-slate-400">
          Memuat daftar materi...
        </div>

        <div v-else-if="filteredMaterials.length === 0" class="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-xs text-slate-400">
          Tidak ditemukan materi yang sesuai pencarian.
        </div>

        <div v-else class="space-y-3 max-h-[700px] overflow-y-auto pr-1">
          <div
            v-for="mat in filteredMaterials"
            :key="mat.id"
            @click="selectedMaterial = mat"
            class="p-4 rounded-xl border transition-all cursor-pointer relative group"
            :class="[
              selectedMaterial?.id === mat.id
                ? 'bg-slate-900 border-emerald-500/80 shadow-md shadow-emerald-500/5'
                : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
            ]"
          >
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-emerald-400">
                {{ mat.category }}
              </span>
              <span class="text-[10px] text-slate-500">
                {{ mat.updatedAt }}
              </span>
            </div>

            <h3 class="text-sm font-bold text-slate-100 group-hover:text-emerald-400 transition-colors line-clamp-1">
              {{ mat.title }}
            </h3>

            <p class="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {{ mat.summary }}
            </p>

            <div class="flex flex-wrap items-center gap-1.5 mt-3">
              <span v-for="tag in mat.tags" :key="tag" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                #{{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Reader View -->
      <div class="lg:col-span-7">
        <div v-if="selectedMaterial" class="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-6">
          <!-- Reader Header -->
          <div class="border-b border-slate-800 pb-4 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {{ selectedMaterial.category }}
                </span>
                <span class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800">
                  Tingkat: {{ selectedMaterial.level }}
                </span>
              </div>

              <!-- Action buttons for custom/editable notes -->
              <div class="flex items-center gap-2">
                <button
                  @click="openEditModal(selectedMaterial)"
                  class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1"
                >
                  ✏️ Edit
                </button>
                <button
                  v-if="selectedMaterial.isCustom"
                  @click="handleDeleteMaterial(selectedMaterial.id)"
                  class="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold rounded-lg border border-rose-500/30 transition-colors flex items-center gap-1"
                >
                  🗑️ Hapus
                </button>
              </div>
            </div>

            <h2 class="text-xl font-extrabold text-slate-50 tracking-tight leading-snug">
              {{ selectedMaterial.title }}
            </h2>

            <div class="text-xs text-slate-400 italic bg-slate-950 p-3 rounded-xl border border-slate-800/80">
              {{ selectedMaterial.summary }}
            </div>
          </div>

          <!-- Reader Body Content -->
          <div
            class="text-xs text-slate-300 leading-relaxed space-y-3 prose prose-invert max-w-none"
            v-html="formatMarkdown(selectedMaterial.content)"
          ></div>

          <!-- Reader Footer Tags -->
          <div class="border-t border-slate-800 pt-4 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
            <div class="flex items-center gap-1.5">
              <span>Tags:</span>
              <span v-for="tag in selectedMaterial.tags" :key="tag" class="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 text-[10px]">
                #{{ tag }}
              </span>
            </div>
            <div>Diperbarui: {{ selectedMaterial.updatedAt }}</div>
          </div>
        </div>

        <div v-else class="p-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-xs text-slate-400">
          Pilih salah satu materi dari daftar di sebelah kiri untuk membacanya.
        </div>
      </div>
    </div>

    <!-- MODAL ADD / EDIT MATERIAL -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div class="bg-slate-900 rounded-2xl border border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>{{ isEditing ? '✏️ Edit Catatan Belajar' : '➕ Tambah Catatan Belajar Baru' }}</span>
          </h3>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-200 text-lg">✕</button>
        </div>

        <div v-if="formError" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
          {{ formError }}
        </div>

        <div class="space-y-4 text-xs">
          <div>
            <label class="block text-slate-300 font-bold mb-1">Judul Materi / Catatan</label>
            <input
              v-model="formTitle"
              type="text"
              placeholder="Contoh: Cara Membaca Pola Head and Shoulders..."
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-slate-300 font-bold mb-1">Kategori</label>
              <select
                v-model="formCategory"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="Dasar Pasar Modal">Dasar Pasar Modal</option>
                <option value="Analisis Fundamental">Analisis Fundamental</option>
                <option value="Analisis Teknikal">Analisis Teknikal</option>
                <option value="Risk Management">Risk Management</option>
                <option value="Catatan & Strategi">Catatan &amp; Strategi</option>
              </select>
            </div>

            <div>
              <label class="block text-slate-300 font-bold mb-1">Tingkat Kesulitan</label>
              <select
                v-model="formLevel"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="Dasar">Dasar</option>
                <option value="Menengah">Menengah</option>
                <option value="Lanjutan">Lanjutan</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-slate-300 font-bold mb-1">Ringkasan Singkat</label>
            <input
              v-model="formSummary"
              type="text"
              placeholder="Penjelasan ringkas 1 kalimat..."
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label class="block text-slate-300 font-bold mb-1">Tags (Pisahkan dengan koma)</label>
            <input
              v-model="formTags"
              type="text"
              placeholder="Contoh: PER, Valuasi, BNI, Belajar"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label class="block text-slate-300 font-bold mb-1">Isi Konten Catatan (Mendukung Markdown ###, **, -)</label>
            <textarea
              v-model="formContent"
              rows="10"
              placeholder="Tuliskan isi ringkasan atau catatan yang Anda pelajari di sini..."
              class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500 leading-relaxed"
            ></textarea>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            @click="showModal = false"
            class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            @click="handleSaveMaterial"
            :disabled="isSubmitting"
            class="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
          >
            <span v-if="isSubmitting" class="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
            Simpan Catatan
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
