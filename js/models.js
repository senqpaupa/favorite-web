// Модель данных: статусы, флаги состояния, значения по умолчанию, расчёт итога.
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

// Чекбоксы состояния как в ServiceCenter / на бумажной квитанции.
export const FLAGS = [
  { key: 'noPower', label: 'не включается' },
  { key: 'noCharge', label: 'не заряжается' },
  { key: 'moisture', label: 'следы влаги' },
  { key: 'opened', label: 'следы вскрытия' },
  { key: 'scratches', label: 'царапины' },
  { key: 'scuffs', label: 'потёртости' },
  { key: 'chips', label: 'сколы' },
  { key: 'cracks', label: 'трещины' },
  { key: 'chargerIncluded', label: 'СЗУ в комплекте' },
  { key: 'inspectionUnpaid', label: 'осмотр не оплачен' },
];

export function defaultSettings() {
  return {
    id: 'shop',
    ownerName: 'ИП',
    inn: '272304682790',
    ogrn: '305272306000015',
    cert: 'Свидетельство о гос. регистрации серия 27 №001133374',
    address: '',
    phone: '',
    receiverDefault: 'Акопян В.С.',
    warrantyDefaultDays: 30,
    printFormat: 'a4', // 'a4' | 'thermal'
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
    deviceModel: '',
    imei: '',
    serial: '',
    batteryNo: '',
    declaredFault: '',
    flags: {},
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

// Автоподсказка следующего номера: N.MM (как 13.05, 17.05 в ServiceCenter).
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
