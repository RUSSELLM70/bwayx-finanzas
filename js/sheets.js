// Formularios en hoja modal (bottom sheet en móvil, diálogo en escritorio).
import { rangeOf, inRange, today, iso } from './dates.js';
import { EXPENSE_CATS, INCOME_CATS } from './advice.js';
import { uid } from './store.js';
import { payDebt, chargeCard, addSaving, goalBalance, deleteDebt, deleteGoal } from './actions.js';
import { fmtNum, cleanText } from './inputs.js';
import { ask } from './dialog.js';
import { state, ui, security, health, snoozeDays, $, esc, fmt, fmtC, icon, persist, parseNum, round2, mkAmount, curField, prevLine, updatePreviews, toast, render } from './ctx.js';

let lastFocus = null, handler = null, onDelete = null;
export const submitCurrent = () => handler && handler();
export const sheetDelete = () => onDelete && onDelete();
const err = (m, focusId) => { $('#f-err').textContent = m; if (focusId) $('#' + focusId)?.focus(); return false; };
const validDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);

export function showSheet(title, body, onSubmit, { submit = 'Guardar', del = null } = {}) {
  lastFocus = document.activeElement;
  handler = onSubmit; onDelete = del;
  const o = $('#overlay');
  o.hidden = false;
  o.innerHTML = `<form class="sheet" id="form" role="dialog" aria-modal="true" aria-labelledby="sh-t" novalidate>
    <div class="row between"><h2 class="h1" id="sh-t" style="font-size:20px">${esc(title)}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Cerrar">${icon('plus', 20).replace('<path', '<path transform="rotate(45 12 12)"')}</button></div>
    ${body}<p class="error" id="f-err" role="alert"></p>
    <div class="row"><button class="btn" style="flex:1" type="submit">${submit}</button>${del ? `<button class="btn danger" type="button" data-act="sheetdel" aria-label="Eliminar">${icon('trash')}</button>` : ''}</div></form>`;
  updatePreviews();
  o.querySelector('input:not([type=hidden]),select')?.focus();
}
export function closeSheet() {
  const o = $('#overlay');
  o.hidden = true; o.innerHTML = ''; handler = null; onDelete = null;
  lastFocus?.focus?.();
}
const done = (msg) => { closeSheet(); render(); toast(msg); };
const field = (label, id, inner) => `<div class="field"><label for="${id}">${label}</label>${inner}</div>`;
const catOptions = (list, sel) => list.map((c) => `<option ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('');

// ---------- Movimiento (gasto / ingreso) ----------
export function fillCats(sel) {
  const list = $('#f-type').value === 'income' ? INCOME_CATS : EXPENSE_CATS;
  $('#f-cat').innerHTML = catOptions(list, sel);
}
export function openSheet(tx = null, type = 'expense') {
  const t = tx || { type, amount: '', category: type === 'income' ? INCOME_CATS[0] : EXPENSE_CATS[2], note: '', date: ui.kind === 'day' || inRange(today(), rangeOf(ui.kind, ui.anchor)) ? today() : ui.anchor };
  const amt = tx ? (tx.orig ? tx.orig.amount : tx.amount) : '';
  const cur = tx?.orig?.currency || state.settings.currency;
  showSheet(tx ? 'Editar movimiento' : 'Nuevo movimiento', `
    <div class="toggle" role="group" aria-label="Tipo"><button type="button" class="exp" data-act="type" data-v="expense" aria-pressed="${t.type === 'expense'}">Gasto</button><button type="button" class="inc" data-act="type" data-v="income" aria-pressed="${t.type === 'income'}">Ingreso</button></div>
    <div class="field"><label for="f-amt">Monto</label><div class="amtrow"><input id="f-amt" data-n="money" class="input amount num" inputmode="decimal" autocomplete="off" placeholder="0" value="${fmtNum(amt)}">${curField('f-cur', cur)}</div>${prevLine('f-amt', 'f-cur')}</div>
    ${field('Categoría', 'f-cat', '<select id="f-cat" class="input"></select>')}
    ${field('Fecha', 'f-date', `<input id="f-date" class="input" type="date" value="${t.date}">`)}
    ${field('Nota (opcional)', 'f-note', `<input id="f-note" data-n="text" class="input" maxlength="120" autocomplete="off" value="${esc(t.note)}">`)}
    <input type="hidden" id="f-type" value="${t.type}"><input type="hidden" id="f-id" value="${tx ? esc(tx.id) : ''}">`,
  submitTx, { del: tx ? () => ask({ title: '¿Eliminar este movimiento?', message: 'Esta acción no se puede deshacer.', confirm: 'Eliminar', tone: 'danger' }).then((ok) => { if (ok) { state.txs = state.txs.filter((x) => x.id !== tx.id); persist(); done('Movimiento eliminado'); } }) : null });
  fillCats(t.category);
  $('#f-amt').focus();
}
function submitTx() {
  const n = parseNum($('#f-amt').value), date = $('#f-date').value;
  if (!(n > 0)) return err('Ingresa un monto mayor que cero.', 'f-amt');
  if (!validDate(date)) return err('Elige una fecha válida.');
  const id = $('#f-id').value;
  const i = state.txs.findIndex((x) => x.id === id);
  const tx = { ...(i >= 0 ? state.txs[i] : {}), id: id || uid(), type: $('#f-type').value, category: $('#f-cat').value, note: cleanText($('#f-note').value), date, ...mkAmount(n, $('#f-cur').value) };
  if (!tx.orig || tx.orig.currency === state.settings.currency) delete tx.orig;
  if (i >= 0) state.txs[i] = tx; else state.txs.push(tx);
  persist(); ui.anchor = date;
  done(i >= 0 ? 'Movimiento actualizado' : 'Movimiento guardado');
}

// ---------- Pago programado (pendiente) ----------
export function billSheet() {
  showSheet('Nuevo pago', `
    ${field('¿Qué vas a pagar?', 'b-name', '<input id="b-name" data-n="text" class="input" maxlength="60" placeholder="Ej. Seguro del carro, matrícula" autocomplete="off">')}
    <div class="field"><label for="b-amt">Monto</label><div class="amtrow"><input id="b-amt" data-n="money" class="input amount num" inputmode="decimal" placeholder="0" autocomplete="off">${curField('b-cur')}</div>${prevLine('b-amt', 'b-cur')}</div>
    ${field('Fecha de vencimiento', 'b-date', `<input id="b-date" class="input" type="date" value="${today()}">`)}
    ${field('Categoría', 'b-cat', `<select id="b-cat" class="input">${catOptions(EXPENSE_CATS, 'Servicios')}</select>`)}
    <p class="muted small">Queda como <b>pendiente</b>; márcalo como pagado en la pantalla Pagos.</p>`,
  () => {
    const name = cleanText($('#b-name').value, 60), n = parseNum($('#b-amt').value), date = $('#b-date').value;
    if (!name) return err('Escribe qué vas a pagar.', 'b-name');
    if (!(n > 0)) return err('Ingresa un monto mayor que cero.', 'b-amt');
    if (!validDate(date)) return err('Elige una fecha válida.');
    const tx = { id: uid(), type: 'expense', bill: true, status: 'pending', category: $('#b-cat').value, note: name, date, ...mkAmount(n, $('#b-cur').value) };
    state.txs.push(tx); persist(); ui.anchor = date;
    done('Pago agregado como pendiente');
  });
}

// ---------- Deuda / tarjeta ----------
export function debtSheet(d = null) {
  const first = new Date(); first.setDate(1);
  showSheet(d ? 'Editar deuda' : 'Nueva tarjeta o deuda', `
    ${field('Nombre', 'd-name', `<input id="d-name" data-n="text" class="input" maxlength="60" placeholder="Ej. Visa BAC, préstamo carro" autocomplete="off" value="${esc(d?.name || '')}">`)}
    <div class="grid2">${field('Tipo', 'd-type', `<select id="d-type" class="input"><option value="card" ${d?.type !== 'loan' ? 'selected' : ''}>Tarjeta</option><option value="loan" ${d?.type === 'loan' ? 'selected' : ''}>Préstamo</option></select>`)}
      ${field('Moneda', 'd-cur', curField('d-cur', d?.currency))}</div>
    ${field('Saldo actual', 'd-bal', `<input id="d-bal" data-n="money" class="input amount num" inputmode="decimal" placeholder="0" value="${d ? fmtNum(d.balance) : ''}">`)}
    <div class="grid2">${field('Tasa anual (%)', 'd-apr', `<input id="d-apr" data-n="pct" class="input num" inputmode="decimal" placeholder="Ej. 54" value="${d ? fmtNum(d.apr) : ''}">`)}
      ${field('Pago mínimo', 'd-min', `<input id="d-min" data-n="money" class="input num" inputmode="decimal" placeholder="0" value="${d ? fmtNum(d.min) : ''}">`)}</div>
    ${field('Día de pago (1-31)', 'd-day', `<input id="d-day" data-n="int" class="input num" inputmode="numeric" maxlength="2" value="${d?.dueDay || 1}">`)}
    <p class="muted small">La tasa y el mínimo salen en tu estado de cuenta. Actualiza el saldo cuando llegue uno nuevo.</p>`,
  () => {
    const name = cleanText($('#d-name').value, 60), bal = parseNum($('#d-bal').value), apr = parseNum($('#d-apr').value || '0'), min = parseNum($('#d-min').value || '0');
    if (!name) return err('Escribe un nombre.', 'd-name');
    if (!(bal >= 0)) return err('Ingresa el saldo (puede ser 0).', 'd-bal');
    if (!(apr >= 0)) return err('La tasa debe ser 0 o mayor.', 'd-apr');
    if (!(min >= 0)) return err('El mínimo debe ser 0 o mayor.', 'd-min');
    const rec = { id: d?.id || uid(), name, type: $('#d-type').value, currency: $('#d-cur').value, balance: round2(bal), apr, min: round2(min), dueDay: Math.min(31, Math.max(1, parseInt($('#d-day').value, 10) || 1)), since: d?.since || iso(first) };
    const i = state.debts.findIndex((x) => x.id === rec.id);
    if (i >= 0) state.debts[i] = rec; else state.debts.push(rec);
    persist();
    done(d ? 'Deuda actualizada' : 'Deuda agregada');
  }, { del: d ? () => ask({ title: `¿Eliminar "${d.name}"?`, message: 'Los pagos ya registrados se conservan como gastos.', confirm: 'Eliminar', tone: 'danger' }).then((ok) => { if (ok) { deleteDebt(d.id); done('Deuda eliminada'); } }) : null });
}

export function paySheet(debtId, amount) {
  const d = state.debts.find((x) => x.id === debtId);
  if (!d) return;
  showSheet(`Pago a ${d.name}`, `
    <p class="muted">Saldo actual: <b class="num">${fmtC(d.balance, d.currency)}</b> · mínimo ${fmtC(d.min, d.currency)}</p>
    ${field(`Monto pagado (${d.currency})`, 'p-amt', `<input id="p-amt" data-n="money" data-cur="${d.currency}" class="input amount num" inputmode="decimal" value="${fmtNum(amount ?? d.min)}">`)}
    ${field('Fecha', 'p-date', `<input id="p-date" class="input" type="date" value="${today()}">`)}
    <p class="muted small">Se registra como gasto y el saldo de la deuda baja.</p>`,
  () => {
    const n = parseNum($('#p-amt').value), date = $('#p-date').value;
    if (!(n > 0)) return err('Ingresa un monto mayor que cero.', 'p-amt');
    if (!validDate(date)) return err('Elige una fecha válida.');
    const tx = payDebt(debtId, n, date);
    if (!tx) return err('Esa deuda ya está en cero.');
    done(n > d.balance + 1e-9 ? `Pago registrado (se aplicó solo el saldo: ${fmtC(tx.debtPaid, d.currency)})` : 'Pago registrado: el saldo bajó');
  }, { submit: 'Registrar pago' });
}

export function chargeSheet(debtId) {
  const d = state.debts.find((x) => x.id === debtId);
  if (!d) return;
  showSheet(`Compra con ${d.name}`, `
    <p class="muted">Saldo actual: <b class="num">${fmtC(d.balance, d.currency)}</b></p>
    ${field(`Monto de la compra (${d.currency})`, 'c-amt', '<input id="c-amt" data-n="money" data-cur="${d.currency}" class="input amount num" inputmode="decimal" placeholder="0">')}
    ${field('Categoría', 'c-cat', `<select id="c-cat" class="input">${catOptions(EXPENSE_CATS, 'Compras')}</select>`)}
    ${field('Nota (opcional)', 'c-note', '<input id="c-note" data-n="text" class="input" maxlength="120" autocomplete="off">')}
    ${field('Fecha', 'c-date', `<input id="c-date" class="input" type="date" value="${today()}">`)}
    <p class="muted small">Sube el saldo de la tarjeta y se recalcula tu estrategia. No cuenta como gasto del periodo: el dinero sale cuando pagas la tarjeta.</p>`,
  () => {
    const n = parseNum($('#c-amt').value), date = $('#c-date').value;
    if (!(n > 0)) return err('Ingresa un monto mayor que cero.', 'c-amt');
    if (!validDate(date)) return err('Elige una fecha válida.');
    chargeCard(debtId, n, $('#c-cat').value, cleanText($('#c-note').value), date);
    done('Compra registrada: el saldo subió');
  }, { submit: 'Registrar compra' });
}

// ---------- Instalar la app ----------
/** Aviso de instalación. `auto`: lo abrió la app (se pospone 2 días al mostrarse, así cualquier cierre cuenta como "ahora no"). */
export function installSheet(auto = false) {
  if (auto) { state.settings.installSnooze = snoozeDays(2); persist(); }
  const step = (n, ic, html) => `<li class="istep"><span class="inum">${n}</span><span class="iico">${icon(ic, 22)}</span><span>${html}</span></li>`;
  let how;
  if (health.prompt) how = '<p class="muted">Un toque y queda como una app más en tu teléfono.</p>';
  else if (health.ios && health.iosOtherBrowser) how = '<p class="warnc"><b>Ábrela en Safari.</b> En iPhone solo Safari puede instalar apps. Copia el enlace y pégalo en Safari.</p>';
  else if (health.ios) how = `<ol class="isteps">${step(1, 'share', 'Toca el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba), abajo en Safari.')}${step(2, 'addsq', 'Desplázate y elige <b>Agregar a pantalla de inicio</b>.')}${step(3, 'phone', 'Toca <b>Agregar</b>. Abre BWAY X - Finanzas desde su ícono.')}</ol>`;
  else if (health.android) how = `<ol class="isteps">${step(1, 'more', 'Toca el menú <b>⋮</b> de Chrome (arriba a la derecha).')}${step(2, 'addsq', 'Elige <b>Instalar app</b> o <b>Agregar a pantalla de inicio</b>.')}${step(3, 'phone', 'Confirma y abre BWAY X - Finanzas desde su ícono.')}</ol>`;
  else how = '<p class="muted">En Chrome o Edge, busca el ícono de <b>instalar</b> en la barra de direcciones, o el menú ⋮ → <b>Instalar BWAY X</b>.</p>';
  showSheet('Instala BWAY X', `<div class="ibenefit"><p><b>Por qué instalarla</b></p><ul>
      <li>Tus datos quedan <b>mejor protegidos</b>: el navegador los borra menos.</li><li>Abre más rápido y <b>sin internet</b>.</li><li>Sin barra del navegador: se siente como una app.</li></ul></div>${how}
    <button type="button" class="linkbtn" style="min-height:44px;justify-self:start;padding:0" data-act="hideinstall">No volver a mostrar</button>`,
  () => { if (health.prompt) health.prompt.prompt(); closeSheet(); }, { submit: health.prompt ? 'Instalar ahora' : 'Entendido' });
}

// ---------- Versiones guardadas ----------
export function versionsSheet(list) {
  const rows = list.map((e, i) => `<li class="row between" style="min-height:48px;gap:8px"><span>${esc(new Date(e.t).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }))}${e.enc != null ? ' <small class="badge">Cifrada</small>' : ''}</span>
    <button type="button" class="btn ghost" data-act="restorever" data-v="${i}">Restaurar</button></li>`).join('');
  showSheet('Versiones guardadas', `<p class="muted small">La app guarda versiones automáticas de tus datos dentro del dispositivo (una cada 10 minutos de uso, y una por día hasta 14 días). Si algo sale mal, vuelve a una de ellas.</p>
    ${rows ? `<ul class="list">${rows}</ul>` : '<p class="muted">Todavía no hay versiones guardadas.</p>'}`, closeSheet, { submit: 'Cerrar' });
}

// ---------- PIN ----------
export function pinSheet() {
  showSheet('Proteger con PIN', `
    <p class="muted">El PIN cifra tus datos en este dispositivo. No se guarda en ningún lado: si lo olvidas, solo una copia de seguridad (JSON o Excel) te salva.</p>
    ${field('PIN (mínimo 4 dígitos)', 'k-pin', '<input id="k-pin" data-n="int" class="input amount num" type="password" inputmode="numeric" autocomplete="new-password">')}
    ${field('Repite el PIN', 'k-pin2', '<input id="k-pin2" data-n="int" class="input amount num" type="password" inputmode="numeric" autocomplete="new-password">')}`,
  async () => {
    const a = $('#k-pin').value, b = $('#k-pin2').value;
    if (!/^\d{4,12}$/.test(a)) return err('Usa de 4 a 12 dígitos.', 'k-pin');
    if (a !== b) return err('Los PIN no coinciden.', 'k-pin2');
    try { await security.enablePin(a); done('PIN activado: tus datos están cifrados'); } catch { err('Este navegador no permite cifrar (requiere HTTPS o localhost).'); }
  }, { submit: 'Activar PIN' });
}

// ---------- Ahorros ----------
export function goalSheet(g = null) {
  showSheet(g ? 'Editar meta' : 'Nueva meta de ahorro', `
    ${field('Nombre', 'g-name', `<input id="g-name" data-n="text" class="input" maxlength="60" placeholder="Ej. Fondo de emergencia, viaje" autocomplete="off" value="${esc(g?.name || '')}">`)}
    ${field('Monto objetivo (opcional)', 'g-target', `<input id="g-target" data-n="money" class="input amount num" inputmode="decimal" placeholder="0" value="${g?.target ? fmtNum(g.target) : ''}">`)}`,
  () => {
    const name = cleanText($('#g-name').value, 60), target = parseNum($('#g-target').value || '0');
    if (!name) return err('Escribe un nombre.', 'g-name');
    if (!(target >= 0)) return err('El objetivo debe ser 0 o mayor.', 'g-target');
    if (g) { g.name = name; g.target = round2(target); state.txs.forEach((t) => { if (t.goalId === g.id) t.category = name; }); }
    else state.goals.push({ id: uid(), name, target: round2(target) });
    persist();
    done(g ? 'Meta actualizada' : 'Meta creada');
  }, { del: g ? () => ask({ title: `¿Eliminar "${g.name}"?`, message: 'También se eliminarán sus depósitos.', confirm: 'Eliminar', tone: 'danger' }).then((ok) => { if (ok) { deleteGoal(g.id); done('Meta eliminada'); } }) : null });
}

export function depositSheet(goalId, dir) {
  const g = state.goals.find((x) => x.id === goalId);
  if (!g) return;
  const out = dir === 'out';
  showSheet(`${out ? 'Retirar de' : 'Depositar en'} ${g.name}`, `
    <p class="muted">Ahorrado: <b class="num">${fmt(goalBalance(g))}</b></p>
    ${field('Monto', 's-amt', '<input id="s-amt" data-n="money" class="input amount num" inputmode="decimal" placeholder="0">')}
    ${field('Fecha', 's-date', `<input id="s-date" class="input" type="date" value="${today()}">`)}`,
  () => {
    const n = parseNum($('#s-amt').value), date = $('#s-date').value;
    if (!(n > 0)) return err('Ingresa un monto mayor que cero.', 's-amt');
    if (!validDate(date)) return err('Elige una fecha válida.');
    if (out && n > goalBalance(g) + 1e-9) return err('No puedes retirar más de lo ahorrado.', 's-amt');
    addSaving(goalId, out ? -n : n, date);
    done(out ? 'Retiro registrado' : '¡Depósito registrado!');
  }, { submit: out ? 'Retirar' : 'Depositar' });
}
