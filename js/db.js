// Локальная база на IndexedDB. Работает полностью оффлайн.
// Хранилища: settings, clients, orders. Работы и запчасти лежат массивами внутри заказа.
import { nowISO } from './util.js';
import { defaultSettings } from './models.js';

const DB_NAME = 'favorie';
const DB_VERSION = 1;

let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('clients')) {
        const s = db.createObjectStore('clients', { keyPath: 'id' });
        s.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('orders')) {
        const s = db.createObjectStore('orders', { keyPath: 'id' });
        s.createIndex('updatedAt', 'updatedAt');
        s.createIndex('clientId', 'clientId');
      }
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = 'readonly') {
  return open().then((db) => db.transaction(store, mode).objectStore(store));
}

function reqPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAll(store) {
  const os = await tx(store);
  return reqPromise(os.getAll());
}

async function put(store, value) {
  const os = await tx(store, 'readwrite');
  await reqPromise(os.put(value));
  return value;
}

async function getOne(store, id) {
  const os = await tx(store);
  return reqPromise(os.get(id));
}

// ---- Настройки ----
export async function getSettings() {
  const s = await getOne('settings', 'shop');
  // Подмешиваем значения по умолчанию, чтобы новые поля появлялись у уже сохранённых настроек.
  if (s) return { ...defaultSettings(), ...s };
  const def = defaultSettings();
  await put('settings', def);
  return def;
}

export async function saveSettings(patch) {
  const cur = await getSettings();
  const next = { ...cur, ...patch, id: 'shop', updatedAt: nowISO() };
  return put('settings', next);
}

// ---- Клиенты ----
export async function listClients() {
  const all = await getAll('clients');
  return all.filter((c) => !c.deleted).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
}

export async function getClient(id) {
  return getOne('clients', id);
}

export async function saveClient(client) {
  const next = { ...client, updatedAt: nowISO() };
  return put('clients', next);
}

export async function softDeleteClient(id) {
  const c = await getOne('clients', id);
  if (c) await put('clients', { ...c, deleted: true, updatedAt: nowISO() });
}

// ---- Заказы ----
export async function listOrders() {
  const all = await getAll('orders');
  return all
    .filter((o) => !o.deleted)
    .sort((a, b) => (b.dateIn || '').localeCompare(a.dateIn || ''));
}

export async function getOrder(id) {
  return getOne('orders', id);
}

export async function saveOrder(order) {
  const next = { ...order, updatedAt: nowISO() };
  return put('orders', next);
}

export async function softDeleteOrder(id) {
  const o = await getOne('orders', id);
  if (o) await put('orders', { ...o, deleted: true, updatedAt: nowISO() });
}

export async function ordersByClient(clientId) {
  const all = await listOrders();
  return all.filter((o) => o.clientId === clientId);
}

// ---- Бэкап (экспорт/импорт всего в JSON) ----
export async function exportAll() {
  const [settings, clients, orders] = await Promise.all([
    getAll('settings'),
    getAll('clients'),
    getAll('orders'),
  ]);
  return { app: 'favorie', version: 1, exportedAt: nowISO(), settings, clients, orders };
}

export async function importAll(data) {
  if (!data || data.app !== 'favorie') throw new Error('Неверный файл бэкапа');
  for (const s of data.settings || []) await put('settings', s);
  for (const c of data.clients || []) await put('clients', c);
  for (const o of data.orders || []) await put('orders', o);
}

// Прямой upsert без обновления updatedAt — используется синхронизацией (пул из облака).
export async function upsertRaw(store, value) {
  return put(store, value);
}
