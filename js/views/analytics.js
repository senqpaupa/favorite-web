// Простая аналитика: выручка и число заказов за период.
import { listOrders } from '../db.js';
import { isCompleted, totals } from '../models.js';
import { fmtMoney, dateInputValue, escapeHtml } from '../util.js';

export async function renderAnalytics(root, ctx) {
  const all = await listOrders();

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="card">
      <h3>Аналитика</h3>
      <div class="f-row">
        <label>С<input id="a-from" type="date" value="${dateInputValue(from.toISOString())}"></label>
        <label>По<input id="a-to" type="date" value="${dateInputValue(now.toISOString())}"></label>
      </div>
      <div id="a-out"></div>
    </div>`;
  root.append(wrap);
  const out = wrap.querySelector('#a-out');

  function calc() {
    const from = wrap.querySelector('#a-from').value;
    const to = wrap.querySelector('#a-to').value;
    const f = from ? new Date(from) : new Date(0);
    const t = to ? new Date(to + 'T23:59:59') : new Date();
    // За выручку считаем выданные заказы по дате приёма в периоде.
    const inRange = all.filter((o) => {
      const d = new Date(o.dateReady || o.dateDone || o.dateIn);
      return d >= f && d <= t;
    });
    const completed = inRange.filter(isCompleted);
    const revenue = completed.reduce((s, o) => s + totals(o).total, 0);
    const partsCost = completed.reduce((s, o) => s + totals(o).partsSum, 0);
    const worksRevenue = completed.reduce((s, o) => s + totals(o).worksSum, 0);
    out.innerHTML = `
      <div class="stats">
        <div class="stat"><div class="v">${inRange.length}</div><div class="k">заказов за период</div></div>
        <div class="stat"><div class="v">${completed.length}</div><div class="k">выполнено/выдано</div></div>
        <div class="stat"><div class="v">${fmtMoney(revenue)}</div><div class="k">выручка (итого)</div></div>
        <div class="stat"><div class="v">${fmtMoney(worksRevenue)}</div><div class="k">из них работы</div></div>
        <div class="stat"><div class="v">${fmtMoney(partsCost)}</div><div class="k">запчасти</div></div>
      </div>`;
  }
  wrap.querySelector('#a-from').addEventListener('input', calc);
  wrap.querySelector('#a-to').addEventListener('input', calc);
  calc();
}
