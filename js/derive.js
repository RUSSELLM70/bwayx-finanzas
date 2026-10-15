// Cálculos derivados del estado: periodos, pagos, deudas, planes y modelo de exportación.
import { rangeOf, shift, inRange, today, parse, iso, monthShort } from './dates.js';
import { summarize, advise } from './advice.js';
import { fixedIn, fixedTotal } from './fixed.js';
import { compare, priorityOrder, totalMin, splitIncome } from './debt.js';
import { state, ui, conv, fmt, round2, symbol, notifySettings } from './ctx.js';
import { displayAlerts } from './alerts.js';

export const txsIn = (r) => [...state.txs.filter((t) => inRange(t.date, r)), ...fixedIn(state.fixed, r, conv)];
const endOfMonth = (d = today()) => rangeOf('month', d).end;
export const earliest = () => {
  const ds = [...state.txs.map((t) => t.date), ...state.fixed.map((f) => f.since), ...state.debts.map((d) => d.since).filter((s) => s && s > '2000-01-01')];
  return ds.length ? ds.sort()[0] : today();
};
export const allTxs = () => [...state.txs, ...fixedIn(state.fixed, { start: earliest(), end: endOfMonth() }, conv)];
export const prevRange = (r) => rangeOf(r.kind, shift(r.kind, r.start, -1));
export const sumBy = (arr, f) => arr.reduce((a, x) => a + f(x), 0);

// ---------- Pagos (fijos, pagos sueltos y mínimos de tarjetas) ----------
const debtPseudoFixed = () => state.debts.filter((d) => d.min > 0).map((d) => ({ id: 'dm:' + d.id, name: `Mínimo ${d.name}`, amount: d.min, currency: d.currency, category: 'Deudas', day: d.dueDay, since: d.since || '2000-01-01' }));
export function payItems(r) {
  const items = [];
  for (const t of fixedIn(state.fixed, r, conv)) { const fl = t.freq === 'weekly' ? 'Fijo semanal' : t.freq === 'fortnight' ? 'Fijo quincenal' : 'Gasto fijo'; items.push({ key: t.id, kind: 'fixed', label: fl, name: t.note, amount: t.amount, date: t.date, status: state.paid[t.id] ? 'paid' : 'pending' }); }
  for (const t of state.txs) if (t.bill && inRange(t.date, r)) items.push({ key: 'bill:' + t.id, kind: 'bill', txId: t.id, label: 'Pago', name: t.note || t.category, amount: t.amount, date: t.date, status: t.status === 'paid' ? 'paid' : 'pending' });
  for (const t of fixedIn(debtPseudoFixed(), r, conv)) items.push({ key: t.id, kind: 'debtmin', debtId: t.fixedId.slice(3), label: 'Mínimo tarjeta', name: t.note, amount: t.amount, date: t.date, status: state.paid[t.id] ? 'paid' : 'pending' });
  return items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name)));
}
export const statusLabel = (i) => (i.status === 'paid' ? 'Pagado' : i.date < today() ? 'Vencido' : 'Pendiente');

// ---------- Deudas ----------
export const debtList = () => state.debts.map((d) => ({ id: d.id, name: d.name, balance: conv(d.balance, d.currency), apr: d.apr, min: conv(d.min, d.currency), raw: d })).filter((d) => d.balance > 0.005);

function monthIncomeEstimate() {
  const t = today();
  const inc = (r) => sumBy(state.txs.filter((x) => x.type === 'income' && inRange(x.date, r)), (x) => x.amount);
  const last = inc(rangeOf('month', shift('month', t, -1)));
  const curr = inc(rangeOf('month', t));
  if (last > 0) return Math.max(last, curr);
  // Sin mes anterior completo: quien cobra por semana → promedio semanal × 52/12 (las últimas 8 semanas)
  const d = parse(t), from = iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 56));
  const weeks = {};
  for (const x of state.txs) if (x.type === 'income' && x.note === 'Pago semanal' && x.date >= from && x.date <= t) { const k = rangeOf('week', x.date).start; weeks[k] = (weeks[k] || 0) + x.amount; }
  const wk = Object.values(weeks);
  if (wk.length) return (sumBy(wk, (v) => v) / wk.length) * (52 / 12);
  return parse(t).getDate() <= 15 ? curr * 2 : curr;
}
function variableEstimate(income) {
  const end = today();
  const d = parse(end);
  const start = iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 60));
  const v = state.txs.filter((x) => x.type === 'expense' && !x.debtId && !x.charge && !x.bill && inRange(x.date, { start, end }));
  const first = v.map((x) => x.date).sort()[0];
  const span = first ? Math.round((d - parse(first)) / 86400000) : 0;
  if (span >= 14) return { value: (sumBy(v, (x) => x.amount) * 30) / Math.max(30, span), basis: 'tu historial de gastos' };
  return { value: income * 0.3, basis: 'un estimado del 30% de tu ingreso' };
}
const roundStep = () => (['CRC', 'COP'].includes(state.settings.currency) ? 1000 : 10);

