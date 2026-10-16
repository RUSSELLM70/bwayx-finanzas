// Arranque y eventos. La lógica vive en ctx/derive/actions; las pantallas en views/sheets.
import { shift, today, iso } from './dates.js';
import { sanitizeInput, cleanText } from './inputs.js';
import * as mirror from './mirror.js';
import * as notify from './notify.js';
import { ask } from './dialog.js';
import { buildIcs } from './ics.js';
import { vaultReload } from './vault-ui.js';
import { sanitizeImport, demoData, demoExtras, uid, load } from './store.js';
import { changeBase } from './money.js';
import { buildXlsx } from './xlsx.js';
import { state, ui, security, health, markBackup, installDue, notifySettings, $, persist, parseNum, round2, mkAmount, updatePreviews, toast, setRender, render, P as PATHS } from './ctx.js';
import { exportModel, calendarEvents } from './derive.js';
import { removePayment, removeCharge, togglePay } from './actions.js';
import { VIEWS, NAV, listHtml, debtResultsHtml } from './views.js';
import { openSheet, installSheet, versionsSheet, pinSheet, billSheet, debtSheet, paySheet, chargeSheet, goalSheet, depositSheet, fixedSheet, closeSheet, fillCats, submitCurrent, sheetDelete } from './sheets.js';

if (!state.settings.onboarded && state.txs.length === 0) ui.view = 'setup';
const startView = new URLSearchParams(location.search || '').get('view'); // viene de tocar una notificación
if (startView && VIEWS[startView] && startView !== 'setup' && ui.view !== 'setup') ui.view = startView;

// ---------- Render ----------
const MORE = ['more', 'moves', 'advice', 'settings'];
const FAB = { pagos: ['Nuevo pago', billSheet], debts: ['Agregar tarjeta o deuda', () => debtSheet()], savings: ['Nueva meta de ahorro', () => goalSheet()] };
setRender(() => {
  $('#nav').innerHTML = `<div class="brand"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0b0b0f"/><rect x="6" y="17" width="5" height="9" rx="1.5" fill="#2563eb"/><rect x="13.5" y="12" width="5" height="14" rx="1.5" fill="#3b82f6"/><rect x="21" y="6" width="5" height="20" rx="1.5" fill="#34d399"/></svg><span class="bname">BWAY X<small>Finanzas</small></span></div>` + NAV.map(([k, l, i, vis]) => {
    const cur = k === 'more' ? MORE.includes(ui.view) : ui.view === k;
    return `<button class="${vis ? 'only-' + vis : ''}" data-act="nav" data-v="${k}" ${cur ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22"><path d="${PATHS[i]}"/></svg><span>${l}</span></button>`;
  }).join('');
  $('#main').innerHTML = VIEWS[ui.view]();
  $('#fab').hidden = ui.view === 'setup';
  $('#fab').setAttribute('aria-label', (FAB[ui.view] || ['Agregar movimiento'])[0]);
  updatePreviews();
  notify.scheduleRefresh(); // mantiene al día la agenda de avisos
});

// ---------- Exportar a Excel ----------
async function exportXlsx() {
  let bytes;
  try { bytes = buildXlsx(exportModel()); } catch (e) { console.error(e); return toast('No se pudo generar el Excel'); }
  const name = `BWAY-X-Finanzas-${today()}.xlsx`;
  const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const file = new File([bytes], name, { type });
  if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) { // móvil: hoja de compartir (Guardar en Archivos, Drive, WhatsApp…)
    try { await navigator.share({ files: [file], title: 'BWAY X - Finanzas' }); markBackup(); return toast('Excel listo'); } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  markBackup(); toast('Excel descargado');
}

