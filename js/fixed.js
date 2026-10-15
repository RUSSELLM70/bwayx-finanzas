// Gastos fijos: mensuales (día del mes), quincenales (cada 14 días) o semanales (cada 7 días).
import { iso, parse, daysInMonth } from './dates.js';

/** fixed: [{id,name,amount,category,day,freq,since}] → movimientos de gasto dentro de r={start,end}. */
export function fixedIn(fixed, r, conv = (a) => a) {
  const out = [];
  if (!fixed?.length) return out;
  const s = parse(r.start), e = parse(r.end);
  for (const f of fixed) {
    const freq = f.freq || 'monthly';
    if (freq === 'weekly' || freq === 'fortnight') {
      const step = freq === 'weekly' ? 7 : 14;
      const anchor = parse(f.since);
      const msPerStep = step * 86400000;
      const msFromAnchor = s - anchor;
      const startN = Math.max(0, Math.ceil(msFromAnchor / msPerStep));
      for (let n = startN; ; n++) {
        const cur = new Date(anchor.getTime() + n * msPerStep);
        if (cur > e) break;
        const date = iso(cur);
        if (date >= r.start && date <= r.end && date >= f.since) {
          out.push({ id: `fx:${f.id}:${date}`, type: 'expense', amount: conv(f.amount, f.currency), category: f.category, note: f.name, date, fixed: true, fixedId: f.id, freq });
        }
      }
    } else {
      // monthly
      for (let d = new Date(s.getFullYear(), s.getMonth(), 1); d <= e; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        const y = d.getFullYear(), m = d.getMonth();
        const date = iso(new Date(y, m, Math.min(f.day, daysInMonth(y, m))));
        if (date >= r.start && date <= r.end && date >= f.since) {
          out.push({ id: `fx:${f.id}:${date}`, type: 'expense', amount: conv(f.amount, f.currency), category: f.category, note: f.name, date, fixed: true, fixedId: f.id, freq: 'monthly' });
        }
      }
    }
  }
  return out;
}

// Equivalente mensual para cálculos de presupuesto
export const fixedTotal = (fixed, conv = (a) => a) => (fixed || []).reduce((a, f) => {
  const freq = f.freq || 'monthly';
  const mult = freq === 'weekly' ? 52 / 12 : freq === 'fortnight' ? 2 : 1;
  return a + conv(f.amount, f.currency) * mult;
}, 0);
