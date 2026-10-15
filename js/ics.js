// Calendario (.ics): recordatorios que el propio teléfono dispara aunque la app esté cerrada. Sin servidor.
const enc = new TextEncoder();
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const ymd = (iso) => iso.replace(/-/g, '');
const nextDay = (iso) => { const [y, m, d] = iso.split('-').map(Number); const n = new Date(Date.UTC(y, m - 1, d + 1)); return `${n.getUTCFullYear()}${String(n.getUTCMonth() + 1).padStart(2, '0')}${String(n.getUTCDate()).padStart(2, '0')}`; };

/** Pliega líneas a 75 bytes (RFC 5545) sin cortar caracteres UTF-8. */
export function fold(line) {
  const parts = []; let cur = '', bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (parts.length ? 74 : 75)) { parts.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

/** events: [{uid, date:'YYYY-MM-DD', title, desc}] → texto .ics con dos alarmas: 9:00 del día anterior y 8:00 del día. */
export function buildIcs(events, stamp = new Date()) {
  const dt = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BWAY X//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:BWAY X - pagos'];
  for (const e of events) {
    L.push('BEGIN:VEVENT', `UID:${e.uid}@finanzasos`, `DTSTAMP:${dt}`, `DTSTART;VALUE=DATE:${ymd(e.date)}`, `DTEND;VALUE=DATE:${nextDay(e.date)}`,
      `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(e.desc || '')}`, 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'TRIGGER:-PT15H', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, 'TRIGGER:PT8H', 'END:VALARM', 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}
