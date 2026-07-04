// Оболочка приложения: навигация, простой hash-роутер, статус синхронизации.
import { getSettings } from './db.js';
import { isConfigured, syncNow } from './sync.js';
import { renderOrders } from './views/orders.js';
import { renderOrder } from './views/order.js';
import { renderClients, renderClientCard } from './views/clients.js';
import { renderAnalytics } from './views/analytics.js';
import { renderSettings } from './views/settings.js';

const view = document.getElementById('view');

export function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

export function toast(msg, kind = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${kind}`;
  setTimeout(() => (t.className = 'toast'), 2600);
}

const ctx = { navigate, toast };

function setActiveNav(name) {
  document.querySelectorAll('.nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.nav === name);
  });
}

async function route() {
  const hash = location.hash || '#/orders';
  const parts = hash.replace(/^#\//, '').split('/'); // ['orders'] | ['orders','new'] | ['orders','ID']
  const [section, arg] = parts;
  view.innerHTML = '';
  try {
    if (section === 'orders' && arg === 'new') {
      setActiveNav('orders');
      await renderOrder(view, ctx, null);
    } else if (section === 'orders' && arg) {
      setActiveNav('orders');
      await renderOrder(view, ctx, arg);
    } else if (section === 'clients' && arg) {
      setActiveNav('clients');
      await renderClientCard(view, ctx, arg);
    } else if (section === 'clients') {
      setActiveNav('clients');
      await renderClients(view, ctx);
    } else if (section === 'analytics') {
      setActiveNav('analytics');
      await renderAnalytics(view, ctx);
    } else if (section === 'settings') {
      setActiveNav('settings');
      await renderSettings(view, ctx);
    } else {
      setActiveNav('orders');
      await renderOrders(view, ctx);
    }
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card err">Ошибка: ${e.message}</div>`;
  }
}

async function updateSyncBadge() {
  const shop = await getSettings();
  const badge = document.getElementById('sync-badge');
  const btn = document.getElementById('sync-btn');
  if (!isConfigured(shop)) {
    badge.textContent = 'Локально';
    badge.title = 'Облако не подключено — данные хранятся в этом браузере';
    btn.style.display = 'none';
  } else {
    badge.textContent = navigator.onLine ? 'Облако ✓' : 'Оффлайн';
    btn.style.display = '';
  }
}

async function doSync() {
  const btn = document.getElementById('sync-btn');
  btn.disabled = true;
  btn.textContent = 'Синхронизация…';
  try {
    const r = await syncNow();
    if (r.skipped) toast(r.reason === 'offline' ? 'Нет интернета' : 'Облако не настроено', 'warn');
    else toast(`Синхронизировано (↑${r.pushed} ↓${r.pulled})`);
    route();
  } catch (e) {
    toast('Ошибка синка: ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Синхронизировать';
    updateSyncBadge();
  }
}

// Автосинк при появлении сети и раз в 3 минуты (тихо, без ошибок наружу).
async function autoSync() {
  try {
    const shop = await getSettings();
    if (isConfigured(shop) && navigator.onLine) await syncNow();
  } catch (_) {}
  updateSyncBadge();
}

function boot() {
  document.getElementById('sync-btn').addEventListener('click', doSync);
  window.addEventListener('hashchange', route);
  window.addEventListener('online', () => { updateSyncBadge(); autoSync(); });
  window.addEventListener('offline', updateSyncBadge);
  route();
  updateSyncBadge();
  autoSync();
  setInterval(autoSync, 180000);

  // Регистрация service worker для оффлайна (не критично, если не выйдет).
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
