// Карточка заказа: поля приёмки + работы/запчасти + авто-ИТОГО + статус + печать.
// Один экран на весь цикл: принял → заполнил → готов → печать.
import { getOrder, saveOrder, softDeleteOrder, listOrders, listClients, saveClient, getSettings } from '../db.js';
import { newOrder, suggestNumber, totals, DEVICE_TYPES, STATUSES } from '../models.js';
import { fmtMoney, num, escapeHtml, dateInputValue, todayInputValue, uuid, nowISO } from '../util.js';
import { printDoc } from '../print.js';

export async function renderOrder(root, ctx, id) {
  const shop = await getSettings();
  let order;
  if (id) {
    order = await getOrder(id);
    if (!order) {
      root.innerHTML = '<div class="card err">Заказ не найден</div>';
      return;
    }
  } else {
    const all = await listOrders();
    order = newOrder({
      number: suggestNumber(all),
      receiver: shop.receiverDefault || '',
      warrantyDays: num(shop.warrantyDefaultDays) || 30,
    });
  }

  const c = document.createElement('div');
  c.className = 'order';
  c.innerHTML = template(order, shop);
  root.append(c);

  // ---- работы/запчасти: динамические строки ----
  const worksBody = c.querySelector('#works-body');
  const partsBody = c.querySelector('#parts-body');

  function addWork(w = { desc: '', price: '' }) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="w-desc" value="${escapeHtml(w.desc)}" placeholder="Что сделано"></td>
      <td style="width:130px"><input class="w-price money" inputmode="decimal" value="${escapeHtml(w.price)}" placeholder="0"></td>
      <td style="width:34px"><button class="btn icon del">✕</button></td>`;
    tr.querySelector('.del').addEventListener('click', () => { tr.remove(); recalc(); });
    tr.querySelectorAll('input').forEach((i) => i.addEventListener('input', recalc));
    worksBody.append(tr);
  }
  function addPart(p = { name: '', qty: 1, price: '' }) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="p-name" value="${escapeHtml(p.name)}" placeholder="Запчасть"></td>
      <td style="width:70px"><input class="p-qty money" inputmode="decimal" value="${escapeHtml(p.qty ?? 1)}"></td>
      <td style="width:110px"><input class="p-price money" inputmode="decimal" value="${escapeHtml(p.price)}" placeholder="0"></td>
      <td style="width:34px"><button class="btn icon del">✕</button></td>`;
    tr.querySelector('.del').addEventListener('click', () => { tr.remove(); recalc(); });
    tr.querySelectorAll('input').forEach((i) => i.addEventListener('input', recalc));
    partsBody.append(tr);
  }

  (order.works || []).forEach(addWork);
  (order.parts || []).forEach(addPart);
  if (!(order.works || []).length) addWork();
  if (!(order.parts || []).length) addPart();

  c.querySelector('#add-work').addEventListener('click', () => addWork());
  c.querySelector('#add-part').addEventListener('click', () => addPart());

  // ---- сбор формы в объект ----
  function gather() {
    const g = (sel) => c.querySelector(sel);
    const works = [...worksBody.querySelectorAll('tr')]
      .map((tr) => ({ desc: tr.querySelector('.w-desc').value.trim(), price: num(tr.querySelector('.w-price').value) }))
      .filter((w) => w.desc || w.price);
    const parts = [...partsBody.querySelectorAll('tr')]
      .map((tr) => ({ name: tr.querySelector('.p-name').value.trim(), qty: num(tr.querySelector('.p-qty').value) || 1, price: num(tr.querySelector('.p-price').value) }))
      .filter((p) => p.name || p.price);
    return {
      ...order,
      number: g('#f-number').value.trim(),
      dateIn: g('#f-dateIn').value ? new Date(g('#f-dateIn').value).toISOString() : order.dateIn,
      clientName: g('#f-clientName').value.trim(),
      clientPhone: g('#f-clientPhone').value.trim(),
      deviceType: g('#f-deviceType').value,
      deviceModel: g('#f-deviceModel').value.trim(),
      declaredFault: g('#f-declaredFault').value.trim(),
      agreedPrice: g('#f-agreedPrice').value.trim(),
      status: g('#f-status').value,
      warrantyDays: num(g('#f-warrantyDays').value),
      note: g('#f-note').value.trim(),
      works,
      parts,
    };
  }

  function recalc() {
    const t = totals(gather());
    c.querySelector('#t-works').textContent = fmtMoney(t.worksSum);
    c.querySelector('#t-parts').textContent = fmtMoney(t.partsSum);
    c.querySelector('#t-total').textContent = fmtMoney(t.total);
  }
  c.querySelectorAll('input, select, textarea').forEach((i) => i.addEventListener('input', recalc));
  recalc();

  // ---- привязка/создание клиента для истории ----
  async function linkClient(o) {
    if (o.clientId) return o.clientId;
    if (!o.clientName && !o.clientPhone) return '';
    const clients = await listClients();
    let cl = clients.find((x) => o.clientPhone && x.phone === o.clientPhone);
    if (!cl) {
      cl = { id: uuid(), name: o.clientName, phone: o.clientPhone, address: o.address, notes: '', createdAt: nowISO(), deleted: false };
      await saveClient(cl);
    }
    return cl.id;
  }

  async function persist() {
    const o = gather();
    o.clientId = await linkClient(o);
    if (o.status === 'ready' && !o.dateReady) o.dateReady = nowISO();
    if (o.status === 'done' && !o.dateDone) o.dateDone = nowISO();
    order = await saveOrder(o);
    return order;
  }

  // ---- кнопки ----
  c.querySelector('#save').addEventListener('click', async () => {
    await persist();
    ctx.toast('Сохранено');
    ctx.navigate('#/orders');
  });

  c.querySelector('#print-intake').addEventListener('click', async () => {
    const o = await persist();
    printDoc(o, shop, 'intake', c.querySelector('#print-format').value);
  });
  c.querySelector('#print-act').addEventListener('click', async () => {
    const o = await persist();
    printDoc(o, shop, 'act', c.querySelector('#print-format').value);
  });

  c.querySelector('#ready').addEventListener('click', async () => {
    c.querySelector('#f-status').value = 'ready';
    const o = await persist();
    ctx.toast('Заказ готов');
    printDoc(o, shop, 'act', c.querySelector('#print-format').value);
  });

  const delBtn = c.querySelector('#delete');
  if (id) {
    delBtn.addEventListener('click', async () => {
      if (confirm('Удалить заказ?')) {
        await softDeleteOrder(id);
        ctx.toast('Удалено', 'warn');
        ctx.navigate('#/orders');
      }
    });
  } else {
    delBtn.style.display = 'none';
  }

  c.querySelector('#f-number-suggest').addEventListener('click', async () => {
    const all = await listOrders();
    c.querySelector('#f-number').value = suggestNumber(all);
  });
}

