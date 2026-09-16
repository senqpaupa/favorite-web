// Печать документов через браузер (надёжно: системный диалог печати + «Печать в PDF»).
// Документы:
//   intake — приёмная квитанция по образцу «Фаворит» №6.06: A4, 2 копии на листе (мастеру + клиенту).
//   act    — акт/чек выполненных работ: A4 или термочек 80 мм.
import { escapeHtml, fmtDate, fmtMoney, num } from './util.js';
import { totals } from './models.js';

function nl2br(s) {
  return escapeHtml(s).replaceAll('\n', '<br>');
}

// «ИНН … / ОГРН …, Свидетельство …»
function reqFooter(shop) {
  const p = [
    shop.inn && `ИНН ${escapeHtml(shop.inn)}`,
    shop.ogrn && `ОГРН ${escapeHtml(shop.ogrn)}`,
  ].filter(Boolean).join(' / ');
  return [p, escapeHtml(shop.cert)].filter(Boolean).join(', ');
}

function termsHtml(shop) {
  const items = String(shop.terms || '').split('\n').map((x) => x.trim()).filter(Boolean);
  return items.map((t, i) => `<div class="term">${i + 1}. ${escapeHtml(t)}</div>`).join('');
}

// ---------- Приёмная квитанция (одна копия) ----------
function intakeCopy(order, shop, label) {
  const fld = (l, v, underline) =>
    `<div class="f"><span class="l">${l}:</span> <span class="${underline ? 'u' : ''}">${escapeHtml(v || '')}</span></div>`;
  return `
  <div class="copy">
    <div class="qhead">
      <div class="qtitle">
        <div class="qnum">Квитанция № ${escapeHtml(order.number)}</div>
        <div class="qsub">На приём в ремонт оборудования</div>
      </div>
      <div class="qshop">
        <b>${escapeHtml(shop.shopName)} ${escapeHtml(shop.ownerFull)}</b>
        <div>${nl2br(shop.headerContacts)}</div>
        <div class="hours">${nl2br(shop.headerHours)}</div>
      </div>
    </div>

    <div class="cols">
      <div class="col">
        ${fld('Дата приёма', fmtDate(order.dateIn))}
        ${fld('ФИО', order.clientName)}
        ${fld('Телефон', order.clientPhone)}
      </div>
      <div class="col">
        ${fld('Тип техники', order.deviceType)}
        ${fld('Модель', order.deviceModel)}
      </div>
    </div>

    ${fld('Заявленная неисправность', order.declaredFault, true)}
    ${fld('Согласование цены', order.agreedPrice, true)}
    ${fld('Примечание', order.note)}

    <div class="terms">${termsHtml(shop)}</div>
    <div class="footreq">${reqFooter(shop)}</div>

    <div class="sign">
      <div>Оборудование в ремонт принял: _______________ (Приёмщик: ${escapeHtml(order.receiver || shop.receiverDefault)})</div>
      <div>Оборудование в ремонт сдал: _______________ (${escapeHtml(order.clientName)})</div>
    </div>
    ${label ? `<div class="label">${label}</div>` : ''}
  </div>`;
}

const intakeCss = `
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; margin: 0; font-size: 10px; line-height: 1.28; }
  .copy { padding: 2mm 0; }
  .qhead { position: relative; min-height: 46px; margin-bottom: 6px; }
  .qtitle { text-align: center; padding-top: 2px; }
  .qnum { font-size: 15px; font-weight: 700; }
  .qsub { font-size: 11px; }
  .qshop { position: absolute; top: 0; right: 0; text-align: right; font-size: 9px; max-width: 58%; }
  .qshop .hours { margin-top: 2px; }
  .cols { display: flex; gap: 20px; margin: 4px 0; }
  .col { flex: 1; }
  .f { margin: 2px 0; }
  .f .l { color: #000; }
  .u { border-bottom: 1px solid #000; font-weight: 600; padding: 0 2px; }
  .terms { margin: 6px 0; font-size: 8px; line-height: 1.25; color: #111; }
  .term { margin: 1px 0; }
  .footreq { font-size: 8px; margin-bottom: 6px; }
  .sign { font-size: 10px; }
  .sign > div { margin: 10px 0; }
  .label { text-align: right; font-size: 8px; color: #555; margin-top: 2px; }
  .cut { border-top: 1px dashed #000; text-align: center; margin: 4px 0; font-size: 9px; color: #555; }
  .cut span { background: #fff; padding: 0 8px; position: relative; top: -8px; }
`;

