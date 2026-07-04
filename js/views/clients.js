// Клиенты: список с поиском и карточка с историей обращений.
import { listClients, getClient, saveClient, ordersByClient } from '../db.js';
import { fmtDate, fmtMoney, escapeHtml, debounce } from '../util.js';
import { totals, statusLabel } from '../models.js';

export async function renderClients(root, ctx) {
  const all = await listClients();
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="toolbar">
      <input id="q" class="search" type="search" placeholder="Поиск клиента: имя, телефон">
      <div class="spacer"></div>
    </div>
    <div id="list"></div>`;
  root.append(wrap);
  const listEl = wrap.querySelector('#list');

  function draw(q = '') {
    const rows = all.filter((c) => {
      if (!q) return true;
      const s = q.toLowerCase();
      return (c.name || '').toLowerCase().includes(s) || (c.phone || '').toLowerCase().includes(s);
    });
    if (!rows.length) { listEl.innerHTML = '<div class="empty">Клиентов нет.</div>'; return; }
    listEl.innerHTML = `<table class="grid"><thead><tr><th>Имя</th><th>Телефон</th><th>Адрес</th></tr></thead>
      <tbody>${rows.map((c) => `<tr class="click" data-id="${c.id}"><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.phone)}</td><td>${escapeHtml(c.address)}</td></tr>`).join('')}</tbody></table>`;
    listEl.querySelectorAll('tr.click').forEach((tr) => tr.addEventListener('click', () => ctx.navigate('#/clients/' + tr.dataset.id)));
  }
  wrap.querySelector('#q').addEventListener('input', debounce((e) => draw(e.target.value.trim()), 200));
  draw();
}

export async function renderClientCard(root, ctx, id) {
  const client = await getClient(id);
  if (!client) { root.innerHTML = '<div class="card err">Клиент не найден</div>'; return; }
  const orders = await ordersByClient(id);
  const c = document.createElement('div');
  c.innerHTML = `
    <div class="order-head"><a class="back" href="#/clients">← Клиенты</a></div>
    <div class="card">
      <h3>Клиент</h3>
      <div class="f-row">
        <label>Имя<input id="c-name" value="${escapeHtml(client.name)}"></label>
        <label>Телефон<input id="c-phone" value="${escapeHtml(client.phone)}"></label>
      </div>
      <label>Адрес<input id="c-address" value="${escapeHtml(client.address)}"></label>
      <label>Заметки<textarea id="c-notes" rows="2">${escapeHtml(client.notes)}</textarea></label>
      <div class="actions"><button id="c-save" class="btn primary">💾 Сохранить</button></div>
    </div>
    <div class="card">
      <h3>История обращений (${orders.length})</h3>
      ${
        orders.length
          ? `<table class="grid"><thead><tr><th>Дата</th><th>№</th><th>Модель</th><th>Статус</th><th class="r">Итого</th></tr></thead>
        <tbody>${orders.map((o) => `<tr class="click" data-id="${o.id}"><td>${fmtDate(o.dateIn)}</td><td>${escapeHtml(o.number)}</td><td>${escapeHtml(o.deviceModel)}</td><td>${statusLabel(o.status)}</td><td class="r">${fmtMoney(totals(o).total)}</td></tr>`).join('')}</tbody></table>`
          : '<div class="empty">Обращений нет.</div>'
      }
    </div>`;
  root.append(c);
  c.querySelectorAll('tr.click').forEach((tr) => tr.addEventListener('click', () => ctx.navigate('#/orders/' + tr.dataset.id)));
  c.querySelector('#c-save').addEventListener('click', async () => {
    await saveClient({ ...client, name: c.querySelector('#c-name').value.trim(), phone: c.querySelector('#c-phone').value.trim(), address: c.querySelector('#c-address').value.trim(), notes: c.querySelector('#c-notes').value.trim() });
    ctx.toast('Сохранено');
  });
}