/** Cuánto sobra al mes tras fijos, gastos del día a día y mínimos → extra sugerido para deudas. */
export function planInputs() {
  const income = monthIncomeEstimate();
  const fixed = fixedTotal(state.fixed, conv);
  const variable = variableEstimate(income);
  const dl = debtList();
  const mins = Math.min(totalMin(dl), sumBy(dl, (d) => d.balance));
  const reserve = (income * state.settings.savingsGoalPct) / 100;
  const free = income - fixed - variable.value - mins;
  const step = roundStep();
  return { income, fixed, variable, mins, reserve, free, recommended: Math.max(0, Math.floor((free - reserve) / step) * step), aggressive: Math.max(0, Math.floor(free / step) * step) };
}
export const currentMethod = () => ui.method || state.settings.method || 'avalanche';
export const currentExtra = () => (state.settings.debtExtra != null ? state.settings.debtExtra : planInputs().recommended);

export function debtInfo() {
  const dl = debtList();
  if (!dl.length) return null;
  const extra = currentExtra();
  const c = compare(dl, extra);
  const method = currentMethod();
  return {
    total: sumBy(dl, (d) => d.balance), monthlyInterest: sumBy(dl, (d) => (d.balance * d.apr) / 1200), extra,
    minOnlyMonths: c.minOnly.months, minOnlyInterest: c.minOnly.interest,
    planMonths: (method === 'snowball' ? c.snowball : c.avalanche).months,
    interestSaved: Math.max(0, c.minOnly.interest - (method === 'snowball' ? c.snowball : c.avalanche).interest),
    priorityName: priorityOrder(dl, method)[0].name,
  };
}

/** Plan inteligente para el dinero recibido en la quincena actual. */
export function fortnightPlan() {
  const r = rangeOf('fortnight', today());
  const incomeTxs = state.txs.filter((t) => t.type === 'income' && inRange(t.date, r));
  const gross = sumBy(incomeTxs, (t) => t.amount);
  if (gross <= 0) return null;
  const items = payItems(r);
  const pending = items.filter((i) => i.status !== 'paid');
  const obligations = sumBy(pending.filter((i) => i.kind !== 'debtmin'), (i) => i.amount);
  const mins = pending.filter((i) => i.kind === 'debtmin').map((i) => { const d = debtList().find((x) => x.id === i.debtId); return d ? { id: d.id, name: d.name, amount: Math.min(i.amount, d.balance) } : null; }).filter(Boolean);
  const real = state.txs.filter((t) => inRange(t.date, r));
  const varSpent = sumBy(real.filter((t) => t.type === 'expense' && !t.bill && !t.debtId && !t.charge), (t) => t.amount);
  const paidOut = sumBy(real.filter((t) => t.type === 'expense' && !t.charge && !(t.bill && t.status !== 'paid')), (t) => t.amount)
    + sumBy(items.filter((i) => i.kind === 'fixed' && i.status === 'paid'), (i) => i.amount);
  const savingsDone = sumBy(real.filter((t) => t.type === 'saving'), (t) => t.amount);
  const available = Math.max(0, gross - paidOut - savingsDone);
  const living = Math.max(0, planInputs().variable.value / 2 - varSpent);
  const plan = splitIncome({ income: available, obligations, mins, living, savingsPct: state.settings.savingsGoalPct, debts: debtList(), method: currentMethod(), savingsBase: gross, savingsDone });
  return { range: r, gross, available, paidOut: paidOut + savingsDone, ...plan };
}

// ---------- Consejos ----------
export const adviceInput = () => adviceInputFor(ui.kind, ui.anchor);
export function adviceInputFor(kind, anchor) {
  const r = rangeOf(kind, anchor);
  const goalsTotal = state.goals.length ? sumBy(state.txs.filter((t) => t.type === 'saving'), (t) => t.amount) : null;
  return { cur: txsIn(r), prev: txsIn(prevRange(r)), all: allTxs(), kind, settings: state.settings, todayISO: today(), fmt, fixedMonthly: fixedTotal(state.fixed, conv), debtInfo: debtInfo(), cushion: goalsTotal, monthlyIncomeEst: planInputs().income };
}