// ---------- Акт / чек выполненных работ ----------
const actBaseCss = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 2px; text-align: center; }
  .sub { text-align: center; color: #333; margin-bottom: 8px; }
  .req { text-align: center; font-size: 11px; color: #333; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  th, td { border: 1px solid #999; padding: 4px 6px; font-size: 12px; text-align: left; }
  th { background: #f0f0f0; }
  td.r, th.r { text-align: right; }
  td.c, th.c { text-align: center; }
  .field { margin: 3px 0; font-size: 13px; }
  .field b { display: inline-block; min-width: 150px; }
  .total { font-size: 15px; font-weight: 700; text-align: right; margin-top: 6px; }
  .sign { margin-top: 28px; display: flex; justify-content: space-between; font-size: 12px; }
`;
const actA4Css = `@page { size: A4; margin: 14mm; } ${actBaseCss}`;
const actThermalCss = `
  @page { size: 80mm auto; margin: 3mm; }
  ${actBaseCss}
  body { width: 74mm; }
  h1 { font-size: 14px; }
  .sub { font-size: 11px; }
  th, td { font-size: 10px; padding: 2px 3px; }
  .field { font-size: 11px; }
  .field b { min-width: 0; display: inline; font-weight: 700; }
  .total { font-size: 13px; }
  .sign { display: block; margin-top: 16px; }
`;

function worksRows(order) {
  return (order.works || [])
    .map((w, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(w.desc)}</td><td class="r">${fmtMoney(w.price)}</td></tr>`)
    .join('');
}
function partsRows(order) {
  return (order.parts || [])
    .map((p, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(p.name)}</td><td class="c">${num(p.qty) || 1}</td><td class="r">${fmtMoney(p.price)}</td><td class="r">${fmtMoney(num(p.qty || 1) * num(p.price))}</td></tr>`)
    .join('');
}

function actBody(order, shop) {
  const t = totals(order);
  const reqLine = [shop.ownerFull, shop.inn && `ИНН ${escapeHtml(shop.inn)}`, shop.ogrn && `ОГРН ${escapeHtml(shop.ogrn)}`]
    .filter(Boolean).map(escapeHtml).join(' · ');
  return `
    <h1>${escapeHtml(shop.shopName)}</h1>
    <div class="sub">Акт № ${escapeHtml(order.number)} · Выполненные работы</div>
    <div class="req">${reqLine}</div>
    <hr>
    <div class="field"><b>Клиент:</b> ${escapeHtml(order.clientName)} · ${escapeHtml(order.clientPhone)}</div>
    <div class="field"><b>Устройство:</b> ${escapeHtml(order.deviceType)} ${escapeHtml(order.deviceModel)}</div>
    <div class="field"><b>Неисправность:</b> ${escapeHtml(order.declaredFault)}</div>
    ${(order.works || []).length ? `<b>Работы</b>
    <table><thead><tr><th>#</th><th>Наименование</th><th class="r">Стоимость</th></tr></thead>
    <tbody>${worksRows(order)}</tbody></table>` : ''}
    ${(order.parts || []).length ? `<b>Запчасти</b>
    <table><thead><tr><th>#</th><th>Наименование</th><th class="c">Кол-во</th><th class="r">Цена</th><th class="r">Сумма</th></tr></thead>
    <tbody>${partsRows(order)}</tbody></table>` : ''}
    <div class="field r">Работы: ${fmtMoney(t.worksSum)} · Запчасти: ${fmtMoney(t.partsSum)}${t.urgentPercent ? ` · Срочность ${t.urgentPercent}%: ${fmtMoney(t.urgentAmount)}` : ''}</div>
    <div class="total">ИТОГО: ${fmtMoney(t.total)}</div>
    <div class="field"><b>Гарантия:</b> ${num(order.warrantyDays) || num(shop.warrantyDefaultDays) || 30} дн. · <b>Дата:</b> ${fmtDate(order.dateReady || order.dateDone || order.dateIn)}</div>
    <div class="sign">
      <div>Работу выполнил: _____________ (${escapeHtml(order.master || shop.receiverDefault)})</div>
      <div>Получил: _____________ (${escapeHtml(order.clientName)})</div>
    </div>
  `;
}

function openAndPrint(html) {
  const w = window.open('', '_blank', 'width=800,height=1000');
  if (!w) {
    alert('Разрешите всплывающие окна для печати.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  setTimeout(() => { try { w.focus(); w.print(); } catch (_) {} }, 500);
}

// kind: 'intake' | 'act'; format: 'a4' | 'thermal' (только для act; квитанция всегда A4 в 2 копии)
export function printDoc(order, shop, kind = 'act', format = 'a4') {
  if (kind === 'intake') {
    const body =
      intakeCopy(order, shop, 'экземпляр мастера') +
      `<div class="cut"><span>✂ отрезать</span></div>` +
      intakeCopy(order, shop, 'экземпляр клиента');
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
      <title>Квитанция № ${escapeHtml(order.number)}</title><style>${intakeCss}</style></head>
      <body>${body}</body></html>`;
    openAndPrint(html);
    return;
  }
  const css = format === 'thermal' ? actThermalCss : actA4Css;
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
    <title>Акт № ${escapeHtml(order.number)}</title><style>${css}</style></head>
    <body>${actBody(order, shop)}</body></html>`;
  openAndPrint(html);
}
