// Utilidades de fechas en hora local. Todas las fechas viajan como 'YYYY-MM-DD'.
const pad = (n) => String(n).padStart(2, '0');

export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const today = () => iso(new Date());
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const monthName = (i) => MONTHS[i];
export const monthShort = (i) => MONTHS_SHORT[i];

/** Rango {start,end,label} del periodo ('day' | 'fortnight' | 'month') que contiene `anchor`. */
export function rangeOf(kind, anchor) {
  const d = parse(anchor);
  const y = d.getFullYear();
  const m = d.getMonth();
  if (kind === 'day') {
    const names = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    return { kind, start: anchor, end: anchor, label: `${names[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[m]} ${y}` };
  }
  if (kind === 'week') {
    const s = new Date(y, m, d.getDate() - ((d.getDay() + 6) % 7)); // lunes
    const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6); // domingo
    const same = s.getMonth() === e.getMonth();
    return { kind, start: iso(s), end: iso(e), label: `Semana ${s.getDate()}${same ? '' : ' ' + MONTHS_SHORT[s.getMonth()]} – ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]} ${e.getFullYear()}` };
  }
  if (kind === 'fortnight') {
    const first = d.getDate() <= 15;
    const last = daysInMonth(y, m);
    return {
      kind,
      start: iso(new Date(y, m, first ? 1 : 16)),
      end: iso(new Date(y, m, first ? 15 : last)),
      label: `${first ? '1ª' : '2ª'} quincena de ${MONTHS[m]} ${y}`,
    };
  }
  return {
    kind: 'month',
    start: iso(new Date(y, m, 1)),
    end: iso(new Date(y, m, daysInMonth(y, m))),
    label: `${MONTHS[m][0].toUpperCase()}${MONTHS[m].slice(1)} ${y}`,
  };
}

/** Mueve el ancla un periodo hacia atrás (-1) o adelante (+1). */
export function shift(kind, anchor, dir) {
  const d = parse(anchor);
  if (kind === 'day') return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + dir));
  if (kind === 'week') return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * dir));
  if (kind === 'month') return iso(new Date(d.getFullYear(), d.getMonth() + dir, 1));
  const r = rangeOf('fortnight', anchor);
  const s = parse(r.start);
  // desde el inicio de la quincena: -1 día = quincena previa; +16 días = siguiente (ambas caen dentro)
  return dir < 0
    ? iso(new Date(s.getFullYear(), s.getMonth(), s.getDate() - 1))
    : iso(new Date(parse(r.end).getFullYear(), parse(r.end).getMonth(), parse(r.end).getDate() + 1));
}

export const inRange = (date, r) => date >= r.start && date <= r.end;
