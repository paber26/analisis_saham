import { getMethod, readBody, getQuery, createError } from 'h3';
import { requireAppToken } from '../utils/auth';
import { getAlertStore, saveAlertStore, type AlertRule } from '../utils/store';
import { ALERT_TYPES } from '../utils/alerts';

// Alert rules CRUD — personal data, gated like watchlist/portfolio.
// GET            → { rules, history }
// POST {rule}    → upsert (id wajib utk update; tanpa id = buat baru)
// DELETE ?id=    → hapus rule
export default defineEventHandler(async (event) => {
  requireAppToken(event);
  const method = getMethod(event);
  const store = await getAlertStore();

  if (method === 'POST') {
    const body = await readBody<Partial<AlertRule>>(event);
    const type = body?.type;
    if (!type || !ALERT_TYPES.some((t) => t.value === type)) {
      throw createError({ statusCode: 400, statusMessage: 'Tipe alert tidak dikenal.' });
    }
    const code = (body?.code || '').toUpperCase().replace('.JK', '').trim() || '*';
    const rule: AlertRule = {
      id: body?.id || `al_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      code,
      type,
      value: typeof body?.value === 'number' && isFinite(body.value) ? body.value : null,
      active: body?.active !== false,
      createdAt: body?.createdAt || new Date().toISOString(),
      lastTriggeredAt: body?.lastTriggeredAt ?? null
    };
    const idx = store.rules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) store.rules[idx] = { ...store.rules[idx]!, ...rule };
    else store.rules.unshift(rule);
    await saveAlertStore(store);
    return { ok: true, rules: store.rules };
  }

  if (method === 'DELETE') {
    const id = (getQuery(event).id as string) || '';
    const before = store.rules.length;
    store.rules = store.rules.filter((r) => r.id !== id);
    await saveAlertStore(store);
    return { ok: true, removed: before - store.rules.length };
  }

  // GET
  return { rules: store.rules, history: store.history };
});
