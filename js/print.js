// Печать документов через браузер (надёжно: системный диалог печати + «Печать в PDF»).
// Два документа: приёмная квитанция (intake) и акт/чек выполненных работ (act).
// Две вёрстки: A4 и термочек 80 мм.
import { escapeHtml, fmtDate, fmtMoney, num } from './util.js';
import { FLAGS, totals } from './models.js';

function reqLine(shop) {
  const parts = [
    shop.ownerName,
    shop.inn && `ИНН ${escapeHtml(shop.inn)}`,
    shop.ogrn && `ОГРН ${escapeHtml(shop.ogrn)}`,
  ].filter(Boolean);
  return parts.map(escapeHtml).join(' · ');
}

function flagsLine(order) {
  const on = FLAGS.filter((f) => order.flags && order.flags[f.key]).map((f) => f.label);
  return on.length ? on.join(', ') : '—';
}

function worksRows(order) {
  return (order.works || [])
    .map(
      (w, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(w.desc)}</td><td class="r">${fmtMoney(w.price)}</td></tr>`
    )
    .join('');
}

function partsRows(order) {
  return (order.parts || [])
    .map(
      (p, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(p.name)}</td><td class="c">${num(p.qty) || 1}</td><td class="r">${fmtMoney(p.price)}</td><td class="r">${fmtMoney(num(p.qty || 1) * num(p.price))}</td></tr>`
    )
    .join('');
}

