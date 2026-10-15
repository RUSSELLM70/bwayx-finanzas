// Gastos fijos mensuales: se materializan como movimientos "virtuales" (no se guardan uno por uno).
import { iso, parse, daysInMonth } from './dates.js';

/** fixed: [{id,name,amount,category,day,since}] → movimientos de gasto dentro de r={start,end}. */
export function fixedIn(fixed, r, conv = (a) => a) {
  const out = [];
  if (!fixed?.length) return out;
  const s = parse(r.start), e = parse(r.end);
  for (let d = new Date(s.getFullYear(), s.getMonth(), 1); d <= e; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const y = d.getFullYear(), m = d.getMonth();
    for (const f of fixed) {
      const date = iso(new Date(y, m, Math.min(f.day, daysInMonth(y, m))));
      if (date >= r.start && date <= r.end && date >= f.since) {
        out.push({ id: `fx:${f.id}:${date}`, type: 'expense', amount: conv(f.amount, f.currency), category: f.category, note: f.name, date, fixed: true, fixedId: f.id });
      }
    }
  }
  return out;
}

export const fixedTotal = (fixed, conv = (a) => a) => (fixed || []).reduce((a, f) => a + conv(f.amount, f.currency), 0);
