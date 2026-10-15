// Recorre la app completa con un DOM simulado (sin navegador): guía, monedas, pagos, deudas, ahorros y Excel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

const els = {};
const mk = (sel) => (els[sel] ??= { sel, innerHTML: '', value: '', textContent: '', hidden: false, dataset: {}, classList: { add() {}, remove() {} }, focus() {}, click() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} });
const handlers = {};
globalThis.localStorage = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = v; }, clear() { this.d = {}; } };
globalThis.window = { scrollTo() {} };
globalThis.confirm = () => { throw new Error('confirm() nativo: usa ask() de dialog.js'); };
globalThis.location = { protocol: 'file:' };
globalThis.document = { querySelector: mk, querySelectorAll: () => [], activeElement: null, addEventListener: (t, f) => { const prev = handlers[t]; handlers[t] = prev ? (e) => { prev(e); f(e); } : f; }, createElement: () => ({ click() {} }) };

const click = (act, v, extra = {}) => handlers.click({ target: { dataset: { act, v, ...extra }, closest() { return this; }, id: '' } });
const submit = () => handlers.submit({ preventDefault() {} });
const tick = () => new Promise((r) => setTimeout(r, 0));
const dlg = async (v) => { handlers.click({ target: { dataset: { dlg: v }, closest() { return this; }, id: '' } }); await tick(); }; // responde el diálogo propio
const main = () => els['#main'].innerHTML;
const text = () => main().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const set = (o) => Object.entries(o).forEach(([k, v]) => { mk(k).value = v; });
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayIso = iso(new Date());

const ctx = await import('../js/ctx.js');
await import('../js/app.js');
const { state } = ctx;

test('guía: ingresos en dólares se convierten a colones y se acumulan', () => {
  assert.match(main(), /¿Cuánto has ganado\?/);
  set({ '#i-amt': '100', '#i-cur': 'USD', '#i-date': todayIso, '#i-cat': 'Freelance' });
  click('addincome');
  set({ '#i-amt': '90000', '#i-cur': 'CRC' });
  click('addincome');
  const inc = state.txs.filter((t) => t.type === 'income');
  assert.equal(inc[0].amount, 100 * state.settings.altRate);
  assert.equal(inc[0].orig.currency, 'USD');
  assert.equal(inc[1].orig, undefined);
  assert.equal(ctx.state.txs.reduce((a, t) => a + t.amount, 0), 100 * state.settings.altRate + 90000);
});

test('gasto fijo en dólares y fin de guía', () => {
  click('step', '2');
  set({ '#x-name': 'Netflix', '#x-amt': '15', '#x-cur': 'USD', '#x-day': '5', '#x-cat': 'Suscripciones' });
  click('addfixed');
  assert.equal(state.fixed.length, 1);
  assert.equal(state.fixed[0].currency, 'USD');
  click('finish');
  assert.match(text(), /Consejos/);
});

test('deuda: alta, estrategia y plan de la quincena', () => {
  click('nav', 'debts');
  assert.match(text(), /Agrega tus tarjetas/);
  click('adddebt');
  set({ '#d-name': 'Visa', '#d-type': 'card', '#d-cur': 'CRC', '#d-bal': '850000', '#d-apr': '54', '#d-min': '42500', '#d-day': '10' });
  submit();
  click('adddebt');
  set({ '#d-name': 'Mastercard', '#d-type': 'card', '#d-cur': 'USD', '#d-bal': '600', '#d-apr': '48', '#d-min': '35', '#d-day': '22' });
  submit();
  assert.equal(state.debts.length, 2);
  const t = text();
  assert.match(t, /Estrategia para salir de deudas/);
  assert.match(t, /Orden de ataque/);
  assert.match(t, /Plan para tu pago de esta quincena/);
  assert.ok(!/NaN|undefined/.test(main()));
});

