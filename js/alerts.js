// Alertas: pagos próximos y consejos según los gastos. Funciones puras (sin DOM) para poder probarlas.
import { parse, rangeOf, iso } from './dates.js';

const DAY = 864e5, HOUR = 36e5;
export const hash = (s) => { let h = 5381; for (const c of String(s)) h = ((h << 5) + h + c.codePointAt(0)) >>> 0; return h.toString(36); };
const at = (isoDate, off, hour) => { const d = parse(isoDate); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + off, hour).getTime(); };
export const daysUntil = (fromISO, toISO) => Math.round((parse(toISO) - parse(fromISO)) / DAY);
const whenLabel = (d) => rangeOf('day', d).label.replace(/ \d{4}$/, '');
const cut = (s, n = 140) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const GENERIC_PAY = ['BWAY X', 'Tienes un pago pendiente. Ábrela para ver los detalles.'];
const GENERIC_TIP = ['BWAY X', 'Tienes un consejo nuevo según tus gastos. Ábrela para verlo.'];

/** Avisos programables por pago pendiente: X días antes (a las 9:00), el día (8:00) y cuando ya venció. */
export function paymentAlerts(items, { nowISO, lead = 2, fmt, generic = false }) {
  const out = [];
  for (const it of items) {
    if (it.status === 'paid') continue;
    const dl = daysUntil(nowISO, it.date);
    if (dl < -7 || dl > 14) continue;
    const mk = (suffix, level, when, maxAge, title, body) => {
      const [t, b] = generic ? GENERIC_PAY : [title, body];
      out.push({ tag: `pay:${it.key}:${suffix}`, kind: 'pay', level, at: when, maxAge, title: t, body: b, view: 'pagos', days: dl });
    };
    if (dl < 0) { mk('late', 'alert', at(it.date, 1, 9), 7 * DAY, 'Pago vencido', `${it.name} venció ${dl === -1 ? 'ayer' : `hace ${-dl} días`} (${fmt(it.amount)}).`); continue; }
    mk('0', 'alert', at(it.date, 0, 8), 36 * HOUR, 'Hoy vence un pago', `${it.name}: ${fmt(it.amount)}`);
    if (lead > 0 && dl > 0) mk('lead', 'warn', at(it.date, -lead, 9), 36 * HOUR, 'Pago próximo', `${it.name} vence el ${whenLabel(it.date)} · ${fmt(it.amount)}`);
  }
  return out;
}

/** Primer consejo relevante (alertas antes que advertencias) que no se haya enviado hace poco. */
export function pickTip(tips, skipHashes = new Set()) {
  const rank = { alert: 0, warn: 1 };
  return tips.filter((t) => t.level in rank).sort((a, b) => rank[a.level] - rank[b.level]).find((t) => !skipHashes.has(hash(t.title)));
}

/** Lo que se ve dentro de la app (siempre, haya o no permiso de notificaciones). */
export function displayAlerts({ items, tips, nowISO, lead = 2, fmt }) {
  const horizon = Math.max(lead, 3);
  const pays = items.filter((i) => i.status !== 'paid').map((i) => ({ i, dl: daysUntil(nowISO, i.date) }))
    .filter(({ dl }) => dl >= -7 && dl <= horizon).sort((a, b) => a.dl - b.dl).slice(0, 4)
    .map(({ i, dl }) => ({ level: dl <= 0 ? 'alert' : 'warn', view: 'pagos', body: fmt(i.amount),
      title: dl < 0 ? `${i.name} venció ${dl === -1 ? 'ayer' : `hace ${-dl} días`}` : dl === 0 ? `${i.name} vence hoy` : dl === 1 ? `${i.name} vence mañana` : `${i.name} vence en ${dl} días` }));
  const tip = pickTip(tips);
  return tip ? [...pays, { level: 'info', title: tip.title, body: cut(tip.text, 160), view: 'advice' }] : pays;
}

/** Agenda de notificaciones del sistema para los próximos 15 días (la lee el service worker, incluso con la app cerrada). */
export function buildAgenda({ items, tips, nowMs, nowISO, lead = 2, tipsOn = true, generic = false, fmt, skipHashes = new Set() }) {
  const list = paymentAlerts(items, { nowISO, lead, fmt, generic });
  if (tipsOn) {
    const tip = pickTip(tips, skipHashes);
    if (tip) {
      const d = new Date(nowMs); const when = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 19);
      if (when.getTime() <= nowMs) when.setDate(when.getDate() + 1);
      const [title, body] = generic ? GENERIC_TIP : [tip.title, cut(tip.text)];
      list.push({ tag: `tip:${hash(tip.title)}:${iso(when)}`, kind: 'tip', level: 'info', at: when.getTime(), maxAge: 12 * HOUR, title, body, view: 'advice' });
    }
  }
  return list.filter((a) => a.at + a.maxAge > nowMs && a.at < nowMs + 15 * DAY).sort((a, b) => a.at - b.at);
}

/** Hashes de consejos enviados hace menos de `days` días (para no repetir el mismo consejo). */
export function recentTipHashes(notified, nowMs, days = 3) {
  const s = new Set();
  for (const [tag, ts] of Object.entries(notified || {})) if (tag.startsWith('tip:') && nowMs - ts < days * DAY) s.add(tag.split(':')[1]);
  return s;
}
export const dueNow = (agenda, notified, nowMs) => agenda.filter((a) => a.at <= nowMs && nowMs - a.at <= a.maxAge && !notified[a.tag]);