// ---------- Eventos ----------
document.addEventListener('click', (e) => {
  if (e.target.id === 'overlay') return closeSheet();
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const v = b.dataset.v, id = b.dataset.id;
  switch (b.dataset.act) {
    case 'nav': ui.view = v; render(); $('#main').focus(); window.scrollTo(0, 0); break;
    case 'kind': ui.kind = v; render(); break;
    case 'shift': ui.anchor = shift(ui.kind, ui.anchor, +v); render(); break;
    case 'now': ui.anchor = today(); render(); break;
    case 'filter': ui.filter = v; render(); break;
    case 'add': openSheet(); break;
    case 'addinc': openSheet(null, 'income'); break;
    case 'edit': openSheet(state.txs.find((t) => t.id === id)); break;
    case 'delpay': {
      const t = state.txs.find((x) => x.id === id);
      if (t) ask({ title: '¿Eliminar este pago?', message: 'El monto se devolverá al saldo de la deuda.', confirm: 'Eliminar', tone: 'danger' })
        .then((ok) => { if (ok) { removePayment(t); render(); toast('Pago eliminado: saldo restaurado'); } });
      break;
    }
    case 'close': closeSheet(); break;
    case 'sheetdel': sheetDelete(); break;
    case 'type':
      $('#f-type').value = v;
      document.querySelectorAll('.toggle button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === v)));
      fillCats(); break;

    // guía de inicio
    case 'ifreq': { ui.ifreq = v; const amt = $('#i-amt')?.value; render(); if (amt) { $('#i-amt').value = amt; updatePreviews(); } break; }
    case 'step': ui.step = +v; render(); window.scrollTo(0, 0); break;
    case 'guide': ui.view = 'setup'; ui.step = 1; ui.kind = 'fortnight'; ui.anchor = today(); render(); window.scrollTo(0, 0); break;
    case 'skip': state.settings.onboarded = true; persist(); ui.view = 'home'; render(); break;
    case 'finish': state.settings.onboarded = true; persist(); ui.kind = 'month'; ui.anchor = today(); ui.view = 'advice'; render(); window.scrollTo(0, 0); toast('Listo: este es tu análisis'); break;
    case 'addincome': {
      const n = parseNum($('#i-amt').value), date = $('#i-date').value;
      if (!(n > 0)) { $('#i-err').textContent = 'Ingresa un monto mayor que cero.'; $('#i-amt').focus(); break; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $('#i-err').textContent = 'Elige una fecha válida.'; break; }
      state.txs.push({ id: uid(), type: 'income', category: $('#i-cat').value, note: ({ day: 'Ganancia del día', week: 'Pago semanal', fortnight: 'Pago de quincena' })[ui.ifreq] || 'Ingreso', date, ...mkAmount(n, $('#i-cur').value) });
      persist(); ui.anchor = date; render(); $('#i-amt').focus(); toast('Sumado a tus ingresos'); break;
    }
    case 'addfixed': {
      const name = cleanText($('#x-name').value, 60), n = parseNum($('#x-amt').value);
      const freq = $('#x-freq')?.value || 'monthly';
      const day = Math.min(31, Math.max(1, parseInt($('#x-day').value, 10) || 1));
      if (!name) { $('#x-err').textContent = 'Escribe un nombre.'; $('#x-name').focus(); break; }
      if (!(n > 0)) { $('#x-err').textContent = 'Ingresa un monto mayor que cero.'; $('#x-amt').focus(); break; }
      const first = new Date(); first.setDate(1);
      const since = freq === 'monthly' ? iso(first) : today();
      state.fixed.push({ id: uid(), name, amount: round2(n), currency: $('#x-cur').value, category: $('#x-cat').value, day, freq, since });
      persist(); render(); $('#x-name').focus(); toast('Gasto fijo agregado'); break;
    }
    case 'editfixed': { const fx = state.fixed.find((f) => f.id === id); if (fx) fixedSheet(fx); break; }
    case 'delfixed':
      ask({ title: '¿Quitar este gasto fijo?', message: 'Se quitará de todos los meses, incluidos los pasados.', confirm: 'Quitar', tone: 'danger' }).then((ok) => {
        if (!ok) return;
        state.fixed = state.fixed.filter((f) => f.id !== id);
        for (const k of Object.keys(state.paid)) if (k.startsWith(`fx:${id}:`)) delete state.paid[k];
        persist(); render(); toast('Gasto fijo quitado');
      });
      break;

    // pagos
    case 'togglepay': { const msg = togglePay(b.dataset.key); render(); if (msg) toast(msg); break; }
    case 'addbill': billSheet(); break;
    case 'delbill':
      ask({ title: '¿Eliminar este pago?', message: 'Se quitará de tu lista de pagos.', confirm: 'Eliminar', tone: 'danger' })
        .then((ok) => { if (ok) { state.txs = state.txs.filter((t) => t.id !== id); persist(); render(); toast('Pago eliminado'); } });
      break;

    // deudas
    case 'adddebt': debtSheet(); break;
    case 'editdebt': debtSheet(state.debts.find((d) => d.id === id)); break;
    case 'paydebt': paySheet(id); break;
    case 'chargedebt': chargeSheet(id); break;
    case 'delcharge': {
      const t = state.txs.find((x) => x.id === id);
      if (t) ask({ title: '¿Eliminar esta compra?', message: 'El monto se restará del saldo de la tarjeta.', confirm: 'Eliminar', tone: 'danger' })
        .then((ok) => { if (ok) { removeCharge(t); render(); toast('Compra eliminada: saldo restaurado'); } });
      break;
    }
    case 'payextra': { // el extra viene en moneda base; la deuda puede estar en otra moneda
      const d = state.debts.find((x) => x.id === id);
      const rate = d && d.currency === state.settings.altCurrency ? state.settings.altRate : 1;
      paySheet(id, round2(+b.dataset.amt / rate)); break;
    }
    case 'method': ui.method = v; state.settings.method = v; persist(); render(); break;
    case 'extra': state.settings.debtExtra = +v; persist(); render(); break;

    // ahorros
    case 'addgoal': goalSheet(); break;
    case 'editgoal': goalSheet(state.goals.find((g) => g.id === id)); break;
    case 'deposit': depositSheet(id, v); break;

    // datos
    case 'exportxlsx': exportXlsx(); break;
    case 'export': {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
      a.download = `finanzasos-${today()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      markBackup(); render(); toast('Copia de seguridad descargada');
      break;
    }
    case 'import': $('#file').click(); break;
    case 'setpin': pinSheet(); break;
    case 'notifyon': notify.enable().then((p) => {
      if (p === 'granted') { state.settings.notify = { ...notifySettings(), on: true }; persist(); render(); notify.refreshAgenda().catch(() => {}); notify.showNow('¡Listo!', 'Te avisaré cuando se acerque un pago y con consejos según tus gastos.').catch(() => {}); toast('Notificaciones activadas'); }
      else toast(p === 'unsupported' ? 'Este navegador no permite notificaciones' : 'Permiso no concedido: actívalo en los ajustes del navegador');
      render();
    }); break;
    case 'notifyoff': state.settings.notify = { ...notifySettings(), on: false }; persist(); notify.disable(); render(); toast('Notificaciones desactivadas'); break;
    case 'notifytips': state.settings.notify = { ...notifySettings(), tips: !notifySettings().tips }; persist(); render(); break;
    case 'notifytest': notify.showNow('Prueba de BWAY X', 'Así se verán tus avisos de pagos y consejos.').then(() => toast('Enviada')).catch(() => toast('No se pudo enviar')); break;
    case 'exportics': {
      const ev = calendarEvents();
      if (!ev.length) { toast('No hay pagos pendientes para agendar'); break; }
      const file = new File([buildIcs(ev)], `BWAY-X-pagos-${today()}.ics`, { type: 'text/calendar' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(`${ev.length} recordatorios listos: ábrelos para agregarlos al calendario`); break;
    }
    case 'versions': mirror.listHistory().then((l) => versionsSheet(l)); break;
    case 'restorever': {
      mirror.listHistory().then(async (l) => {
        const e = l[+v];
        if (!e || !(await ask({ title: '¿Restaurar esta versión?', message: 'Antes guardaremos una copia de tus datos actuales para que puedas volver.', confirm: 'Restaurar' }))) return;
        await mirror.mirrorNow(true); mirror.applyEntry(e); location.reload();
      });
      break;
    }
    case 'hideinstall': state.settings.hideInstall = true; persist(); if (!$('#overlay').hidden) closeSheet(); render(); toast('Listo, no volverá a aparecer. Puedes instalarla desde Ajustes'); break;
    case 'installhelp': installSheet(false); break;
    case 'installapp': health.prompt?.prompt(); break;
    case 'removepin':
      ask({ title: '¿Quitar el PIN?', message: 'Tus datos quedarán sin cifrar en este dispositivo.', confirm: 'Quitar PIN', tone: 'danger' })
        .then((ok) => { if (ok) { security.disablePin(); render(); toast('PIN eliminado'); } });
      break;
    case 'lock': vaultReload(); break;
    case 'demo':
      if (state.txs.length) ask({ title: '¿Agregar datos de ejemplo?', message: 'Se sumarán a tus datos actuales y no podrás separarlos después.', confirm: 'Agregar', tone: 'warn' }).then((ok) => ok && loadDemo());
      else loadDemo();
      break;
    case 'wipe':
      ask({ title: '¿Borrar todos tus datos?', message: 'Se eliminarán movimientos, deudas, ahorros y ajustes de este dispositivo. Esta acción no se puede deshacer.', confirm: 'Borrar todo', tone: 'danger' }).then((ok) => {
        if (!ok) return;
        security.reset(); localStorage.clear(); Object.assign(state, load()); ui.view = 'setup'; ui.step = 1; render(); toast('Datos borrados');
      });
      break;
  }
});
function loadDemo() {
  state.txs.push(...demoData());
  if (!state.debts.length && !state.goals.length) { const x = demoExtras(); state.debts.push(...x.debts); state.goals.push(...x.goals); state.txs.push(...x.savingTxs); }
  if (!state.fixed.length) { const first = new Date(); first.setDate(1); first.setMonth(first.getMonth() - 2); state.fixed.push({ id: uid(), name: 'Alquiler', amount: 260000, currency: 'CRC', category: 'Vivienda', day: 2, since: iso(first) }); }
  state.settings.onboarded = true; persist(); ui.anchor = today(); ui.view = 'home'; render(); toast('Datos de ejemplo cargados');
}
$('#fab').addEventListener('click', () => (FAB[ui.view]?.[1] || (() => openSheet()))());
document.addEventListener('submit', (e) => { e.preventDefault(); submitCurrent(); });
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset?.n) sanitizeInput(t, t.dataset.n, e.inputType);
  if (t.id === 'q') { ui.q = t.value; $('#txlist').innerHTML = listHtml(); }
  if (t.dataset?.extra !== undefined) { // recalcula la estrategia en vivo sin perder el foco
    const n = parseNum(t.value);
    state.settings.debtExtra = n >= 0 ? n : 0; persist();
    $('#debtres').innerHTML = debtResultsHtml();
  }
  updatePreviews();
});
document.addEventListener('change', (e) => {
  const t = e.target, st = state.settings;
  updatePreviews();
  if (t.dataset.setting === 'currency') changeBase(st, t.value);
  else if (t.dataset.setting === 'altCurrency') { if (t.value !== st.currency) st.altCurrency = t.value; }
  else if (t.dataset.setting === 'altRate') { const n = parseNum(t.value); if (n > 0) st.altRate = n; else return toast('Tipo de cambio inválido'); }
  else if (t.dataset.setting === 'notifyLead') state.settings.notify = { ...notifySettings(), lead: +t.value };
  else if (t.dataset.setting === 'savingsGoalPct') st.savingsGoalPct = Math.min(90, Math.max(0, parseInt(t.value, 10) || 0));
  else if (t.dataset.budget) {
    const n = parseNum(t.value);
    if (n > 0) st.budgets[t.dataset.budget] = n; else delete st.budgets[t.dataset.budget];
  } else if (t.id === 'file' && t.files[0]) {
    t.files[0].text().then((txt) => {
      try { Object.assign(state, sanitizeImport(JSON.parse(txt))); persist(); render(); toast(`Importados ${state.txs.length} movimientos`); } catch { toast('Archivo inválido'); }
    });
    return;
  } else return;
  persist(); render(); toast('Ajuste guardado');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.dataset?.enter) { e.preventDefault(); $(e.target.dataset.enter).click(); return; }
  const o = $('#overlay');
  if (o.hidden) return;
  if (e.key === 'Escape') return closeSheet();
  if (e.key === 'Tab') { // trampa de foco dentro de la hoja
    const f = [...o.querySelectorAll('button, input:not([type=hidden]), select')].filter((x) => !x.disabled);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

render();
if (mirror.status.restored) toast(mirror.status.corrupt ? 'Se detectó un dato dañado: recuperamos tu última versión buena' : 'Recuperamos tus datos desde la copia interna');
mirror.mirrorNow(); // asegura la copia espejo desde el primer arranque
// Otra pestaña escribió datos: recarga para no pisarlos
window.addEventListener?.('storage', (e) => { if (e.key === null || e.key === 'finanzasos:v1' || e.key === 'finanzasos:enc') { toast('Tus datos cambiaron en otra pestaña: recargando…'); setTimeout(() => location.reload(), 900); } });
// Al ocultar o cerrar la app, asegura la copia espejo
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { mirror.mirrorNow(); notify.refreshAgenda({ poke: true }).catch(() => {}); } // al salir, el service worker dispara lo que ya toca
});
window.addEventListener?.('pagehide', () => mirror.mirrorNow());
// Reintenta pedir almacenamiento persistente tras el primer toque (algunos navegadores lo exigen)
document.addEventListener('click', () => navigator.storage?.persist?.().then((p) => { health.persisted = p; }).catch(() => {}), { once: true });
navigator.storage?.persist?.().then((p) => { health.persisted = p; }).catch(() => {}); // pide que el navegador no borre los datos
// Aviso de instalación: al abrir (tras 1,5 s) y apenas el navegador permite instalar con un toque
const askInstall = () => { if (health.browser && installDue(state.settings, health) && $('#overlay').hidden && ui.view !== 'setup') installSheet(true); };
setTimeout(askInstall, 1500);
window.addEventListener?.('beforeinstallprompt', (e) => { e.preventDefault(); health.prompt = e; render(); setTimeout(askInstall, 300); });
window.addEventListener?.('appinstalled', () => { health.installed = true; health.prompt = null; if (!$('#overlay').hidden) closeSheet(); render(); toast('¡Instalada! Ábrela desde tu pantalla de inicio'); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // Actualización automática: busca versión nueva al abrir, al volver a la app y cada hora; al instalarse avisa con un diálogo.
  const hadController = !!navigator.serviceWorker.controller; // en la primera instalación no hay nada que actualizar
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 60 * 60 * 1000);
  }).catch(() => {});
  let announced = false;
  const autoUpdate = () => {
    if (!$('#overlay').hidden) return setTimeout(autoUpdate, 5000); // no interrumpe un formulario abierto
    toast('Nueva versión disponible — actualizando…');
    setTimeout(() => location.reload(), 1500);
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !announced) { announced = true; autoUpdate(); } });
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.goto && VIEWS[e.data.goto]) { ui.view = e.data.goto; render(); } });
}
