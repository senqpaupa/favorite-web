// Настройки: реквизиты мастерской (шапка чека), формат печати, подключение Supabase, бэкапы.
import { getSettings, saveSettings, exportAll, importAll } from '../db.js';
import { testConnection } from '../sync.js';
import { escapeHtml, fmtDate } from '../util.js';

export async function renderSettings(root, ctx) {
  const s = await getSettings();
  const c = document.createElement('div');
  c.innerHTML = `
    <div class="grid2">
      <div class="card">
        <h3>Реквизиты мастерской (в шапке чека)</h3>
        <label>Название / ИП<input id="s-ownerName" value="${escapeHtml(s.ownerName)}"></label>
        <div class="f-row">
          <label>ИНН<input id="s-inn" value="${escapeHtml(s.inn)}"></label>
          <label>ОГРН<input id="s-ogrn" value="${escapeHtml(s.ogrn)}"></label>
        </div>
        <label>Свидетельство<input id="s-cert" value="${escapeHtml(s.cert)}"></label>
        <label>Адрес<input id="s-address" value="${escapeHtml(s.address)}"></label>
        <label>Телефон<input id="s-phone" value="${escapeHtml(s.phone)}"></label>
        <div class="f-row">
          <label>Приёмщик по умолчанию<input id="s-receiverDefault" value="${escapeHtml(s.receiverDefault)}"></label>
          <label>Гарантия по умолч., дней<input id="s-warrantyDefaultDays" class="mini" value="${escapeHtml(s.warrantyDefaultDays)}"></label>
        </div>
        <label>Формат печати по умолчанию
          <select id="s-printFormat">
            <option value="a4" ${s.printFormat === 'a4' ? 'selected' : ''}>A4 лист</option>
            <option value="thermal" ${s.printFormat === 'thermal' ? 'selected' : ''}>Термочек 80мм</option>
          </select>
        </label>
        <div class="actions"><button id="s-save" class="btn primary">💾 Сохранить реквизиты</button></div>
      </div>

      <div class="card">
        <h3>Облако (Supabase) — необязательно</h3>
        <p class="muted small">Без этого приложение работает локально. Заполни, чтобы данные бэкапились в облако и были видны с телефона. Ключи возьми в Supabase → Project Settings → API (URL и anon public key).</p>
        <label>Project URL<input id="s-supabaseUrl" placeholder="https://xxxx.supabase.co" value="${escapeHtml(s.supabaseUrl)}"></label>
        <label>anon key<input id="s-supabaseKey" value="${escapeHtml(s.supabaseKey)}"></label>
        <div class="actions">
          <button id="s-test" class="btn">Проверить связь</button>
          <button id="s-save-cloud" class="btn primary">💾 Сохранить облако</button>
        </div>
        <div class="muted small">Последняя синхронизация: ${s.lastSyncAt ? fmtDate(s.lastSyncAt) : '—'}</div>

        <h3 style="margin-top:18px">Бэкап</h3>
        <div class="actions">
          <button id="s-export" class="btn">⬇ Скачать бэкап</button>
          <label class="btn" style="cursor:pointer">⬆ Загрузить бэкап<input id="s-import" type="file" accept="application/json" style="display:none"></label>
        </div>
      </div>
    </div>`;
  root.append(c);

  const val = (id) => c.querySelector(id).value.trim();

  c.querySelector('#s-save').addEventListener('click', async () => {
    await saveSettings({
      ownerName: val('#s-ownerName'), inn: val('#s-inn'), ogrn: val('#s-ogrn'), cert: val('#s-cert'),
      address: val('#s-address'), phone: val('#s-phone'), receiverDefault: val('#s-receiverDefault'),
      warrantyDefaultDays: val('#s-warrantyDefaultDays'), printFormat: c.querySelector('#s-printFormat').value,
    });
    ctx.toast('Реквизиты сохранены');
  });

  c.querySelector('#s-save-cloud').addEventListener('click', async () => {
    await saveSettings({ supabaseUrl: val('#s-supabaseUrl'), supabaseKey: val('#s-supabaseKey') });
    ctx.toast('Настройки облака сохранены');
  });

  c.querySelector('#s-test').addEventListener('click', async () => {
    try {
      await testConnection(val('#s-supabaseUrl'), val('#s-supabaseKey'));
      ctx.toast('Связь есть ✓');
    } catch (e) {
      ctx.toast('Нет связи: ' + e.message, 'err');
    }
  });

  c.querySelector('#s-export').addEventListener('click', async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `favorie-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  c.querySelector('#s-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      await importAll(data);
      ctx.toast('Бэкап загружен');
    } catch (err) {
      ctx.toast('Ошибка импорта: ' + err.message, 'err');
    }
  });
}