test('pagar el mínimo baja el saldo y revertirlo lo restaura', () => {
  click('nav', 'pagos'); click('kind', 'month');
  const key = main().match(/data-key="(fx:dm:[^"]+10)"/)?.[1];
  assert.ok(key, 'aparece el mínimo de Visa del día 10');
  click('togglepay', undefined, { key });
  assert.equal(state.debts[0].balance, 850000 - 42500);
  assert.ok(state.txs.some((t) => t.debtId === state.debts[0].id && t.debtPaid === 42500));
  assert.match(main(), /aria-pressed="true"/);
  click('togglepay', undefined, { key });
  assert.equal(state.debts[0].balance, 850000);
  assert.ok(!state.txs.some((t) => t.debtId));
});

test('pago manual en dólares a la tarjeta USD usa el tipo de cambio', async () => {
  const mc = state.debts[1];
  click('paydebt', undefined, { id: mc.id });
  set({ '#p-amt': '100', '#p-date': todayIso });
  submit();
  assert.equal(mc.balance, 500);
  const tx = state.txs.find((t) => t.debtId === mc.id);
  assert.equal(tx.amount, 100 * state.settings.altRate);
  assert.equal(tx.orig.currency, 'USD');
  click('delpay', undefined, { id: tx.id });
  assert.match(els['#dialog'].innerHTML, /¿Eliminar este pago\?/);
  await dlg('cancel');
  assert.equal(mc.balance, 500, 'cancelar no cambia nada');
  click('delpay', undefined, { id: tx.id });
  await dlg('ok');
  assert.equal(mc.balance, 600);
});

test('pago programado: pendiente → pagado', () => {
  click('addbill');
  set({ '#b-name': 'Seguro del carro', '#b-amt': '45000', '#b-cur': 'CRC', '#b-date': todayIso, '#b-cat': 'Servicios' });
  submit();
  const bill = state.txs.find((t) => t.bill);
  assert.equal(bill.status, 'pending');
  click('togglepay', undefined, { key: 'bill:' + bill.id });
  assert.equal(bill.status, 'paid');
});

test('ahorros: meta, depósito y retiro validado', () => {
  click('nav', 'savings');
  click('addgoal');
  set({ '#g-name': 'Fondo de emergencia', '#g-target': '1000000' });
  submit();
  const g = state.goals[0];
  click('deposit', 'in', { id: g.id });
  set({ '#s-amt': '50000', '#s-date': todayIso });
  submit();
  click('deposit', 'out', { id: g.id });
  set({ '#s-amt': '999999', '#s-date': todayIso });
  submit();
  assert.match(els['#f-err'].textContent, /No puedes retirar más/);
  set({ '#s-amt': '10000' });
  submit();
  const bal = state.txs.filter((t) => t.goalId === g.id).reduce((a, t) => a + t.amount, 0);
  assert.equal(bal, 40000);
  assert.match(text(), /Fondo de emergencia/);
});

