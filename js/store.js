// Persistencia local (localStorage). Los datos nunca salen del dispositivo.
import { iso } from './dates.js';

export const KEY = 'finanzasos:v1';
export const SCHEMA = 1; // sube este número al cambiar el formato y migra en load()
const DEFAULTS = () => ({ txs: [], fixed: [], debts: [], goals: [], paid: {}, settings: { currency: 'CRC', altCurrency: 'USD', altRate: 510, savingsGoalPct: 20, budgets: {}, onboarded: false, method: 'avalanche', debtExtra: null, notify: { on: false, lead: 2, tips: true } } });

export function load(parsed) {
  try {
    const raw = parsed ?? JSON.parse(localStorage.getItem(KEY));
    const d = DEFAULTS();
    return { txs: Array.isArray(raw?.txs) ? raw.txs : d.txs, fixed: Array.isArray(raw?.fixed) ? raw.fixed : d.fixed, debts: Array.isArray(raw?.debts) ? raw.debts : d.debts, goals: Array.isArray(raw?.goals) ? raw.goals : d.goals, paid: raw?.paid && typeof raw.paid === 'object' ? raw.paid : d.paid, settings: { ...d.settings, ...(raw?.settings || {}) } };
  } catch {
    return DEFAULTS();
  }
}

/** Guarda y verifica leyendo de vuelta. false si el navegador lo rechaza o el dato no quedó íntegro. */
export function save(state) {
  try {
    const json = JSON.stringify({ ...state, schema: SCHEMA });
    localStorage.setItem(KEY, json);
    return localStorage.getItem(KEY) === json;
  } catch { return false; }
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Valida un archivo importado; devuelve estado limpio o lanza Error. */
import { cleanText } from './inputs.js';
export function sanitizeImport(obj) {
  if (!obj || !Array.isArray(obj.txs)) throw new Error('Archivo inválido');
  const txs = obj.txs
    .filter((t) => t && ['income', 'expense', 'saving'].includes(t.type) && Number.isFinite(+t.amount) && +t.amount !== 0 && (t.type === 'saving' || +t.amount > 0) && /^\d{4}-\d{2}-\d{2}$/.test(t.date))
    .map((t) => ({ id: String(t.id || uid()), type: t.type, amount: +t.amount, category: cleanText(t.category || 'Otros', 40) || 'Otros', note: cleanText(t.note, 120), date: t.date, ...(t.orig && Number.isFinite(+t.orig.amount) ? { orig: { amount: +t.orig.amount, currency: String(t.orig.currency || '').slice(0, 5), rate: +t.orig.rate || 1 } } : {}), ...(t.bill ? { bill: true, status: t.status === 'pending' ? 'pending' : 'paid' } : {}), ...(t.goalId ? { goalId: String(t.goalId) } : {}), ...(t.debtId ? { debtId: String(t.debtId), debtPaid: +t.debtPaid || 0 } : {}), ...(t.charge && t.cardId ? { charge: true, cardId: String(t.cardId) } : {}) }));
  const fixed = (Array.isArray(obj.fixed) ? obj.fixed : [])
    .filter((f) => f && Number.isFinite(+f.amount) && +f.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(f.since))
    .map((f) => ({ id: String(f.id || uid()), name: cleanText(f.name || 'Gasto fijo', 60) || 'Gasto fijo', amount: +f.amount, category: cleanText(f.category || 'Otros', 40) || 'Otros', day: Math.min(31, Math.max(1, parseInt(f.day, 10) || 1)), since: f.since }));
  const num = (x, def = 0) => (Number.isFinite(+x) ? +x : def);
  const debts = (Array.isArray(obj.debts) ? obj.debts : []).filter((d) => d && num(d.balance) >= 0).map((d) => ({ id: String(d.id || uid()), name: cleanText(d.name || 'Deuda', 60) || 'Deuda', type: d.type === 'loan' ? 'loan' : 'card', currency: String(d.currency || 'CRC').slice(0, 5), balance: num(d.balance), apr: num(d.apr), min: num(d.min), dueDay: Math.min(31, Math.max(1, parseInt(d.dueDay, 10) || 1)), since: /^\d{4}-\d{2}-\d{2}$/.test(d.since) ? d.since : '2000-01-01' }));
  const goals = (Array.isArray(obj.goals) ? obj.goals : []).filter((g) => g && g.name).map((g) => ({ id: String(g.id || uid()), name: cleanText(g.name, 60) || 'Meta', target: Math.max(0, num(g.target)) }));
  return { txs, fixed, debts, goals, paid: obj.paid && typeof obj.paid === 'object' ? obj.paid : {}, settings: { ...DEFAULTS().settings, ...(obj.settings || {}) } };
}

/** Datos de ejemplo deterministas: ~3 meses hacia atrás desde hoy. */
export function demoData(todayDate = new Date()) {
  const txs = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const add = (type, amount, category, d, note = '') => txs.push({ id: uid(), type, amount: Math.round(amount), category, note, date: iso(d) });
  for (let back = 0; back < 3; back++) {
    const y = todayDate.getFullYear();
    const m = todayDate.getMonth() - back;
    const day = (n) => new Date(y, m, n);
    const limit = back === 0 ? todayDate.getDate() : 28;
    const when = (n) => n <= limit;
    if (when(15)) add('income', 450000, 'Salario', day(15), 'Pago quincena');
    if (when(28)) add('income', 450000, 'Salario', day(28), 'Pago quincena');
    if (back === 1 && when(20)) add('income', 120000, 'Freelance', day(20), 'Proyecto web');
    if (when(5)) add('expense', 45000, 'Servicios', day(5), 'Luz, agua e internet');
    if (when(8)) add('expense', 19000, 'Suscripciones', day(8), 'Streaming y música');
    for (let n = 1; n <= limit; n += 3) {
      add('expense', 7000 + rnd() * 9000, 'Comida', day(n), 'Supermercado');
      if (rnd() > 0.45) add('expense', 3000 + rnd() * 3000, 'Restaurantes', day(n), 'Almuerzo fuera');
      if (rnd() > 0.5) add('expense', 1800 + rnd() * 2200, 'Otros', day(n), 'Café');
      if (rnd() > 0.6) add('expense', 4000 + rnd() * 4000, 'Transporte', day(n), 'Combustible');
    }
    if (when(18)) add('expense', 25000 + rnd() * 20000, 'Compras', day(18), 'Ropa');
  }
  return txs;
}

/** Deudas, meta y depósitos de ejemplo (para ver la estrategia y los ahorros funcionando). */
export function demoExtras(todayDate = new Date()) {
  const first = iso(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
  const goalId = uid();
  const dep = (back, amount) => ({ id: uid(), type: 'saving', goalId, category: 'Fondo de emergencia', note: 'Depósito', amount, date: iso(new Date(todayDate.getFullYear(), todayDate.getMonth() - back, 20)) });
  return {
    debts: [
      { id: uid(), name: 'Visa Banco Nacional', type: 'card', currency: 'CRC', balance: 850000, apr: 54, min: 42500, dueDay: 10, since: first },
      { id: uid(), name: 'Mastercard (USD)', type: 'card', currency: 'USD', balance: 600, apr: 48, min: 35, dueDay: 22, since: first },
    ],
    goals: [{ id: goalId, name: 'Fondo de emergencia', target: 1500000 }],
    savingTxs: [dep(2, 40000), dep(1, 60000), dep(0, 30000)],
  };
}
