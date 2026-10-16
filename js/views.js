// Vistas: cada función devuelve HTML (todo texto de usuario pasa por esc()).
import { rangeOf, shift, inRange, today, parse, monthShort, monthName, iso } from './dates.js';
import { summarize, advise, EXPENSE_CATS, INCOME_CATS } from './advice.js';
import { fixedTotal } from './fixed.js';
import { compare, priorityOrder } from './debt.js';
import { donut, bars, lines } from './charts.js';
import { CURRENCIES } from './money.js';
import { goalBalance } from './actions.js';
import { fmtNum } from './inputs.js';
import { permission, supported } from './notify.js';
import { state, ui, security, health, daysSince, notifySettings, esc, fmt, fmtC, fmtShort, icon, P, catColor, conv, sortTx, curField, prevLine } from './ctx.js';
import { txsIn, payItems, statusLabel, debtList, planInputs, currentMethod, currentExtra, fortnightPlan, adviceInput, sumBy, currentAlerts } from './derive.js';

// ---------- Componentes ----------
export function periodControls() {
  const r = rangeOf(ui.kind, ui.anchor);
  const seg = [['day', 'Día'], ['week', 'Semana'], ['fortnight', 'Quincena'], ['month', 'Mes']]
    .map(([k, l]) => `<button data-act="kind" data-v="${k}" aria-pressed="${ui.kind === k}">${l}</button>`).join('');
  return `<div class="seg" role="group" aria-label="Periodo">${seg}</div>
    <div class="pager">
      <button class="icon-btn" data-act="shift" data-v="-1" aria-label="Periodo anterior">${icon('left')}</button>
      <button class="label" data-act="now" aria-label="${esc(r.label)}. Ir al periodo actual">${esc(r.label)}</button>
      <button class="icon-btn" data-act="shift" data-v="1" aria-label="Periodo siguiente">${icon('right')}</button>
    </div>`;
}
const linkBtn = (act, v, text) => `<button class="icon-btn linkbtn" data-act="${act}" data-v="${v}">${text}</button>`;
const head = (title, right = '') => `<div class="row between"><h1 class="h1">${title}</h1>${right}</div>`;

export function txRow(t) {
  const inc = t.type === 'income', sav = t.type === 'saving';
  let act = `data-act="edit" data-id="${esc(t.id)}"`, label = inc ? 'Ingreso' : 'Gasto', ico = inc ? 'up' : 'down', color = inc ? 'var(--income)' : catColor(t.category);
  if (t.fixed) { act = 'data-act="nav" data-v="settings"'; label = 'Gasto fijo'; }
  else if (sav) { act = 'data-act="nav" data-v="savings"'; label = 'Ahorro'; ico = 'piggy'; color = 'var(--info)'; }
  else if (t.charge) { act = `data-act="delcharge" data-id="${esc(t.id)}"`; label = 'Compra con tarjeta'; ico = 'card'; color = 'var(--muted)'; }
  else if (t.debtId) { act = `data-act="delpay" data-id="${esc(t.id)}"`; label = 'Pago de deuda'; ico = 'card'; color = 'var(--warn)'; }
  const out = !inc && !(sav && t.amount < 0);
  const badge = t.charge ? 'Tarjeta' : t.fixed ? 'Fijo' : t.bill ? (t.status === 'paid' ? 'Pagado' : 'Pendiente') : '';
  const sub = (t.orig ? `${fmtC(t.orig.amount, t.orig.currency)} · ` : '') + (t.note || label);
  return `<li><button class="tx" ${act} aria-label="${label} ${esc(t.category)} ${fmt(Math.abs(t.amount))}">
    <span class="ico" style="color:${color}">${icon(ico, 18)}</span>
    <span class="meta"><b>${esc(t.category)}${badge ? ` <small class="badge">${badge}</small>` : ''}</b><span>${esc(sub)}</span></span>
    <span class="amt num ${inc || (sav && t.amount < 0) ? 'pos' : sav ? 'info' : ''}">${out ? '−' : '+'}${fmt(Math.abs(t.amount))}</span></button></li>`;
}
const emptyState = (msg = 'Aún no hay movimientos en este periodo.') => `<div class="empty"><p>${msg}</p>
  <button class="btn" data-act="add">Agregar movimiento</button>
  ${state.txs.length === 0 ? '<button class="btn ghost" data-act="demo">Cargar datos de ejemplo</button>' : ''}</div>`;