const baseCss = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { text-align: center; color: #333; margin-bottom: 10px; }
  .req { text-align: center; font-size: 11px; color: #333; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  th, td { border: 1px solid #999; padding: 4px 6px; font-size: 12px; text-align: left; }
  th { background: #f0f0f0; }
  td.r, th.r { text-align: right; }
  td.c, th.c { text-align: center; }
  .row { display: flex; gap: 16px; }
  .row > div { flex: 1; }
  .field { margin: 3px 0; font-size: 13px; }
  .field b { display: inline-block; min-width: 150px; }
  .total { font-size: 15px; font-weight: 700; text-align: right; margin-top: 6px; }
  .sign { margin-top: 28px; display: flex; justify-content: space-between; font-size: 12px; }
  .terms { font-size: 9px; color: #444; margin-top: 10px; line-height: 1.3; }
  .muted { color:#555; }
`;

const a4Css = `@page { size: A4; margin: 14mm; } ${baseCss}`;
const thermalCss = `
  @page { size: 80mm auto; margin: 3mm; }
  ${baseCss}
  body { width: 74mm; }
  h1 { font-size: 14px; text-align:center; }
  .sub { font-size: 11px; }
  th, td { font-size: 10px; padding: 2px 3px; }
  .field { font-size: 11px; }
  .field b { min-width: 0; display:inline; font-weight:700; }
  .total { font-size: 13px; }
  .sign { display:block; margin-top:16px; }
  .terms { display:none; }
`;

function intakeBody(order, shop) {
  return `
    <div class="sub">Квитанция № ${escapeHtml(order.number)} · Приём в ремонт</div>
    <div class="req">${reqLine(shop)}</div>
    ${shop.address ? `<div class="req">${escapeHtml(shop.address)}</div>` : ''}
    ${shop.phone ? `<div class="req">тел. ${escapeHtml(shop.phone)}</div>` : ''}
    <hr>
    <div class="row">
      <div>
        <div class="field"><b>Дата приёма:</b> ${fmtDate(order.dateIn)}</div>
        <div class="field"><b>ФИО:</b> ${escapeHtml(order.clientName)}</div>
        <div class="field"><b>Телефон:</b> ${escapeHtml(order.clientPhone)}</div>
        <div class="field"><b>Адрес:</b> ${escapeHtml(order.address)}</div>
      </div>
      <div>
        <div class="field"><b>Модель:</b> ${escapeHtml(order.deviceModel)}</div>
        <div class="field"><b>IMEI / S/N:</b> ${escapeHtml(order.imei || order.serial)}</div>
        <div class="field"><b>№ АКБ:</b> ${escapeHtml(order.batteryNo)}</div>
        <div class="field"><b>Приёмщик:</b> ${escapeHtml(order.receiver || shop.receiverDefault)}</div>
      </div>
    </div>
    <div class="field"><b>Заявленная неисправность:</b> ${escapeHtml(order.declaredFault)}</div>
    <div class="field"><b>Состояние/комплектация:</b> ${flagsLine(order)}</div>
    ${order.agreedPrice ? `<div class="field"><b>Согласование цены:</b> ${escapeHtml(order.agreedPrice)}</div>` : ''}
    ${order.note ? `<div class="field"><b>Примечание:</b> ${escapeHtml(order.note)}</div>` : ''}
    <div class="terms">
      С тарифами и условиями обслуживания ознакомлен. Оплата по окончании ремонта.
      Исполнитель не несёт ответственности за сохранность ПО и данных. Гарантия на ремонт —
      ${num(shop.warrantyDefaultDays) || 30} дн. Приёмный талон при утере восстанавливается по документу.
    </div>
    <div class="sign">
      <div>Оборудование в ремонт принял: _____________ (${escapeHtml(order.receiver || shop.receiverDefault)})</div>
      <div>Сдал: _____________ (${escapeHtml(order.clientName)})</div>
    </div>
  `;
}

function actBody(order, shop) {
  const t = totals(order);
  return `
    <div class="sub">Акт № ${escapeHtml(order.number)} · Выполненные работы</div>
    <div class="req">${reqLine(shop)}</div>
    ${shop.address ? `<div class="req">${escapeHtml(shop.address)}</div>` : ''}
    ${shop.phone ? `<div class="req">тел. ${escapeHtml(shop.phone)}</div>` : ''}
    <hr>
    <div class="field"><b>Клиент:</b> ${escapeHtml(order.clientName)} · ${escapeHtml(order.clientPhone)}</div>
    <div class="field"><b>Устройство:</b> ${escapeHtml(order.deviceModel)} ${order.imei ? '· IMEI ' + escapeHtml(order.imei) : ''}</div>
    <div class="field"><b>Неисправность:</b> ${escapeHtml(order.declaredFault)}</div>

    ${
      (order.works || []).length
        ? `<b>Работы</b>
    <table><thead><tr><th>#</th><th>Наименование</th><th class="r">Стоимость</th></tr></thead>
    <tbody>${worksRows(order)}</tbody></table>`
        : ''
    }

    ${
      (order.parts || []).length
        ? `<b>Запчасти</b>
    <table><thead><tr><th>#</th><th>Наименование</th><th class="c">Кол-во</th><th class="r">Цена</th><th class="r">Сумма</th></tr></thead>
    <tbody>${partsRows(order)}</tbody></table>`
        : ''
    }

    <div class="field r">Работы: ${fmtMoney(t.worksSum)} · Запчасти: ${fmtMoney(t.partsSum)}${t.urgentPercent ? ` · Срочность ${t.urgentPercent}%: ${fmtMoney(t.urgentAmount)}` : ''}</div>
    <div class="total">ИТОГО: ${fmtMoney(t.total)}</div>
    <div class="field"><b>Гарантия:</b> ${num(order.warrantyDays) || num(shop.warrantyDefaultDays) || 30} дн. · <b>Дата:</b> ${fmtDate(order.dateReady || order.dateDone || order.dateIn)}</div>
    <div class="sign">
      <div>Работу выполнил: _____________ (${escapeHtml(order.master || shop.receiverDefault)})</div>
      <div>Получил: _____________ (${escapeHtml(order.clientName)})</div>
    </div>
  `;
}

// kind: 'intake' | 'act'; format: 'a4' | 'thermal'
export function printDoc(order, shop, kind = 'act', format = 'a4') {
  const css = format === 'thermal' ? thermalCss : a4Css;
  const inner = kind === 'intake' ? intakeBody(order, shop) : actBody(order, shop);
  const title = `${kind === 'intake' ? 'Квитанция' : 'Акт'} № ${order.number || ''}`;
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
    <title>${escapeHtml(title)}</title><style>${css}</style></head>
    <body><h1 style="text-align:center">${escapeHtml(shop.ownerName || 'Ремонт')}</h1>${inner}</body></html>`;

  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) {
    alert('Разрешите всплывающие окна для печати.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Печатаем после полной загрузки содержимого.
  w.onload = () => {
    w.focus();
    w.print();
  };
  // запасной таймер, если onload не сработает
  setTimeout(() => {
    try { w.focus(); w.print(); } catch (_) {}
  }, 500);
}
