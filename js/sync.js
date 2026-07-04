// Синхронизация с Supabase через PostgREST REST API (без SDK — чтобы работало оффлайн и без сборки).
// Стратегия: last-write-wins по updatedAt. Один пользователь — конфликтов почти не бывает.
// Если ключи не заданы — синхронизация просто выключена, приложение работает локально.
import { getSettings, saveSettings, listClients, listOrders, upsertRaw } from './db.js';
import { nowISO } from './util.js';

function headers(key) {
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: 'resolution=merge-duplicates,return=minimal',
  };
}

export function isConfigured(shop) {
  return !!(shop && shop.supabaseUrl && shop.supabaseKey);
}

// Локальная запись -> строка таблицы (works/parts/flags кладём как jsonb).
function toRow(rec) {
  return { ...rec, updated_at: rec.updatedAt || nowISO() };
}

function fromRow(row) {
  const rec = { ...row };
  rec.updatedAt = row.updated_at || row.updatedAt || nowISO();
  delete rec.updated_at;
  return rec;
}

async function pushTable(shop, table, records, since) {
  const dirty = records.filter((r) => !since || (r.updatedAt || '') > since);
  if (!dirty.length) return 0;
  const res = await fetch(`${shop.supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers(shop.supabaseKey),
    body: JSON.stringify(dirty.map(toRow)),
  });
  if (!res.ok) throw new Error(`push ${table}: ${res.status} ${await res.text()}`);
  return dirty.length;
}

async function pullTable(shop, table, store, since) {
  const q = since
    ? `?select=*&updated_at=gt.${encodeURIComponent(since)}`
    : '?select=*';
  const res = await fetch(`${shop.supabaseUrl}/rest/v1/${table}${q}`, {
    headers: { apikey: shop.supabaseKey, Authorization: `Bearer ${shop.supabaseKey}` },
  });
  if (!res.ok) throw new Error(`pull ${table}: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  for (const row of rows) await upsertRaw(store, fromRow(row));
  return rows.length;
}

// Полный проход синхронизации. Возвращает сводку или бросает ошибку.
export async function syncNow() {
  const shop = await getSettings();
  if (!isConfigured(shop)) return { skipped: true, reason: 'not-configured' };
  if (!navigator.onLine) return { skipped: true, reason: 'offline' };

  const since = shop.lastSyncAt || '';
  const [clients, orders] = await Promise.all([listClients(), listOrders()]);

  // Сначала пушим локальные изменения, затем тянем чужие.
  const pushed =
    (await pushTable(shop, 'clients', clients, since)) +
    (await pushTable(shop, 'orders', orders, since));
  const pulled =
    (await pullTable(shop, 'clients', 'clients', since)) +
    (await pullTable(shop, 'orders', 'orders', since));

  await saveSettings({ lastSyncAt: nowISO() });
  return { pushed, pulled };
}

// Проверка подключения — дергаем настройки одной пустой выборкой.
export async function testConnection(url, key) {
  const res = await fetch(`${url}/rest/v1/clients?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return true;
}