// ---------- Secciones reutilizables (guía y ajustes) ----------
const FREQ = { day: ['Lo que ganaste ese día', 'Ganancia del día', 'Sumar a mi día'], week: ['Pago de la semana', 'Pago semanal', 'Sumar a mi semana'], fortnight: ['Pago de la quincena', 'Pago de quincena', 'Sumar a mi quincena'] };
export function incomeSection() {
  const r = rangeOf(ui.ifreq === 'week' ? 'week' : 'fortnight', ui.anchor);
  const rows = state.txs.filter((t) => t.type === 'income' && inRange(t.date, r)).sort(sortTx);
  const total = sumBy(rows, (t) => t.amount);
  const f = ui.ifreq;
  return `<div class="field"><label>¿Cómo registras lo que ganas?</label>
      <div class="toggle t3" role="group" aria-label="Frecuencia">${[['day', 'Diario'], ['week', 'Semanal'], ['fortnight', 'Quincenal']].map(([k, l]) => `<button type="button" class="inc" data-act="ifreq" data-v="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div></div>
    <div class="field"><label for="i-amt">${FREQ[f][0]}</label>
      <div class="amtrow"><input id="i-amt" data-n="money" class="input amount num" inputmode="decimal" autocomplete="off" placeholder="0" data-enter="#i-add">${curField('i-cur')}</div>${prevLine('i-amt', 'i-cur')}</div>
    <div class="grid2"><div class="field"><label for="i-date">Fecha</label><input id="i-date" class="input" type="date" value="${today()}"></div>
      <div class="field"><label for="i-cat">Fuente</label><select id="i-cat" class="input">${INCOME_CATS.map((c) => `<option>${c}</option>`).join('')}</select></div></div>
    <p class="error" id="i-err" role="alert"></p>
    <button class="btn block" id="i-add" data-act="addincome">${FREQ[f][2]}</button>
    <div class="card inner"><div class="row between"><span class="muted">Ganado en ${esc(r.label)}</span><b class="big num pos" style="font-size:24px">${fmt(total)}</b></div>
      ${rows.length ? `<ul class="list" style="margin-top:8px">${rows.map(txRow).join('')}</ul>` : '<p class="muted small" style="margin-top:6px">Aún no has sumado nada. Cada monto que agregues se acumula aquí.</p>'}</div>`;
}

export function fixedSection() {
  const total = fixedTotal(state.fixed, conv);
  const freqDesc = (f) => { const fr = f.freq || 'monthly'; return fr === 'weekly' ? 'Semanal' : fr === 'fortnight' ? 'Quincenal' : `día ${f.day} de cada mes`; };
  const rows = state.fixed.map((f) => `<li class="row between" style="min-height:48px;gap:8px"><span style="min-width:0;flex:1"><b style="font-weight:500">${esc(f.name)}</b><span class="muted" style="display:block;font-size:13px">${esc(f.category)} · ${freqDesc(f)}</span></span>
    <span class="num" style="font-weight:600">${fmtC(f.amount, f.currency || state.settings.currency)}</span>
    <button class="icon-btn" data-act="editfixed" data-id="${esc(f.id)}" aria-label="Editar ${esc(f.name)}">${icon('sliders')}</button></li>`).join('');
  return `<div class="field"><label for="x-name">Nombre</label><input id="x-name" data-n="text" class="input" maxlength="60" placeholder="Ej. Alquiler, internet, seguro" autocomplete="off"></div>
    <div class="field"><label for="x-amt">Monto</label><div class="amtrow"><input id="x-amt" data-n="money" class="input num" inputmode="decimal" placeholder="0" autocomplete="off" data-enter="#x-add">${curField('x-cur')}</div></div>
    ${prevLine('x-amt', 'x-cur')}
    <div class="grid2"><div class="field"><label for="x-freq">Frecuencia</label><select id="x-freq" class="input"><option value="monthly">Mensual</option><option value="fortnight">Quincenal (cada 2 sem.)</option><option value="weekly">Semanal</option></select></div>
      <div class="field"><label for="x-day">Día de mes (mensual)</label><input id="x-day" data-n="int" class="input num" inputmode="numeric" maxlength="2" value="1" data-enter="#x-add"></div></div>
    <div class="field"><label for="x-cat">Categoría</label><select id="x-cat" class="input">${EXPENSE_CATS.map((c) => `<option>${c}</option>`).join('')}</select></div>
    <p class="error" id="x-err" role="alert"></p>
    <button class="btn ghost block" id="x-add" data-act="addfixed">Agregar gasto fijo</button>
    <p class="muted small">Las tarjetas de crédito y préstamos se agregan en la sección <b>Deudas</b> (no las repitas aquí).</p>
    <div class="card inner"><div class="row between"><span class="muted">Total de fijos al mes</span><b class="big num neg" style="font-size:24px">${fmt(total)}</b></div>
      ${rows ? `<ul class="list" style="margin-top:8px">${rows}</ul>` : '<p class="muted small" style="margin-top:6px">Todavía no agregas ninguno.</p>'}</div>`;
}

export function setupView() {
  const step = ui.step;
  const r = rangeOf('fortnight', ui.anchor);
  const income = sumBy(state.txs.filter((t) => t.type === 'income' && inRange(t.date, r)), (t) => t.amount);
  const dots = [1, 2].map((n) => `<i class="${n <= step ? 'on' : ''}"></i>`).join('');
  let body;
  if (step === 1) {
    body = `<h1 class="h1">¿Cuánto has ganado?</h1><p class="muted">Anota lo que recibes, por día, semana o quincena, en colones o dólares. Todo se va sumando.</p>
      ${incomeSection()}<button class="btn block" data-act="step" data-v="2" ${income > 0 ? '' : 'disabled'}>Siguiente: gastos fijos</button>`;
  } else {
    const fx = fixedTotal(state.fixed, conv);
    body = `<h1 class="h1">Tus gastos fijos</h1><p class="muted">Lo que pagas todos los meses igual: alquiler, servicios, suscripciones. Se aplicarán solos cada mes.</p>
      ${fixedSection()}
      <p class="muted small">${fx > 0 && income > 0 ? `Con lo ganado en esta quincena (${fmt(income)}) cubrirías el ${Math.round((income / fx) * 100)}% de tus fijos mensuales.` : ''}</p>
      <div class="row"><button class="btn ghost" data-act="step" data-v="1">Atrás</button><button class="btn" style="flex:1" data-act="finish">Ver mi análisis</button></div>
      <p class="muted small" style="text-align:center">¿Tienes tarjetas o deudas? Agrégalas luego en <b>Deudas</b> y te armo una estrategia.</p>`;
  }
  return `<div class="page"><div class="steps" role="img" aria-label="Paso ${step} de 2">${dots}</div>${body}
    <button class="icon-btn linkbtn" style="margin:0 auto" data-act="skip">Omitir guía</button></div>`;
}

// ---------- Resumen ----------
/** Aviso único y discreto: instalar la app (protege los datos) o hacer copia de seguridad. */
function nudge() {
  if (!health.installed && !state.settings.hideInstall) {
    return `<section class="card nudge"><p><b>Instala la app para proteger tus datos</b></p><p class="muted small">Instalada, el navegador los borra menos y funciona sin internet.</p>
      <div class="row"><button class="btn" data-act="${health.prompt ? 'installapp' : 'installhelp'}">${health.prompt ? 'Instalar app' : 'Cómo instalarla'}</button><button class="linkbtn" style="min-height:44px" data-act="hideinstall">No mostrar más</button></div></section>`;
  }
  if (state.txs.length < 3) return '';
  const d = daysSince(state.settings.lastBackup);
  if (d > 7) return `<section class="card nudge"><p><b>Haz una copia de seguridad</b></p><p class="muted small">${Number.isFinite(d) ? `Tu última copia fue hace ${d} días.` : 'Aún no has hecho ninguna copia.'} Tus datos viven solo en este dispositivo: si lo pierdes o borras los datos del navegador, la copia es lo único que los recupera.</p>
      <div class="row"><button class="btn" data-act="export">Descargar copia</button><button class="btn ghost" data-act="exportxlsx">Excel</button></div></section>`;
  return '';
}

/** Alertas dentro de la app: pagos que vencen o vencieron y un consejo según tus gastos. */
function alertsCard() {
  const list = currentAlerts();
  if (!list.length) return '';
  const ic = { alert: 'alert', warn: 'alert', info: 'bulb' };
  return `<section class="card" aria-label="Alertas"><div class="row between"><p class="h2">Alertas</p>${linkBtn('nav', 'pagos', 'Ver pagos')}</div>
    <ul class="alerts">${list.map((a) => `<li><button class="al ${a.level}" data-act="nav" data-v="${a.view}"><span class="ti">${icon(ic[a.level], 18)}</span><span class="meta"><b>${esc(a.title)}</b><span>${esc(a.body)}</span></span></button></li>`).join('')}</ul></section>`;
}

export function homeView() {
  const r = rangeOf(ui.kind, ui.anchor);
  const cur = txsIn(r);
  const s = summarize(cur);
  const goal = state.settings.savingsGoalPct / 100;
  const rate = s.savingsRate;
  const prog = rate == null ? 0 : Math.min(1, Math.max(0, rate / goal));
  const cls = rate == null ? '' : rate >= goal ? 'ok' : rate >= 0 ? 'mid' : 'bad';

  const cats = Object.entries(s.byCat).sort((a, b) => b[1] - a[1]);
  const items = cats.slice(0, 6).map(([k, v]) => ({ label: k, value: v, color: catColor(k) }));
  const rest = cats.slice(6).reduce((a, [, v]) => a + v, 0);
  if (rest > 0) items.push({ label: 'Otras', value: rest, color: '#52525b' });

  const rows = [];
  for (let i = 5; i >= 0; i--) {
    const d = parse(shift('month', ui.anchor, -i));
    const ms = summarize(txsIn(rangeOf('month', iso(d))));
    rows.push({ label: monthShort(d.getMonth()), income: ms.income, expense: ms.expense });
  }
  const hasTrend = rows.some((x) => x.income || x.expense);

  const factor = { day: 1 / 30, week: 7 / 30, fortnight: 0.5, month: 1 }[ui.kind];
  const budgets = Object.entries(state.settings.budgets).filter(([, v]) => v > 0).map(([cat, limit]) => {
    const allowed = limit * factor, spent = s.byCat[cat] || 0, p = spent / allowed;
    return `<div><div class="row between"><span>${esc(cat)}</span><span class="muted num">${fmt(spent)} / ${fmt(allowed)}</span></div>
      <div class="bar" role="progressbar" aria-label="Presupuesto ${esc(cat)}" aria-valuenow="${Math.round(p * 100)}" aria-valuemin="0" aria-valuemax="100"><i class="${p > 1 ? 'bad' : p > 0.8 ? 'mid' : 'ok'}" style="width:${Math.min(100, p * 100)}%"></i></div></div>`;
  }).join('');

  const tips = advise(adviceInput()).slice(0, 2);
  let daily = '';
  const t0 = today();
  if (ui.kind !== 'day' && inRange(t0, r) && s.income > 0) {
    const left = Math.round((parse(r.end) - parse(t0)) / 86400000) + 1;
    daily = `<section class="card"><p class="h2">Disponible por día</p><p class="big num ${s.net < 0 ? 'neg' : 'pos'}">${fmt(Math.max(0, s.net - s.saved) / left)}</p>
      <p class="muted small" style="margin-top:6px">${s.net - s.saved > 0 ? `Te quedan ${fmt(s.net - s.saved)} para ${left} ${left === 1 ? 'día' : 'días'} de este periodo.` : 'Ya no te queda saldo en este periodo.'}</p></section>`;
  }
  const items2 = payItems(r);
  const pend = items2.filter((i) => i.status !== 'paid');
  const debtTot = sumBy(debtList(), (d) => d.balance);
  const savedTot = sumBy(state.txs.filter((t) => t.type === 'saving'), (t) => t.amount);
  const tiles = `<div class="tiles">
    <button class="card tile" data-act="nav" data-v="pagos"><span class="muted small">Por pagar</span><b class="num ${pend.length ? 'warnc' : ''}">${fmtShort(sumBy(pend, (i) => i.amount))}</b><span class="muted small">${pend.length} ${pend.length === 1 ? 'pago' : 'pagos'}</span></button>
    <button class="card tile" data-act="nav" data-v="debts"><span class="muted small">Deudas</span><b class="num ${debtTot ? 'neg' : ''}">${fmtShort(debtTot)}</b><span class="muted small">${state.debts.length} ${state.debts.length === 1 ? 'cuenta' : 'cuentas'}</span></button>
    <button class="card tile" data-act="nav" data-v="savings"><span class="muted small">Ahorrado</span><b class="num infoc">${fmtShort(savedTot)}</b><span class="muted small">${state.goals.length} ${state.goals.length === 1 ? 'meta' : 'metas'}</span></button></div>`;
  const quick = `<section class="card"><div class="row between"><div><p class="h2">Ingresos del periodo</p><p class="num pos" style="font-weight:700;font-size:22px">${fmt(s.income)}</p></div>
      <button class="btn" data-act="addinc">+ Ingreso</button></div>
      ${state.fixed.length ? '' : '<p class="muted small" style="margin-top:10px">Agrega tus gastos fijos para un análisis más exacto. <button class="linkbtn" style="min-height:44px;text-decoration:underline" data-act="guide">Abrir guía</button></p>'}</section>`;
  const recent = [...cur].sort(sortTx).slice(0, 4);

  return `<div class="page cols">
    <h1 class="h1">Resumen</h1>
    ${periodControls()}
    ${nudge()}${alertsCard()}${quick}${tiles}${daily}
    <section class="card hero" aria-label="Balance del periodo">
      <p class="h2">Balance del periodo</p>
      <p class="big num ${s.net < 0 ? 'neg' : ''}">${fmt(s.net)}</p>
      <div class="grid2" style="margin-top:16px">
        <div><p class="muted small">Ingresos</p><p class="num pos" style="font-weight:600;font-size:18px">${fmt(s.income)}</p></div>
        <div><p class="muted small">Gastos</p><p class="num neg" style="font-weight:600;font-size:18px">${fmt(s.expense)}</p></div>
      </div>${s.saved ? `<p class="muted small" style="margin-top:10px">Ahorrado en este periodo: <b class="num infoc">${fmt(s.saved)}</b></p>` : ''}
    </section>
    <section class="card" aria-label="Meta de ahorro">
      <div class="row between"><p class="h2">Meta de ahorro (${state.settings.savingsGoalPct}%)</p><p class="num" style="font-weight:600">${rate == null ? '—' : Math.round(rate * 100) + '%'}</p></div>
      <div class="bar" style="margin-top:10px" role="progressbar" aria-label="Avance hacia la meta de ahorro" aria-valuenow="${Math.round(prog * 100)}" aria-valuemin="0" aria-valuemax="100"><i class="${cls}" style="width:${prog * 100}%"></i></div>
      <p class="muted small" style="margin-top:8px">${rate == null ? 'Registra un ingreso para calcular tu ahorro.' : rate >= goal ? 'Meta alcanzada en este periodo.' : rate >= 0 ? `Te faltan ${fmt(goal * s.income - s.net)} para tu meta.` : 'Estás gastando más de lo que ingresa.'}</p>
    </section>
    <section class="card"><p class="h2" style="margin-bottom:12px">Gastos por categoría</p>
      ${items.length ? `<div class="donut-wrap">${donut(items, fmtShort(s.expense), 'gastado')}
        <ul class="legend">${items.map((i) => `<li><span class="dot" style="background:${i.color}"></span>${esc(i.label)}<span class="v num">${Math.round((i.value / s.expense) * 100)}% · ${fmt(i.value)}</span></li>`).join('')}</ul></div>` : '<p class="muted">Sin gastos en este periodo.</p>'}
    </section>
    ${hasTrend ? `<section class="card"><p class="h2" style="margin-bottom:8px">Últimos 6 meses</p>${bars(rows, fmtShort)}
      <div class="keys"><span><i style="background:var(--income)"></i>Ingresos</span><span><i style="background:var(--expense)"></i>Gastos</span></div></section>` : ''}
    ${budgets ? `<section class="card" style="display:grid;gap:14px"><p class="h2">Presupuestos</p>${budgets}</section>` : ''}
    ${tips.length ? `<section class="card" style="display:grid;gap:8px"><div class="row between"><p class="h2">Para ti</p>${linkBtn('nav', 'advice', 'Ver todo')}</div>
      ${tips.map((t) => `<div><b>${esc(t.title)}</b><p class="muted small">${esc(t.text)}</p></div>`).join('')}</section>` : ''}
    <section class="card"><div class="row between"><p class="h2">Recientes</p>${linkBtn('nav', 'moves', 'Ver todo')}</div>
      ${recent.length ? `<ul class="list">${recent.map(txRow).join('')}</ul>` : emptyState()}</section>
  </div>`;
}

// ---------- Movimientos ----------
export function listHtml() {
  const r = rangeOf(ui.kind, ui.anchor);
  const q = ui.q.trim().toLowerCase();
  const rows = txsIn(r).filter((t) => (ui.filter === 'all' || t.type === ui.filter) && (!q || `${t.category} ${t.note}`.toLowerCase().includes(q))).sort(sortTx);
  if (!rows.length) return emptyState(q || ui.filter !== 'all' ? 'No hay resultados con ese filtro.' : undefined);
  const groups = new Map();
  rows.forEach((t) => groups.set(t.date, [...(groups.get(t.date) || []), t]));
  return [...groups].map(([date, list]) => {
    const net = summarize(list).net;
    return `<div class="day-head"><span>${esc(rangeOf('day', date).label)}</span><span class="num">${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}</span></div><ul class="list">${list.map(txRow).join('')}</ul>`;
  }).join('');
}
export function movesView() {
  const f = [['all', 'Todos'], ['income', 'Ingresos'], ['expense', 'Gastos'], ['saving', 'Ahorros']]
    .map(([k, l]) => `<button data-act="filter" data-v="${k}" aria-pressed="${ui.filter === k}">${l}</button>`).join('');
  return `<div class="page"><h1 class="h1">Movimientos</h1>${periodControls()}
    <div class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${P.search}"/></svg>
      <label class="sr" for="q">Buscar</label><input id="q" data-n="text" class="input" type="search" placeholder="Buscar categoría o nota" value="${esc(ui.q)}" autocomplete="off"></div>
    <div class="chips" role="group" aria-label="Filtrar por tipo">${f}</div>
    <section class="card" id="txlist" style="padding:8px">${listHtml()}</section></div>`;
}

// ---------- Pagos ----------
export function pagosView() {
  const r = rangeOf(ui.kind, ui.anchor);
  const items = payItems(r);
  const paid = sumBy(items.filter((i) => i.status === 'paid'), (i) => i.amount);
  const pend = sumBy(items.filter((i) => i.status !== 'paid'), (i) => i.amount);
  const overdue = items.filter((i) => i.status !== 'paid' && i.date < today());
  const pct = paid + pend > 0 ? (paid / (paid + pend)) * 100 : 0;
  const rows = items.map((i) => {
    const st = statusLabel(i);
    const cls = st === 'Pagado' ? 'ok' : st === 'Vencido' ? 'late' : 'wait';
    const del = i.kind === 'bill' ? `<button class="icon-btn" data-act="delbill" data-id="${esc(i.txId)}" aria-label="Eliminar ${esc(i.name)}">${icon('trash')}</button>` : '';
    return `<li class="pay"><button class="chk ${cls}" data-act="togglepay" data-key="${esc(i.key)}" aria-pressed="${i.status === 'paid'}" aria-label="${i.status === 'paid' ? 'Pagado' : 'Pendiente'}: ${esc(i.name)}. Cambiar estado">${icon('check', 18)}</button>
      <span class="meta"><b>${esc(i.name)}</b><span>${esc(rangeOf('day', i.date).label)} · ${i.label} · <em class="st ${cls}">${st}</em></span></span>
      <span class="amt num ${i.status === 'paid' ? 'muted' : ''}">${fmt(i.amount)}</span>${del}</li>`;
  }).join('');
  return `<div class="page">${head('Pagos', '<button class="btn head-act" data-act="addbill">+ Nuevo pago</button>')}
    ${periodControls()}
    <section class="card"><div class="grid2"><div><p class="muted small">Pendiente</p><p class="big num ${pend ? 'warnc' : ''}" style="font-size:26px">${fmt(pend)}</p></div>
      <div><p class="muted small">Pagado</p><p class="big num pos" style="font-size:26px">${fmt(paid)}</p></div></div>
      <div class="bar" style="margin-top:12px" role="progressbar" aria-label="Pagos completados" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i class="ok" style="width:${pct}%"></i></div>
      ${overdue.length ? `<p class="neg small" style="margin-top:8px">${icon('alert', 14)} ${overdue.length} ${overdue.length === 1 ? 'pago vencido' : 'pagos vencidos'}</p>` : ''}</section>
    <section class="card" style="padding:8px">${rows ? `<ul class="list">${rows}</ul>` : `<div class="empty"><p>No hay pagos en este periodo. Aquí aparecen tus gastos fijos, los mínimos de tus tarjetas y los pagos que agregues.</p><button class="btn" data-act="addbill">Agregar pago</button></div>`}</section>
    <p class="muted small" style="text-align:center">Toca el círculo para marcar un pago como completado. Al marcar el mínimo de una tarjeta, su saldo baja automáticamente.</p></div>`;
}

// ---------- Deudas ----------
const monthLabel = (n) => { const d = new Date(new Date().getFullYear(), new Date().getMonth() + n, 1); return `${monthName(d.getMonth())} ${d.getFullYear()}`; };
const monthsText = (m) => (Number.isFinite(m) ? `${m} ${m === 1 ? 'mes' : 'meses'}` : 'Nunca (el interés supera el pago)');

export function debtResultsHtml() {
  const dl = debtList();
  if (!dl.length) return '';
  const method = currentMethod();
  const extra = currentExtra();
  const c = compare(dl, extra);
  const plan = method === 'snowball' ? c.snowball : c.avalanche;
  const order = priorityOrder(dl, method);
  const saved = Number.isFinite(c.minOnly.months) ? c.minOnly.interest - plan.interest : null;
  const cap = Math.min(120, Math.max(...[c.minOnly, plan].map((x) => (Number.isFinite(x.months) ? x.months : 120)), 1));
  const pts = (sim) => Array.from({ length: cap + 1 }, (_, m) => sim.schedule[m]?.total ?? 0);
  const chart = lines([{ name: 'Solo mínimos', color: '#f87171', points: pts(c.minOnly) }, { name: 'Tu plan', color: '#3b82f6', points: pts(plan) }], fmtShort, (i) => (i === 0 ? 'hoy' : monthLabel(i)));
  const verdict = !Number.isFinite(plan.months)
    ? `<p class="neg"><b>Con este pago no salen de deudas.</b> Sube el extra mensual o negocia la tasa.</p>`
    : `<p class="big num pos" style="font-size:26px">${monthsText(plan.months)}</p><p class="muted">Libre de deudas en <b>${esc(monthLabel(plan.months))}</b>${saved != null ? ` · ahorras <b class="num pos">${fmt(saved)}</b> en intereses` : ''}.</p>`;
  return `<div class="card inner">${verdict}</div>
    <div class="tbl" role="table" aria-label="Comparación de escenarios">
      <div role="row" class="tr th"><span role="columnheader">Escenario</span><span role="columnheader">Tiempo</span><span role="columnheader">Intereses</span></div>
      <div role="row" class="tr"><span role="cell">Solo mínimos</span><span role="cell" class="num">${Number.isFinite(c.minOnly.months) ? c.minOnly.months + ' m' : '∞'}</span><span role="cell" class="num">${Number.isFinite(c.minOnly.months) ? fmt(c.minOnly.interest) : '—'}</span></div>
      <div role="row" class="tr ${method === 'avalanche' ? 'sel' : ''}"><span role="cell">Avalancha</span><span role="cell" class="num">${Number.isFinite(c.avalanche.months) ? c.avalanche.months + ' m' : '∞'}</span><span role="cell" class="num">${Number.isFinite(c.avalanche.months) ? fmt(c.avalanche.interest) : '—'}</span></div>
      <div role="row" class="tr ${method === 'snowball' ? 'sel' : ''}"><span role="cell">Bola de nieve</span><span role="cell" class="num">${Number.isFinite(c.snowball.months) ? c.snowball.months + ' m' : '∞'}</span><span role="cell" class="num">${Number.isFinite(c.snowball.months) ? fmt(c.snowball.interest) : '—'}</span></div></div>
    ${chart}<div class="keys"><span><i style="background:#f87171"></i>Solo mínimos</span><span><i style="background:#3b82f6"></i>Tu plan</span></div>
    <div><p class="h2" style="margin-bottom:6px">Orden de ataque</p><ol class="order">${order.map((d, i) => `<li><b>${esc(d.name)}</b> <span class="muted">${Math.round(d.apr)}% anual · ${fmt(d.balance)}${plan.payoff.find((p) => p.id === d.id)?.month ? ` · se liquida en ${plan.payoff.find((p) => p.id === d.id).month} m` : ''}</span>${i === 0 ? ' <small class="badge">Extra aquí</small>' : ''}</li>`).join('')}</ol></div>`;
}

export function debtsView() {
  const dl = debtList();
  const total = sumBy(dl, (d) => d.balance);
  const mins = sumBy(dl, (d) => Math.min(d.min, d.balance));
  const interest = sumBy(dl, (d) => (d.balance * d.apr) / 1200);
  const method = currentMethod();
  const pi = planInputs();
  const extra = currentExtra();
  const fp = fortnightPlan();
  const cards = state.debts.map((d) => {
    const base = conv(d.balance, d.currency);
    return `<article class="card debt"><div class="row between"><div style="min-width:0"><b>${esc(d.name)}</b> <small class="badge">${d.type === 'loan' ? 'Préstamo' : 'Tarjeta'}</small>
        <p class="muted small">${d.apr}% anual · mínimo ${fmtC(d.min, d.currency)} · vence el día ${d.dueDay}</p></div>
        <button class="icon-btn" data-act="editdebt" data-id="${esc(d.id)}" aria-label="Editar ${esc(d.name)}">${icon('sliders')}</button></div>
      <div class="row between" style="margin-top:8px"><div><p class="big num ${d.balance > 0 ? 'neg' : 'pos'}" style="font-size:24px">${fmtC(d.balance, d.currency)}</p>${d.currency !== state.settings.currency ? `<p class="muted small">≈ ${fmt(base)}</p>` : ''}</div>
        <div class="row"><button class="btn ghost" data-act="chargedebt" data-id="${esc(d.id)}">Nueva compra</button><button class="btn" data-act="paydebt" data-id="${esc(d.id)}" ${d.balance <= 0 ? 'disabled' : ''}>Registrar pago</button></div></div></article>`;
  }).join('');
  const planCard = fp ? `<section class="card" style="display:grid;gap:10px"><div><p class="h2">Plan para tu pago de esta quincena</p>
      <p class="muted small">Recibido: <b class="num">${fmt(fp.gross)}</b>${fp.paidOut ? ` · ya salió ${fmt(fp.paidOut)}` : ''} · disponible: <b class="num">${fmt(fp.available)}</b></p></div>
      <ol class="steps2">${fp.steps.filter((s) => s.want > 0).map((s) => `<li class="${s.amount < s.want ? 'short' : ''}"><span>${esc(s.label)}</span><b class="num">${fmt(s.amount)}</b></li>`).join('')}</ol>
      ${fp.shortfall > 0 ? `<p class="neg small">${icon('alert', 14)} Te faltan ${fmt(fp.shortfall)} para cubrir todo lo anterior. Prioriza obligaciones y mínimos; recorta gastos del día a día.</p>` : ''}
      ${fp.extra > 0 && fp.target ? `<button class="btn block" data-act="payextra" data-id="${esc(fp.target.id)}" data-amt="${Math.round(fp.extra)}">Registrar ${fmt(fp.extra)} extra a ${esc(fp.target.name)}</button>` : ''}
      ${fp.leftover > 0 ? `<p class="muted small">Te sobran ${fmt(fp.leftover)} sin asignar.</p>` : ''}</section>` : '';
  const strategy = dl.length ? `<section class="card" style="display:grid;gap:14px"><p class="h2">Estrategia para salir de deudas</p>
      <div class="toggle" role="group" aria-label="Método"><button type="button" class="inc" data-act="method" data-v="avalanche" aria-pressed="${method === 'avalanche'}">Avalancha</button><button type="button" class="inc" data-act="method" data-v="snowball" aria-pressed="${method === 'snowball'}">Bola de nieve</button></div>
      <p class="muted small">${method === 'avalanche' ? '<b>Avalancha:</b> el extra va a la deuda con mayor tasa de interés. Es la que menos intereses te cuesta en total.' : '<b>Bola de nieve:</b> el extra va a la deuda más pequeña. Liquidas cuentas más rápido y ganas impulso, aunque pagues algo más de interés.'}</p>
      <div class="field"><label for="debtExtra">Pago extra mensual (además de los mínimos)</label><input id="debtExtra" data-n="money" class="input num" inputmode="decimal" value="${fmtNum(Math.round(extra), 0)}" data-extra></div>
      <div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn ghost" data-act="extra" data-v="${pi.recommended}">Sugerido: ${fmt(pi.recommended)}</button><button class="btn ghost" data-act="extra" data-v="${pi.aggressive}">Máximo: ${fmt(pi.aggressive)}</button></div>
      <p class="muted small">Cálculo: ingreso mensual estimado ${fmt(pi.income)} − fijos ${fmt(pi.fixed)} − gastos del día a día ${fmt(pi.variable.value)} (según ${pi.variable.basis}) − mínimos ${fmt(pi.mins)}${state.settings.savingsGoalPct ? ` − ahorro ${fmt(pi.reserve)}` : ''}.</p>
      <div id="debtres" style="display:grid;gap:14px">${debtResultsHtml()}</div></section>` : '';
  return `<div class="page cols">${head('Deudas', '<button class="btn head-act" data-act="adddebt">+ Agregar</button>')}
    ${dl.length || state.debts.length ? `<section class="card"><div class="grid2"><div><p class="muted small">Deuda total</p><p class="big num neg" style="font-size:26px">${fmt(total)}</p></div>
      <div><p class="muted small">Mínimos al mes</p><p class="big num" style="font-size:26px">${fmt(mins)}</p></div></div>
      <p class="muted small" style="margin-top:10px">Solo en intereses pagas ≈ <b class="num neg">${fmt(interest)}</b> al mes.</p></section>` : `<section class="card empty"><p>Agrega tus tarjetas de crédito y préstamos con su saldo, tasa de interés y pago mínimo. Te armo una estrategia para eliminarlas.</p><button class="btn" data-act="adddebt">Agregar tarjeta o deuda</button></section>`}
    ${planCard}${strategy}${cards}
    ${state.debts.length ? '<p class="disclaimer">Las proyecciones asumen tasa constante y que no haces más compras de las ya registradas: cada compra nueva con la tarjeta súbela con "Nueva compra" para que el plan se recalcule. Actualiza el saldo cuando recibas tu estado de cuenta.</p>' : ''}</div>`;
}

// ---------- Ahorros ----------
export function savingsView() {
  const goals = state.goals.map((g) => ({ g, bal: goalBalance(g) }));
  const total = sumBy(goals, (x) => x.bal);
  const lastInc = [...state.txs].filter((t) => t.type === 'income').sort(sortTx)[0];
  const sugg = lastInc ? Math.round((lastInc.amount * state.settings.savingsGoalPct) / 100) : 0;
  const cards = goals.map(({ g, bal }) => {
    const p = g.target > 0 ? Math.min(100, (bal / g.target) * 100) : 0;
    return `<article class="card debt"><div class="row between"><div style="min-width:0"><b>${esc(g.name)}</b><p class="muted small">${g.target > 0 ? `Meta ${fmt(g.target)} · faltan ${fmt(Math.max(0, g.target - bal))}` : 'Sin monto objetivo'}</p></div>
      <button class="icon-btn" data-act="editgoal" data-id="${esc(g.id)}" aria-label="Editar ${esc(g.name)}">${icon('sliders')}</button></div>
      <p class="big num infoc" style="font-size:24px;margin-top:6px">${fmt(bal)}</p>
      ${g.target > 0 ? `<div class="bar" style="margin-top:8px" role="progressbar" aria-label="Avance de ${esc(g.name)}" aria-valuenow="${Math.round(p)}" aria-valuemin="0" aria-valuemax="100"><i class="${p >= 100 ? 'ok' : ''}" style="width:${p}%"></i></div>` : ''}
      <div class="row" style="margin-top:12px"><button class="btn" style="flex:1" data-act="deposit" data-id="${esc(g.id)}" data-v="in">Depositar</button><button class="btn ghost" style="flex:1" data-act="deposit" data-id="${esc(g.id)}" data-v="out" ${bal <= 0 ? 'disabled' : ''}>Retirar</button></div></article>`;
  }).join('');
  return `<div class="page cols">${head('Ahorros', '<button class="btn head-act" data-act="addgoal">+ Nueva meta</button>')}
    ${state.goals.length ? `<section class="card"><p class="muted small">Total ahorrado</p><p class="big num infoc">${fmt(total)}</p>
      ${sugg > 0 ? `<p class="muted small" style="margin-top:8px">Sugerencia: aparta <b class="num">${fmt(sugg)}</b> (${state.settings.savingsGoalPct}% de tu último ingreso) apenas cobres.</p>` : ''}</section>` : `<section class="card empty"><p>Crea metas de ahorro (fondo de emergencia, viaje, vehículo…) y ve sumando depósitos.</p><button class="btn" data-act="addgoal">Crear mi primera meta</button></section>`}
    ${cards}</div>`;
}

// ---------- Más ----------
export function moreView() {
  const row = (act, v, ic, title, sub) => `<button class="card morerow" data-act="${act}" data-v="${v}">${icon(ic, 22)}<span><b>${title}</b><span class="muted small" style="display:block">${sub}</span></span>${icon('right', 18)}</button>`;
  return `<div class="page"><h1 class="h1">Más</h1>
    ${row('nav', 'moves', 'list', 'Movimientos', 'Historial completo con búsqueda y filtros')}
    ${row('nav', 'advice', 'bulb', 'Consejos', 'Recomendaciones para ahorrar, pagar deudas e invertir')}
    ${row('exportxlsx', '', 'table', 'Exportar a Excel', 'Libro con gráficos: resumen, movimientos, pagos, ahorros, deudas y estrategia')}
    ${health.installed ? '' : row('installhelp', '', 'phone', 'Instalar la app', 'Protege mejor tus datos y funciona sin internet')}
    ${row('nav', 'settings', 'sliders', 'Ajustes', 'Moneda, tipo de cambio, gastos fijos, presupuestos y datos')}</div>`;
}

// ---------- Consejos ----------
export function adviceView() {
  const r = rangeOf(ui.kind, ui.anchor);
  const tips = advise(adviceInput());
  const ic = { good: 'check', warn: 'alert', alert: 'alert', info: 'bulb' };
  return `<div class="page"><h1 class="h1">Consejos</h1>${periodControls()}
    <p class="muted small">Basados en tus movimientos de: ${esc(r.label)}.</p>
    ${tips.map((t) => `<article class="tip ${t.level}"><span class="ti">${icon(ic[t.level], 18)}</span><div><h3>${esc(t.title)}</h3><p>${esc(t.text)}</p></div></article>`).join('')}
    <p class="disclaimer">Recomendaciones automáticas con fines educativos. No constituyen asesoría financiera, fiscal ni de inversión.</p></div>`;
}

// ---------- Ajustes ----------
function notifySection() {
  const n = notifySettings(), perm = permission(), on = n.on && perm === 'granted';
  const status = !supported() ? (health.ios && !health.installed ? 'En iPhone, primero instala la app (Compartir → Agregar a pantalla de inicio) y ábrela desde su ícono.' : 'Este navegador no permite notificaciones.')
    : perm === 'denied' ? 'Las notificaciones están bloqueadas: actívalas en los ajustes del navegador para este sitio.' : on ? 'Activadas.' : 'Desactivadas.';
  return `<section class="card" style="display:grid;gap:12px"><div><p class="h2">Notificaciones y recordatorios</p>
      <p class="muted small">Te aviso cuando se acerca un pago y te mando consejos según tus gastos. ${security.active() ? 'Con PIN activo los avisos no muestran montos ni nombres.' : ''}</p></div>
    <p class="small"><b>${status}</b></p>
    ${on ? `<div class="field"><label for="lead">Avisarme antes de un pago</label><select id="lead" class="input" data-setting="notifyLead">${[1, 2, 3, 5].map((d) => `<option value="${d}" ${n.lead === d ? 'selected' : ''}>${d} ${d === 1 ? 'día antes' : 'días antes'}</option>`).join('')}</select></div>
      <button class="btn ghost block" data-act="notifytips">Consejos según mis gastos: ${n.tips ? 'activados' : 'desactivados'}</button>
      <button class="btn ghost block" data-act="notifytest">Enviar notificación de prueba</button>
      <button class="btn ghost block" data-act="notifyoff">Desactivar notificaciones</button>` : (supported() && perm !== 'denied' ? '<button class="btn block" data-act="notifyon">Activar notificaciones</button>' : '')}
    <button class="btn ghost block" data-act="exportics">${icon('table')} Agregar recordatorios a mi calendario (.ics)</button>
    <p class="muted small"><b>Importante:</b> sin un servidor, el navegador solo puede avisarte con la app cerrada en algunos dispositivos (Android con la app instalada). En iPhone puede no llegar el aviso si no abres la app. Los <b>recordatorios del calendario</b> sí suenan siempre, porque los dispara el propio teléfono: te recomiendo agregarlos.</p></section>`;
}

export function settingsView() {
  const st = state.settings;
  const budgets = EXPENSE_CATS.map((c) => `<div class="budget-row"><label for="b-${c}">${c}</label>
    <input id="b-${c}" data-n="money" class="input num" inputmode="decimal" placeholder="Sin tope" data-budget="${c}" value="${st.budgets[c] ? fmtNum(st.budgets[c]) : ''}"></div>`).join('');
  const opts = (sel, skip) => Object.entries(CURRENCIES).filter(([k]) => k !== skip).map(([k, v]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${v}</option>`).join('');
  return `<div class="page cols"><h1 class="h1">Ajustes</h1>
    <section class="card" style="display:grid;gap:16px">
      <div class="field"><label for="cur">Moneda principal (en la que ves todo)</label><select id="cur" class="input" data-setting="currency">${opts(st.currency)}</select></div>
      <div class="field"><label for="alt">Segunda moneda (para pagos o ingresos en otra moneda)</label><select id="alt" class="input" data-setting="altCurrency">${opts(st.altCurrency, st.currency)}</select></div>
      <div class="field"><label for="rate">Tipo de cambio: 1 ${esc(st.altCurrency)} = ___ ${esc(st.currency)}</label>
        <input id="rate" data-n="rate" class="input num" inputmode="decimal" data-setting="altRate" value="${fmtNum(st.altRate, 6)}"><p class="muted small">Se guarda con cada movimiento al momento de registrarlo. Actualízalo cuando cambie.</p></div>
      <div class="field"><label for="goal">Meta de ahorro (% de tus ingresos)</label>
        <input id="goal" data-n="int" class="input num" inputmode="numeric" maxlength="2" data-setting="savingsGoalPct" value="${st.savingsGoalPct}"></div>
    </section>
    <section class="card" style="display:grid;gap:14px"><div><p class="h2">Gastos fijos mensuales</p><p class="muted small">Se suman solos cada mes en la fecha indicada.</p></div>${fixedSection()}</section>
    <section class="card" style="display:grid;gap:12px"><div><p class="h2">Presupuesto mensual por categoría</p>
      <p class="muted small">Opcional. En quincena se usa la mitad y en día 1/30.</p></div>${budgets}</section>
    ${notifySection()}
    <section class="card" style="display:grid;gap:12px"><div><p class="h2">Privacidad y seguridad</p>
      <p class="muted small">Todo se guarda solo en este dispositivo: no hay servidor, cuenta ni base de datos en la nube. ${security.active() ? '<b class="pos">Cifrado con PIN activo.</b>' : 'Puedes protegerlo con un PIN: los datos se cifran (AES-256) y se piden al abrir la app.'}</p></div>
      ${health.installed ? '' : '<button class="btn block" data-act="installhelp">Instalar la app</button>'}
      <ul class="health"><li>${health.installed ? '<span class="pos">✓</span>' : '<span class="warnc">!</span>'} Instalada como app: <b>${health.installed ? 'sí' : 'no'}</b></li>
        <li>${health.persisted ? '<span class="pos">✓</span>' : '<span class="warnc">!</span>'} Almacenamiento protegido por el navegador: <b>${health.persisted ? 'sí' : health.persisted === false ? 'no garantizado' : 'desconocido'}</b></li>
        <li>${daysSince(st.lastBackup) <= 7 ? '<span class="pos">✓</span>' : '<span class="warnc">!</span>'} Última copia de seguridad: <b>${st.lastBackup ? esc(st.lastBackup) : 'nunca'}</b></li></ul>
      ${security.active() ? '<button class="btn ghost block" data-act="lock">Bloquear ahora</button><button class="btn ghost block" data-act="removepin">Quitar PIN</button>' : '<button class="btn ghost block" data-act="setpin">Proteger con PIN</button>'}
      <button class="btn ghost block" data-act="versions">Restaurar una versión anterior</button>
      <p class="muted small">Si olvidas el PIN no hay forma de recuperar los datos: guarda una copia de seguridad.</p></section>
    <section class="card" style="display:grid;gap:12px"><p class="h2">Tus datos (guardados solo en este dispositivo)</p>
      <button class="btn block" data-act="exportxlsx">${icon('table')} Exportar todo a Excel (.xlsx)</button>
      <button class="btn ghost block" data-act="export">${icon('download')} Copia de seguridad (JSON)</button>
      <button class="btn ghost block" data-act="import">${icon('upload')} Importar copia</button>
      <input type="file" id="file" accept="application/json,.json" hidden>
      <button class="btn ghost block" data-act="guide">Repetir guía de inicio</button>
      <button class="btn ghost block" data-act="demo">Cargar datos de ejemplo</button>
      <button class="btn danger block" data-act="wipe">${icon('trash')} Borrar todo</button></section></div>`;
}

export const VIEWS = { setup: setupView, home: homeView, pagos: pagosView, debts: debtsView, savings: savingsView, more: moreView, moves: movesView, advice: adviceView, settings: settingsView };
// [vista, texto, icono, visibilidad: '' siempre | 'desk' solo escritorio | 'mob' solo móvil]
export const NAV = [['home', 'Resumen', 'home', ''], ['pagos', 'Pagos', 'checkc', ''], ['debts', 'Deudas', 'card', ''], ['savings', 'Ahorros', 'piggy', ''],
  ['moves', 'Movimientos', 'list', 'desk'], ['advice', 'Consejos', 'bulb', 'desk'], ['settings', 'Ajustes', 'sliders', 'desk'], ['more', 'Más', 'more', 'mob']];
