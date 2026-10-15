// Mutaciones del estado (cada una persiste). Sin DOM.
import { today } from './dates.js';
import { state, persist, mkAmount, round2 } from './ctx.js';
import { uid } from './store.js';
import { payItems } from './derive.js';

/** Registra un pago a una deuda: crea el gasto y baja el saldo (en la moneda de la deuda). */
export function payDebt(debtId, amountInDebtCur, date = today(), note = '') {
  const d = state.debts.find((x) => x.id === debtId);
  if (!d) return null;
  const amt = round2(Math.min(amountInDebtCur, d.balance));
  if (!(amt > 0)) return null;
  const tx = { id: uid(), type: 'expense', category: 'Deudas', note: note || `Pago ${d.name}`, date, debtId, debtPaid: amt, ...mkAmount(amt, d.currency) };
  state.txs.push(tx);
  d.balance = round2(d.balance - amt);
  persist();
  return tx;
}

/** Compra nueva con tarjeta/deuda: sube el saldo (en la moneda de la deuda) y queda en el historial. */
export function chargeCard(debtId, amountInDebtCur, category, note = '', date = today()) {
  const d = state.debts.find((x) => x.id === debtId);
  if (!d || !(amountInDebtCur > 0)) return null;
  const amt = round2(amountInDebtCur);
  const tx = { id: uid(), type: 'expense', charge: true, cardId: debtId, category, note: note || `Compra con ${d.name}`, date, ...mkAmount(amt, d.currency) };
  tx.chargeAmt = amt;
  state.txs.push(tx);
  d.balance = round2(d.balance + amt);
  persist();
  return tx;
}

export function removeCharge(tx) {
  const d = state.debts.find((x) => x.id === tx.cardId);
  if (d) d.balance = round2(Math.max(0, d.balance - (tx.chargeAmt || 0)));
  state.txs = state.txs.filter((t) => t.id !== tx.id);
  persist();
}

/** Elimina un pago de deuda y devuelve el monto al saldo. */
export function removePayment(tx) {
  const d = state.debts.find((x) => x.id === tx.debtId);
  if (d) d.balance = round2(d.balance + (tx.debtPaid || 0));
  state.txs = state.txs.filter((t) => t.id !== tx.id);
  for (const [k, v] of Object.entries(state.paid)) if (v && v.txId === tx.id) delete state.paid[k];
  persist();
}

/** Alterna pagado/pendiente de un elemento de la pantalla Pagos. Devuelve texto para el aviso. */
export function togglePay(key) {
  if (key.startsWith('bill:')) {
    const t = state.txs.find((x) => x.id === key.slice(5));
    if (!t) return '';
    t.status = t.status === 'paid' ? 'pending' : 'paid';
    persist();
    return t.status === 'paid' ? 'Marcado como pagado' : 'Marcado como pendiente';
  }
  if (key.startsWith('fx:dm:')) { // mínimo de tarjeta: crea/revierte el pago real
    const cur = state.paid[key];
    if (cur) {
      const tx = state.txs.find((t) => t.id === cur.txId);
      if (tx) removePayment(tx); else delete state.paid[key];
      persist();
      return 'Pago revertido: el saldo de la tarjeta se restauró';
    }
    const [, , debtId] = key.split(':');
    const item = payItems({ start: key.split(':').pop(), end: key.split(':').pop() }).find((i) => i.key === key);
    const d = state.debts.find((x) => x.id === debtId);
    if (!d) return '';
    const tx = payDebt(debtId, d.min, today(), `Pago mínimo ${d.name}`);
    if (!tx) return 'Esa deuda ya está en cero';
    state.paid[key] = { txId: tx.id };
    persist();
    return item ? 'Mínimo pagado: el saldo de la tarjeta bajó' : 'Mínimo pagado';
  }
  if (state.paid[key]) delete state.paid[key]; else state.paid[key] = true;
  persist();
  return state.paid[key] ? 'Marcado como pagado' : 'Marcado como pendiente';
}

export const goalBalance = (g) => state.txs.filter((t) => t.type === 'saving' && t.goalId === g.id).reduce((a, t) => a + t.amount, 0);

export function addSaving(goalId, signedAmount, date = today()) {
  const g = state.goals.find((x) => x.id === goalId);
  if (!g) return null;
  const tx = { id: uid(), type: 'saving', goalId, category: g.name, note: signedAmount >= 0 ? 'Depósito' : 'Retiro', date, amount: round2(signedAmount) };
  state.txs.push(tx);
  persist();
  return tx;
}

export function deleteGoal(id) {
  state.goals = state.goals.filter((g) => g.id !== id);
  state.txs = state.txs.filter((t) => t.goalId !== id);
  persist();
}
export function deleteDebt(id) {
  state.debts = state.debts.filter((d) => d.id !== id);
  for (const t of state.txs) if (t.debtId === id) { delete t.debtId; delete t.debtPaid; }
  for (const k of Object.keys(state.paid)) if (k.startsWith(`fx:dm:${id}:`)) delete state.paid[k];
  persist();
}