test('todas las pantallas renderizan sin NaN/undefined', () => {
  for (const v of ['home', 'pagos', 'debts', 'savings', 'more', 'moves', 'advice', 'settings']) {
    click('nav', v);
    for (const k of ['day', 'fortnight', 'month']) { click('kind', k); assert.ok(!/NaN|undefined|\[object/.test(main()), `${v}/${k}`); }
  }
  click('nav', 'advice');
  assert.match(text(), /deudas|Deudas/);
});

test('cambiar moneda base intercambia la tasa', () => {
  click('nav', 'settings');
  handlers.change({ target: { dataset: { setting: 'currency' }, value: 'USD', id: '' } });
  assert.equal(state.settings.currency, 'USD');
  assert.equal(state.settings.altCurrency, 'CRC');
  handlers.change({ target: { dataset: { setting: 'currency' }, value: 'CRC', id: '' } });
  assert.equal(state.settings.currency, 'CRC');
  assert.ok(Math.abs(state.settings.altRate - 510) < 1e-6);
});

test('exportar a Excel genera libro con datos reales', async () => {
  const { exportModel } = await import('../js/derive.js');
  const { buildXlsx } = await import('../js/xlsx.js');
  const m = exportModel();
  assert.ok(m.txs.length >= 3 && m.debts.length === 2 && m.goals.length === 1);
  assert.ok(m.strategy.scenarios.length === 3 && m.strategy.schedule.length > 1);
  assert.ok(m.pagos.some((p) => p.kind === 'Mínimo tarjeta'));
  const bytes = buildXlsx(m);
  assert.equal(bytes[0], 0x50);
  writeFileSync(process.env.XLSX_OUT || '/dev/null', bytes);
});

test('compra nueva con tarjeta (USD): sube saldo, no cuenta como gasto y se revierte', async () => {
  const { summarize } = await import('../js/advice.js');
  const mc = state.debts[1];
  const before = mc.balance;
  click('chargedebt', undefined, { id: mc.id });
  set({ '#c-amt': '50', '#c-cat': 'Compras', '#c-note': 'Zapatos', '#c-date': todayIso });
  submit();
  assert.equal(mc.balance, before + 50);
  const tx = state.txs.find((t) => t.charge);
  assert.equal(tx.amount, 50 * state.settings.altRate);
  assert.equal(summarize([tx]).expense, 0);
  assert.equal(summarize([tx]).charged, tx.amount);
  click('nav', 'moves');
  assert.match(main(), /Tarjeta/);
  click('delcharge', undefined, { id: tx.id });
  await dlg('ok');
  assert.equal(mc.balance, before);
});

test('aviso de instalación: contenido por plataforma y reglas de aparición', async () => {
  const { installDue } = await import('../js/ctx.js');
  const { health } = ctx;
  const h = (o) => ({ installed: false, ...o });
  assert.equal(installDue({}, h()), true);
  assert.equal(installDue({}, h({ installed: true })), false);
  assert.equal(installDue({ hideInstall: true }, h()), false);
  assert.equal(installDue({ installSnooze: '2999-01-01' }, h()), false, 'pospuesto');
  assert.equal(installDue({ installSnooze: '2000-01-01' }, h()), true, 'ya venció la pausa');

  Object.assign(health, { ios: true, iosOtherBrowser: false, prompt: null });
  click('installhelp');
  assert.match(els['#overlay'].innerHTML, /Compartir/); assert.match(els['#overlay'].innerHTML, /Agregar a pantalla de inicio/);
  Object.assign(health, { ios: true, iosOtherBrowser: true });
  click('installhelp'); assert.match(els['#overlay'].innerHTML, /Ábrela en Safari/);
  Object.assign(health, { ios: false, android: true });
  click('installhelp'); assert.match(els['#overlay'].innerHTML, /Instalar app/);
  let prompted = false; health.prompt = { prompt() { prompted = true; } };
  click('installhelp'); assert.match(els['#overlay'].innerHTML, /Instalar ahora/);
  submit(); assert.equal(prompted, true);
  click('hideinstall'); assert.equal(state.settings.hideInstall, true);
  assert.equal(installDue(state.settings, health), false);
});

test('alertas: tarjeta en el Resumen y sección de notificaciones/calendario en Ajustes', async () => {
  // un pago que vence mañana debe aparecer en la tarjeta de alertas
  const t = new Date(); t.setDate(t.getDate() + 1);
  click('addbill');
  set({ '#b-name': 'Recibo de agua', '#b-amt': '12000', '#b-cur': 'CRC', '#b-date': iso(t), '#b-cat': 'Servicios' });
  submit();
  click('nav', 'home');
  assert.match(text(), /Alertas/); assert.match(text(), /Recibo de agua vence mañana/);
  click('nav', 'settings');
  assert.match(text(), /Notificaciones y recordatorios/); assert.match(text(), /recordatorios del calendario/);
  const { calendarEvents } = await import('../js/derive.js');
  const ev = calendarEvents();
  assert.ok(ev.some((e) => /Recibo de agua/.test(e.title)));
  assert.ok(ev.some((e) => /Mínimo Visa/.test(e.title)));
  assert.ok(ev.length > 12, 'los pagos mensuales se repiten durante 12 meses');
  assert.equal(new Set(ev.map((e) => e.uid)).size, ev.length, 'UID únicos');
});


test('diálogo propio: contenido, foco seguro, Escape, escape de HTML y un solo diálogo a la vez', async () => {
  const { ask, inform, dialogOpen } = await import('../js/dialog.js');
  const root = els['#dialog'];
  let focused = null;
  root.querySelector = (sel) => ({ focus() { focused = sel; } });
  // destructivo: foco inicial en Cancelar, rol alertdialog, HTML escapado
  const p = ask({ title: '¿Borrar <img src=x onerror=alert(1)>?', message: 'Mensaje & más', confirm: 'Borrar', tone: 'danger' });
  assert.equal(dialogOpen(), true); assert.equal(root.hidden, false);
  assert.match(root.innerHTML, /role="alertdialog"/); assert.match(root.innerHTML, /aria-modal="true"/);
  assert.ok(!root.innerHTML.includes('<img'), 'el título se escapa');
  assert.equal(focused, '[data-dlg="cancel"]');
  await dlg('cancel'); assert.equal(await p, false); assert.equal(root.hidden, true); assert.equal(dialogOpen(), false);
  // Escape cancela; y no deja pasar la tecla a otros manejadores
  const p2 = ask({ title: 'Prueba', confirm: 'Sí' });
  assert.equal(focused, '[data-dlg="ok"]');
  let stopped = false;
  handlers.keydown({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() { stopped = true; }, target: { dataset: {} } });
  assert.equal(await p2, false); assert.equal(stopped, true);
  // un segundo diálogo cierra el anterior como "no"
  const a = ask({ title: 'A' }); const b = ask({ title: 'B' });
  assert.equal(await a, false); await dlg('ok'); assert.equal(await b, true);
  // aviso de un solo botón: Escape = aceptar
  const n = inform('Listo', 'Todo en orden');
  assert.ok(!/data-dlg="cancel"/.test(root.innerHTML));
  handlers.keydown({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {}, target: { dataset: {} } });
  assert.equal(await n, true);
});

test('acciones destructivas piden confirmación propia: borrar todo y quitar PIN', async () => {
  const root = els['#dialog'];
  click('wipe'); assert.match(root.innerHTML, /¿Borrar todos tus datos\?/); assert.match(root.innerHTML, /no se puede deshacer/);
  await dlg('cancel'); assert.ok(state.txs.length > 0, 'cancelar conserva los datos');
});

test('AUDITORÍA: el código no usa confirm/alert/prompt nativos del navegador', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const bad = [];
  for (const f of readdirSync('js').filter((x) => x.endsWith('.js'))) {
    readFileSync('js/' + f, 'utf8').split('\n').forEach((line, i) => {
      if (/(^|[^.\w])(confirm|alert|prompt)\s*\(/.test(line.replace(/\/\/.*$/, '').replace(/(['"`]).*?\1/g, ''))) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(bad, []);
});

test('pago semanal: se anota, suma en la semana y aparece el periodo Semana', async () => {
  click('guide'); // vuelve a la guía, paso 1
  click('ifreq', 'week');
  assert.match(main(), /Pago de la semana/); assert.match(main(), /Sumar a mi semana/);
  set({ '#i-amt': '75000', '#i-cur': 'CRC', '#i-date': todayIso, '#i-cat': 'Salario' });
  click('addincome');
  const last = state.txs.filter((t) => t.type === 'income').at(-1);
  assert.equal(last.note, 'Pago semanal'); assert.equal(last.amount, 75000);
  assert.match(text(), /Ganado en Semana/);
  const { planInputs } = await import('../js/derive.js');
  assert.ok(Math.abs(planInputs().income - 75000 * 52 / 12) < 1, 'ingreso mensual estimado = promedio semanal × 52/12');
  click('nav', 'home'); click('kind', 'week');
  assert.match(text(), /Semana \d+/);
  assert.ok(!/NaN|undefined|\[object/.test(main()));
  for (const v of ['pagos', 'advice', 'moves', 'debts']) { click('nav', v); click('kind', 'week'); assert.ok(!/NaN|undefined|\[object/.test(main()), v); }
});