function template(o, shop) {
  const deviceTypeOpts = DEVICE_TYPES.map((t) => `<option value="${escapeHtml(t)}" ${o.deviceType === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('');
  const statusOpts = STATUSES.map((s) => `<option value="${s.key}" ${o.status === s.key ? 'selected' : ''}>${s.label}</option>`).join('');
  return `
    <div class="order-head">
      <a class="back" href="#/orders">← Заказы</a>
      <div class="print-controls">
        <select id="print-format" class="mini">
          <option value="${shop.printFormat === 'thermal' ? 'thermal' : 'a4'}">${shop.printFormat === 'thermal' ? 'Термочек 80мм' : 'A4 лист'}</option>
          <option value="a4">A4 лист</option>
          <option value="thermal">Термочек 80мм</option>
        </select>
        <button id="print-intake" class="btn">🧾 Приёмная квитанция</button>
        <button id="print-act" class="btn">🧾 Печать чека/акта</button>
      </div>
    </div>

    <div class="grid2">
      <div class="card">
        <h3>Приёмка</h3>
        <div class="f-row">
          <label>№ заказа
            <div class="inline"><input id="f-number" value="${escapeHtml(o.number)}"><button id="f-number-suggest" class="btn icon" title="Следующий номер">↻</button></div>
          </label>
          <label>Дата приёма<input id="f-dateIn" type="date" value="${o.dateIn ? dateInputValue(o.dateIn) : todayInputValue()}"></label>
          <label>Статус<select id="f-status">${statusOpts}</select></label>
        </div>
        <div class="f-row">
          <label>Фамилия / ФИО<input id="f-clientName" value="${escapeHtml(o.clientName)}"></label>
          <label>Телефон<input id="f-clientPhone" value="${escapeHtml(o.clientPhone)}"></label>
        </div>
        <div class="f-row">
          <label>Тип техники<select id="f-deviceType">${deviceTypeOpts}</select></label>
          <label>Модель<input id="f-deviceModel" value="${escapeHtml(o.deviceModel)}"></label>
        </div>
        <label>Заявленная неисправность<textarea id="f-declaredFault" rows="2">${escapeHtml(o.declaredFault)}</textarea></label>
        <label>Согласование цены<input id="f-agreedPrice" value="${escapeHtml(o.agreedPrice)}"></label>
        <label>Гарантия, дней<input id="f-warrantyDays" class="mini" inputmode="decimal" value="${escapeHtml(o.warrantyDays)}"></label>
        <label>Примечание<textarea id="f-note" rows="2">${escapeHtml(o.note)}</textarea></label>
      </div>

      <div class="card">
        <h3>Выполненные работы</h3>
        <table class="lines"><tbody id="works-body"></tbody></table>
        <button id="add-work" class="btn small">+ работа</button>

        <h3 style="margin-top:16px">Запчасти</h3>
        <table class="lines"><thead><tr><th>Наименование</th><th>Кол-во</th><th>Цена</th><th></th></tr></thead><tbody id="parts-body"></tbody></table>
        <button id="add-part" class="btn small">+ запчасть</button>

        <div class="totals">
          <div>Работы: <b id="t-works">0 ₽</b></div>
          <div>Запчасти: <b id="t-parts">0 ₽</b></div>
          <div class="grand">ИТОГО: <b id="t-total">0 ₽</b></div>
        </div>

        <div class="actions">
          <button id="save" class="btn primary">💾 Сохранить</button>
          <button id="ready" class="btn ok">✓ Готов + печать</button>
          <button id="delete" class="btn danger">Удалить</button>
        </div>
      </div>
    </div>
  `;
}
