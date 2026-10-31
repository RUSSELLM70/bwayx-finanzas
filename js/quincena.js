// Checklist de gastos fijos por quincena: cada quincena el usuario elige cuáles
// gastos fijos va a pagar. La selección se "aprende": la próxima quincena viene
// pre-marcada igual que la anterior (o, si nunca se cargó, según la frecuencia
// del gasto). Es una capa aparte (state.qsel) que NO toca la proyección de
// fixed.js ni los cálculos de presupuesto.
import { rangeOf, parse, iso, inRange, daysInMonth } from './dates.js';

/** Clave estable de una quincena = fecha de inicio (YYYY-MM-DD) de su rango. */
export const qKey = (anchor) => rangeOf('fortnight', anchor).start;
/** Rango {start,end,label} de la quincena que contiene a `anchor`. */
export const qRange = (anchor) => rangeOf('fortnight', anchor);

/** ¿un gasto fijo "cae" en esta quincena según su frecuencia? (para la sugerencia). */
export function fixedHitsRange(f, r) {
  const freq = f.freq || 'monthly';
  if (freq === 'monthly') {
    const s = parse(r.start);
    const day = Math.min(parseInt(f.day, 10) || 1, daysInMonth(s.getFullYear(), s.getMonth()));
    const d = iso(new Date(s.getFullYear(), s.getMonth(), day));
    return inRange(d, r) && (!f.since || d >= f.since);
  }
  // semanal / quincenal: ¿hay algún golpe del ciclo dentro del rango?
  const step = (freq === 'weekly' ? 7 : 14) * 86400000;
  const anchor = parse(f.since || r.start);
  const s = parse(r.start), e = parse(r.end);
  const n0 = Math.max(0, Math.ceil((s - anchor) / step));
  const cur = new Date(anchor.getTime() + n0 * step);
  return cur <= e && (!f.since || iso(cur) >= f.since);
}

/** ¿El usuario ya cargó (tocó) esta quincena? */
export const qLoaded = (anchor, qsel) => Array.isArray(qsel?.[qKey(anchor)]);

/**
 * Sugerencia por defecto para una quincena aún no cargada:
 *  - repetir la última quincena cargada (aprende), filtrando fijos ya borrados;
 *  - si nunca se cargó ninguna, los fijos que caen por su frecuencia.
 */
export function qDefault(fixed, anchor, qsel) {
  const list = Array.isArray(fixed) ? fixed : [];
  const ids = new Set(list.map((f) => f.id));
  const key = qKey(anchor);
  const prev = Object.keys(qsel || {}).filter((k) => k < key && Array.isArray(qsel[k])).sort();
  for (let i = prev.length - 1; i >= 0; i--) {
    const kept = qsel[prev[i]].filter((id) => ids.has(id));
    if (kept.length) return kept;
  }
  const r = qRange(anchor);
  return list.filter((f) => fixedHitsRange(f, r)).map((f) => f.id);
}

/** IDs efectivamente seleccionados (cargados si existe la clave, si no la sugerencia). */
export function qSelected(fixed, anchor, qsel) {
  const key = qKey(anchor);
  const list = Array.isArray(fixed) ? fixed : [];
  if (Array.isArray(qsel?.[key])) return qsel[key].filter((id) => list.some((f) => f.id === id));
  return qDefault(fixed, anchor, qsel);
}

/** Items para la UI: {id,name,amount,currency,category,checked,paid}. */
export function qItems(fixed, anchor, qsel, paid) {
  const key = qKey(anchor);
  const sel = new Set(qSelected(fixed, anchor, qsel));
  return (Array.isArray(fixed) ? fixed : []).map((f) => ({
    id: f.id, name: f.name, amount: f.amount, currency: f.currency, category: f.category,
    checked: sel.has(f.id), paid: !!(paid && paid[`qz:${key}:${f.id}`]),
  }));
}

/** Total (en moneda base vía conv) de los gastos seleccionados en la quincena. */
export function qTotal(fixed, anchor, qsel, conv = (a) => a) {
  const sel = new Set(qSelected(fixed, anchor, qsel));
  return (Array.isArray(fixed) ? fixed : []).filter((f) => sel.has(f.id))
    .reduce((a, f) => a + conv(f.amount, f.currency), 0);
}

/** Cuántos pagados / total seleccionados, para el progreso de la quincena. */
export function qProgress(fixed, anchor, qsel, paid) {
  const items = qItems(fixed, anchor, qsel, paid).filter((it) => it.checked);
  return { paid: items.filter((it) => it.paid).length, total: items.length };
}