// ---------- Modelo para Excel ----------
export function exportModel() {
  const base = state.settings.currency;
  const all = allTxs();
  const src = (t) => (t.charge ? 'Compra con tarjeta' : t.fixed ? 'Gasto fijo' : t.debtId ? 'Pago de deuda' : t.bill ? 'Pago programado' : t.type === 'saving' ? 'Ahorro' : 'Manual');
  const txs = all.map((t) => ({ date: t.date, type: t.charge ? 'charge' : t.type, category: t.category, note: t.note, currency: t.orig?.currency || base, orig: t.orig ? t.orig.amount : t.amount, rate: t.orig ? t.orig.rate : 1, amount: t.amount, source: src(t) }));
  const range = { start: earliest(), end: endOfMonth() };
  const pagos = payItems(range).map((i) => ({ date: i.date, name: i.name, kind: i.label, amount: i.amount, status: statusLabel(i) }));
  const goalBal = (g) => sumBy(state.txs.filter((t) => t.type === 'saving' && t.goalId === g.id), (t) => t.amount);
  const goals = state.goals.map((g) => ({ name: g.name, target: g.target, saved: goalBal(g) }));
  const deposits = state.txs.filter((t) => t.type === 'saving').map((t) => ({ date: t.date, goal: state.goals.find((g) => g.id === t.goalId)?.name || t.category, amount: t.amount }));
  const debts = state.debts.map((d) => ({ name: d.name, type: d.type === 'loan' ? 'Préstamo' : 'Tarjeta', currency: d.currency, balance: d.balance, balanceBase: conv(d.balance, d.currency), apr: d.apr, min: conv(d.min, d.currency), dueDay: d.dueDay }));
  const dl = debtList();
  const extra = currentExtra();
  const cmp = compare(dl, extra);
  const maxM = Math.min(120, Math.max(...[cmp.minOnly, cmp.avalanche, cmp.snowball].map((x) => (Number.isFinite(x.months) ? x.months : 120)), 1));
  const at = (sim, m) => sim.schedule[m]?.total ?? 0;
  const schedule = dl.length ? Array.from({ length: maxM + 1 }, (_, m) => ({ month: m, min: round2(at(cmp.minOnly, m)), ava: round2(at(cmp.avalanche, m)), snow: round2(at(cmp.snowball, m)) })) : [];
  const row = (name, s) => ({ name, months: s.months, interest: round2(s.interest), paid: round2(s.paid) });
  const strategy = { extra, scenarios: dl.length ? [row('Solo mínimos', cmp.minOnly), row('Avalancha (mayor tasa primero)', cmp.avalanche), row('Bola de nieve (menor saldo primero)', cmp.snowball)] : [], order: cmp.avalanche.payoff, schedule };
  // por mes
  const monthly = [];
  const first = parse(range.start);
  for (let d = new Date(first.getFullYear(), first.getMonth(), 1); iso(d) <= today().slice(0, 7) + '-31' && d <= new Date(); d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const s = summarize(txsIn(rangeOf('month', iso(d))));
    if (s.income || s.expense) monthly.push({ label: `${monthShort(d.getMonth())} ${d.getFullYear()}`, income: round2(s.income), expense: round2(s.expense) });
  }
  const cs = summarize(all.filter((t) => t.date <= endOfMonth()));
  const categories = Object.entries(cs.byCat).map(([name, amount]) => ({ name, amount: round2(amount) }));
  const g = new Date();
  return { symbol: symbol(), currency: base, generated: `${String(g.getDate()).padStart(2, '0')}/${String(g.getMonth() + 1).padStart(2, '0')}/${g.getFullYear()}`, txs, pagos, goals, deposits, debts, strategy, monthly, categories };
}

// ---------- Alertas ----------
/** Consejo extra: cobró hace poco y aún no apartó el ahorro de la quincena. */
function savingReminder() {
  if (!state.goals.length || !state.settings.savingsGoalPct) return [];
  const t = today(), d = parse(t);
  const since = iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 3));
  const recent = state.txs.filter((x) => x.type === 'income' && x.date >= since && x.date <= t);
  if (!recent.length || state.txs.some((x) => x.type === 'saving' && inRange(x.date, rangeOf('fortnight', t)))) return [];
  const amount = Math.round((sumBy(recent, (x) => x.amount) * state.settings.savingsGoalPct) / 100);
  return [{ level: 'warn', title: 'Cobraste hace poco: aparta tu ahorro', text: `Tu meta es ${state.settings.savingsGoalPct}%. Separa ${fmt(amount)} antes de gastar y deposítalos en tus metas.` }];
}

/** Datos para alertas: pagos de -7 a +14 días y consejos del mes actual. */
export function alertContext() {
  const t = today(), d = parse(t);
  const range = { start: iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7)), end: iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 14)) };
  return { nowISO: t, items: payItems(range), tips: [...savingReminder(), ...advise(adviceInputFor('month', t))] };
}
export const currentAlerts = () => displayAlerts({ ...alertContext(), lead: notifySettings().lead, fmt });

/** Eventos de calendario: pagos pendientes de los próximos 12 meses (fijos, mínimos de tarjeta y pagos sueltos). */
export function calendarEvents() {
  const t = today(), d = parse(t);
  const range = { start: t, end: iso(new Date(d.getFullYear() + 1, d.getMonth(), d.getDate())) };
  return payItems(range).filter((i) => i.status !== 'paid').map((i) => ({ uid: i.key.replace(/[^\w:-]/g, '_'), date: i.date, title: `Pago: ${i.name} · ${fmt(i.amount)}`, desc: `${i.label} · ${fmt(i.amount)}. Registrado en BWAY X - Finanzas.` }));
}
