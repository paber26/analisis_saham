import { defineEventHandler, readBody, getQuery, createError } from 'h3';
import { getMaterials, saveMaterials, MaterialItem } from '../utils/materialsStore';

export default defineEventHandler(async (event) => {
  const method = event.node.req.method;

  if (method === 'GET') {
    const query = getQuery(event);
    let items = getMaterials();

    const category = query.category as string;
    if (category && category !== 'Semua') {
      items = items.filter(m => m.category === category);
    }

    const search = (query.search as string || '').toLowerCase().trim();
    if (search) {
      items = items.filter(m =>
        m.title.toLowerCase().includes(search) ||
        m.summary.toLowerCase().includes(search) ||
        m.content.toLowerCase().includes(search) ||
        m.tags.some(t => t.toLowerCase().includes(search))
      );
    }

    return {
      success: true,
      data: items,
      total: items.length,
      categories: ['Semua', 'Dasar Pasar Modal', 'Analisis Fundamental', 'Analisis Teknikal', 'Risk Management', 'Catatan & Strategi']
    };
  }

  if (method === 'POST') {
    const body = await readBody(event);
    if (!body || !body.title || !body.category || !body.content) {
      throw createError({ statusCode: 400, statusMessage: 'Judul, Kategori, dan Konten wajib diisi' });
    }

    const items = getMaterials();
    const existingIndex = items.findIndex(m => m.id === body.id);

    const now = new Date().toISOString().slice(0, 10);

    if (existingIndex >= 0) {
      items[existingIndex] = {
        ...items[existingIndex],
        title: body.title.trim(),
        category: body.category,
        level: body.level || 'Dasar',
        summary: body.summary || body.content.substring(0, 120) + '...',
        content: body.content,
        tags: Array.isArray(body.tags) ? body.tags : (body.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
        updatedAt: now,
        isCustom: true
      };
    } else {
      const newItem: MaterialItem = {
        id: `custom-${Date.now()}`,
        title: body.title.trim(),
        category: body.category,
        level: body.level || 'Dasar',
        summary: body.summary || body.content.substring(0, 120) + '...',
        content: body.content,
        tags: Array.isArray(body.tags) ? body.tags : (body.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean),
        updatedAt: now,
        isCustom: true
      };
      items.unshift(newItem);
    }

    const ok = saveMaterials(items);
    if (!ok) {
      throw createError({ statusCode: 500, statusMessage: 'Gagal menyimpan catatan materi' });
    }

    return { success: true, message: 'Materi berhasil disimpan', data: items };
  }

  if (method === 'DELETE') {
    const query = getQuery(event);
    const id = query.id as string;
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'ID materi wajib dikirim' });
    }

    let items = getMaterials();
    items = items.filter(m => m.id !== id);
    const ok = saveMaterials(items);

    if (!ok) {
      throw createError({ statusCode: 500, statusMessage: 'Gagal menghapus materi' });
    }

    return { success: true, message: 'Materi berhasil dihapus', data: items };
  }
});
