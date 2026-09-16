// Модель данных: статусы, типы техники, значения по умолчанию, расчёт итога.
import { uuid, nowISO, num } from './util.js';

export const STATUSES = [
  { key: 'accepted', label: 'Принят' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'ready', label: 'Готов' },
  { key: 'done', label: 'Выдан' },
  { key: 'declined', label: 'Отказ' },
];

export function statusLabel(key) {
  return (STATUSES.find((s) => s.key === key) || {}).label || key || '';
}

// «Выполненные» = выдан/отказ; всё остальное — «Текущие».
export function isCompleted(order) {
  return order.status === 'done' || order.status === 'declined';
}

// Тип техники — выпадающий список на приёмке (магазин ремонтирует не только телефоны).
export const DEVICE_TYPES = ['Телефон', 'Пульт', 'Телевизор', 'Ноутбук', 'Планшет', 'Другая техника'];

// Правила на квитанции (11 пунктов с бумажной квитанции «Фаворит»). Редактируются в Настройках.
export const DEFAULT_TERMS = [
  'С тарифами, условиями обслуживания и случаями не предоставления ремонта ОЗНАКОМЛЕН.',
  'Оплата производится по окончании ремонта наличными в кассу исполнителя.',
  'В случае отказа от ремонта, либо невозможности ремонта согласен оплатить проведение диагностики по тарифам СЦ от 200 до 600руб.',
  'При платном ремонте сроки ремонта от 3 (трёх) до 20 дней по согласованию с потребителем.',
  'Исполнитель освобождается от ответственности за полную или частичную утрату принятого им от потребителя оборудования, если потребитель предупреждён исполнителем об особых св-вах материала, которые могут повлечь за собой полную или частичную утрату (повреждение).',
  'Гарантия на платный ремонт 1 месяц.',
  'На ремонт не сертифицированного оборудования, ремонт связанный с попаданием жидкости, профилактическими работами, диагностику, выдачу технического заключения гарантия НЕ РАСПРОСТРАНЯЕТСЯ.',
  'Приёмный талон при утере восстанавливается при наличии документа, удостоверяющего личность, в сроки, установленные законодательством.',
  'При неоплате счёта за ремонт или диагностику в течение 2 месяцев (с даты приёма) оборудование может быть утилизировано без дополнительного согласования.',
  'При просрочке оплаты выставленного счёта за ремонт или диагностику более чем на одну неделю с момента оповещения, клиент обязуется оплатить хранение оборудования в соответствии с прейскурантом цен СЦ (50руб. за сутки хранения).',
  'Оплата ремонта или диагностики только наличным расчётом.',
].join('\n');

export function defaultSettings() {
  return {
    id: 'shop',
    shopName: 'м-н "Фаворит"',
    ownerFull: 'ИП Акопян Вячеслав Суренович',
    headerContacts: 'т. 60-64-21, ул. Суворова 45\nСерв.центр: т. 62-00-23, ул. Льва Толстого 23',
    headerHours: 'пн-пт: с 10-00 до 20-00\nсб-вс: с 10-00 до 17-00',
    inn: '272304682790',
    ogrn: '305272306000015',
    cert: 'Свидетельство о гос. регистр. серия 27 №001133374',
    receiverDefault: 'Акопян В.С.',
    warrantyDefaultDays: 30,
    printFormat: 'a4', // формат печати акта/чека: 'a4' | 'thermal' (квитанция всегда A4 в 2 копии)
    terms: DEFAULT_TERMS,
    supabaseUrl: '',
    supabaseKey: '',
    lastSyncAt: '',
    updatedAt: nowISO(),
  };
}

export function newOrder(seed = {}) {
  return {
    id: uuid(),
    number: '',
    clientId: '',
    clientName: '',
    clientPhone: '',
    address: '',
    dateIn: nowISO(),
    deviceType: 'Телефон',
    deviceModel: '',
    imei: '',
    serial: '',
    declaredFault: '',
    agreedPrice: '',
    status: 'accepted',
    receiver: '',
    master: '',
    urgent: false,
    urgentPercent: 0,
    note: '',
    warrantyDays: 0,
    works: [], // [{desc, price}]
    parts: [], // [{name, qty, price}]
    dateReady: '',
    dateDone: '',
    createdAt: nowISO(),
    updatedAt: nowISO(),
    deleted: false,
    ...seed,
  };
}

// Считаем итог заказа: работы + запчасти + надбавка за срочность.
export function totals(order) {
  const worksSum = (order.works || []).reduce((s, w) => s + num(w.price), 0);
  const partsSum = (order.parts || []).reduce((s, p) => s + num(p.qty || 1) * num(p.price), 0);
  const subtotal = worksSum + partsSum;
  const urgentPercent = order.urgent ? num(order.urgentPercent) : 0;
  const urgentAmount = (subtotal * urgentPercent) / 100;
  const total = subtotal + urgentAmount;
  return { worksSum, partsSum, subtotal, urgentPercent, urgentAmount, total };
}

// Автоподсказка следующего номера: N.MM (как 13.05, 6.06 в квитанциях).
export function suggestNumber(orders) {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  let maxSeq = 0;
  for (const o of orders) {
    const m = String(o.number || '').match(/^(\d+)/);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }
  return `${maxSeq + 1}.${mm}`;
}
