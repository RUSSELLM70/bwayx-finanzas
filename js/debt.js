// Motor de estrategias de pago de deudas. Funciones puras; todo en moneda base.
// debts: [{id,name,balance,apr,min}]  (apr = % anual)
const MAX_MONTHS = 600;
const EPS = 0.005;

/** Orden de prioridad para dinero extra. avalanche: mayor tasa primero. snowball: menor saldo primero. */
export function priorityOrder(debts, method = 'avalanche') {
  const live = debts.filter((d) => d.balance > EPS);
  return [...live].sort((a, b) => (method === 'snowball' ? a.balance - b.balance || b.apr - a.apr : b.apr - a.apr || a.balance - b.balance));
}

export const totalMin = (debts) => debts.filter((d) => d.balance > EPS).reduce((a, d) => a + d.min, 0);

/**
 * Simula mes a mes: interés → mínimos → resto del presupuesto al objetivo prioritario.
 * Al liquidar una deuda su mínimo se "rueda" a la siguiente (el presupuesto total no baja).
 * months = Infinity si no se liquida en MAX_MONTHS (p. ej. mínimo menor al interés).
 */
export function simulate(debts, monthlyBudget, method = 'avalanche') {
  const ds = debts.filter((d) => d.balance > EPS).map((d) => ({ ...d, bal: d.balance, doneAt: null }));
  const order = priorityOrder(ds.map((d) => ({ ...d, balance: d.balance })), method).map((o) => ds.find((d) => d.id === o.id));
  const budgetTotal = Math.max(monthlyBudget, totalMin(debts));
  const schedule = [{ month: 0, total: ds.reduce((a, d) => a + d.bal, 0) }];
  let interest = 0, paid = 0, month = 0;
  while (ds.some((d) => d.bal > EPS) && month < MAX_MONTHS) {
    month++;
    for (const d of ds) if (d.bal > EPS) { const i = (d.bal * d.apr) / 1200; d.bal += i; interest += i; }
    let budget = budgetTotal;
    for (const d of ds) if (d.bal > EPS) { const p = Math.min(d.min, d.bal, budget); d.bal -= p; budget -= p; paid += p; }
    for (const d of order) { if (budget <= EPS) break; if (d.bal > EPS) { const p = Math.min(budget, d.bal); d.bal -= p; budget -= p; paid += p; } }
    for (const d of ds) if (d.bal <= EPS && d.doneAt == null) { d.bal = 0; d.doneAt = month; }
    schedule.push({ month, total: ds.reduce((a, d) => a + d.bal, 0) });
  }
  const done = !ds.some((d) => d.bal > EPS);
  return {
    months: done ? month : Infinity,
    interest, paid,
    payoff: order.map((d) => ({ id: d.id, name: d.name, month: d.doneAt })).sort((a, b) => (a.month ?? 1e9) - (b.month ?? 1e9)),
    schedule,
  };
}

/** Compara: solo mínimos vs avalancha vs bola de nieve (con `extra` mensual). */
export function compare(debts, extra) {
  const base = totalMin(debts);
  const minOnly = simulate(debts, base, 'avalanche');
  const avalanche = simulate(debts, base + extra, 'avalanche');
  const snowball = simulate(debts, base + extra, 'snowball');
  return { minOnly, avalanche, snowball, base };
}

/**
 * Reparto inteligente del dinero recibido en un periodo.
 * Orden: obligaciones pendientes → mínimos que vencen → gastos del día a día → ahorro → extra a la deuda prioritaria.
 */
export function splitIncome({ income, obligations, mins, living, savingsPct, debts, method = 'avalanche', savingsBase = income, savingsDone = 0 }) {
  const steps = [];
  let left = income;
  const take = (label, want, kind, extra = {}) => {
    const amount = Math.max(0, Math.min(want, left));
    steps.push({ label, amount, want, kind, ...extra });
    left -= amount;
  };
  take('Gastos fijos y pagos pendientes', obligations, 'bills');
  for (const m of mins) take(`Mínimo ${m.name}`, m.amount, 'min', { debtId: m.id });
  take('Gastos del día a día (estimado)', living, 'living');
  take('Ahorro', Math.max(0, Math.round(savingsBase * (savingsPct / 100)) - savingsDone), 'saving');
  const target = priorityOrder(debts, method)[0] || null;
  const extra = target ? Math.max(0, Math.min(left, target.balance)) : 0;
  if (target && extra > 0) { steps.push({ label: `Extra a ${target.name}`, amount: extra, want: extra, kind: 'extra', debtId: target.id }); left -= extra; }
  const shortfall = steps.reduce((a, s) => a + (s.want - s.amount), 0);
  return { steps, leftover: Math.max(0, left), shortfall, target, extra };
}

/** Mes calendario aproximado (hoy + n meses) → "mes año". */
export function monthsFromNow(n, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth() + n, 1);
  return d;
}
