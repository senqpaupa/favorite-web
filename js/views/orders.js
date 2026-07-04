// Список заказов: вкладки «Текущие» / «Выполненные», поиск, кнопка нового заказа.
import { listOrders } from '../db.js';
import { isCompleted, statusLabel } from '../models.js';
import { fmtDate, fmtMoney, escapeHtml, debounce } from '../util.js';
import { totals } from '../models.js';

let state = { tab: 'current', q: '' };

export async function renderOrders(root, ctx) {
  const all = await listOrders();

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="toolbar">
      <div class="tabs">
        <button class="tab ${state.tab === 'current' ? 'active' : ''}" data-tab="current">Текущие</button>
        <button class="tab ${state.tab === 'completed' ? 'active' : ''}" data-tab="completed">Выполненные</button>
      </div>
      <input id="q" class="search" type="search" placeholder="Поиск: фамилия, телефон, модель, №" value="${escapeHtml(state.q)}">
      <button id="new-order" class="btn primary">+ Новый заказ</button>
    </div>
    <div id="list"></div>
  `;
  root.append(wrap);

  const listEl = wrap.querySelector('#list');

  function draw() {
    const q = state.q.trim().toLowerCase();
    const rows = all
      .filter((o) => (state.tab === 'completed' ? isCompleted(o) : !isCompleted(o)))
      .filter((o) => {
        if (!q) return true;
        return [o.number, o.clientName, o.clientPhone, o.deviceModel, o.declaredFault]
          .map((x) => String(x || '').toLowerCase())
          .some((x) => x.includes(q));
      });

    if (!rows.length) {
      listEl.innerHTML = `<div class="empty">Нет заказов${q ? ' по запросу' : ''}.</div>`;
      return;
    }

    listEl.innerHTML = `
      <table class="grid">
        <thead><tr>
          <th>Дата</th><th>№</th><th>Фамилия</th><th>Модель</th><th>Телефон</th>
          <th>Статус</th><th class="r">Итого</th>
        </tr></thead>
        <tbody>
          ${rows
            .map(
              (o) => `<tr data-id="${o.id}" class="click">
            <td>${fmtDate(o.dateIn)}</td>
            <td>${escapeHtml(o.number)}</td>
            <td>${escapeHtml(o.clientName)}</td>
            <td>${escapeHtml(o.deviceModel)}</td>
            <td>${escapeHtml(o.clientPhone)}</td>
            <td><span class="pill s-${o.status}">${statusLabel(o.status)}</span></td>
            <td class="r">${fmtMoney(totals(o).total)}</td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>`;

    listEl.querySelectorAll('tr.click').forEach((tr) =>
      tr.addEventListener('click', () => ctx.navigate('#/orders/' + tr.dataset.id))
    );
  }

  wrap.querySelectorAll('.tab').forEach((b) =>
    b.addEventListener('click', () => {
      state.tab = b.dataset.tab;
      wrap.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
      draw();
    })
  );
  wrap.querySelector('#new-order').addEventListener('click', () => ctx.navigate('#/orders/new'));
  wrap.querySelector('#q').addEventListener(
    'input',
    debounce((e) => {
      state.q = e.target.value;
      draw();
    }, 200)
  );

  draw();
}
