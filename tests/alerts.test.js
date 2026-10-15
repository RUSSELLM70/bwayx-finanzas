import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentAlerts, displayAlerts, buildAgenda, pickTip, dueNow, recentTipHashes, hash } from '../js/alerts.js';
import { buildIcs, fold } from '../js/ics.js';

const fmt = (n) => `₡${Math.round(n).toLocaleString('es')}`;
const NOW = new Date(2026, 9, 15, 10, 0).getTime(); // 15 oct 2026 10:00
const nowISO = '2026-10-15';
const item = (key, name, date, amount = 1000, status = 'pending') => ({ key, name, date, amount, status });

test('pagos: aviso previo, del día y vencido; los pagados no avisan', () => {
  const a = paymentAlerts([item('a', 'Visa', '2026-10-17'), item('b', 'Alquiler', '2026-10-15'), item('c', 'Luz', '2026-10-13'), item('d', 'Netflix', '2026-10-16', 5, 'paid')], { nowISO, lead: 2, fmt });
  const tags = a.map((x) => x.tag).sort();
  assert.deepEqual(tags, ['pay:a:0', 'pay:a:lead', 'pay:b:0', 'pay:c:late']);
  const lead = a.find((x) => x.tag === 'pay:a:lead');
  assert.equal(lead.at, new Date(2026, 9, 15, 9).getTime()); // 2 días antes a las 9:00
  assert.match(lead.body, /Visa vence el .*17 oct/);
  assert.match(a.find((x) => x.tag === 'pay:c:late').body, /venció hace 2 días/);
});

test('pagos fuera de la ventana (muy viejos o a más de 14 días) se ignoran', () => {
  assert.equal(paymentAlerts([item('x', 'A', '2026-10-01'), item('y', 'B', '2026-11-30')], { nowISO, fmt }).length, 0);
});

test('con PIN (genérico) no se filtran nombres ni montos', () => {
  const a = paymentAlerts([item('a', 'Visa BAC', '2026-10-15', 42500)], { nowISO, fmt, generic: true });
  for (const x of a) assert.ok(!/Visa|42/.test(x.title + x.body));
});

test('alertas dentro de la app: ordenadas por urgencia y con consejo', () => {
  const tips = [{ level: 'info', title: 'Info', text: 'x' }, { level: 'warn', title: 'Gastos hormiga', text: 'Cafés y antojos suman.' }];
  const d = displayAlerts({ items: [item('a', 'Luz', '2026-10-17'), item('b', 'Visa', '2026-10-14'), item('c', 'Agua', '2026-10-15')], tips, nowISO, lead: 2, fmt });
  assert.deepEqual(d.map((x) => x.title), ['Visa venció ayer', 'Agua vence hoy', 'Luz vence en 2 días', 'Gastos hormiga']);
  assert.equal(d[0].level, 'alert'); assert.equal(d[2].level, 'warn'); assert.equal(d[3].level, 'info');
});

test('consejos: primero alertas; no se repite el mismo en 3 días', () => {
  const tips = [{ level: 'warn', title: 'B', text: 'b' }, { level: 'alert', title: 'A', text: 'a' }, { level: 'good', title: 'G', text: 'g' }];
  assert.equal(pickTip(tips).title, 'A');
  assert.equal(pickTip(tips, new Set([hash('A')])).title, 'B');
  assert.equal(pickTip(tips, new Set([hash('A'), hash('B')])), undefined);
  const skip = recentTipHashes({ [`tip:${hash('A')}:2026-10-14`]: NOW - 864e5, [`tip:${hash('B')}:2026-10-01`]: NOW - 14 * 864e5 }, NOW);
  assert.ok(skip.has(hash('A')) && !skip.has(hash('B')));
});

test('agenda: incluye pagos y un consejo a las 19:00; lo viejo se descarta; dueNow respeta ventana y dedupe', () => {
  const ag = buildAgenda({ items: [item('a', 'Visa', '2026-10-16'), item('old', 'Viejo', '2026-10-01')], tips: [{ level: 'warn', title: 'Hormiga', text: 'Cuidado con gastos pequeños' }], nowMs: NOW, nowISO, lead: 2, fmt });
  const tip = ag.find((x) => x.kind === 'tip');
  assert.equal(tip.at, new Date(2026, 9, 15, 19).getTime());
  assert.ok(!ag.some((x) => x.tag.includes('old')));
  const due = dueNow(ag, {}, NOW).map((x) => x.tag);
  assert.ok(due.includes('pay:a:lead') && !due.includes(tip.tag), 'el consejo de las 19:00 aún no toca');
  assert.equal(dueNow(ag, { 'pay:a:lead': NOW }, NOW).some((x) => x.tag === 'pay:a:lead'), false, 'no repite lo ya enviado');
  assert.equal(dueNow(ag, {}, NOW + 3 * 864e5).some((x) => x.tag === 'pay:a:lead'), false, 'no envía avisos caducados');
  const noTips = buildAgenda({ items: [], tips: [{ level: 'warn', title: 'x', text: 'y' }], nowMs: NOW, nowISO, fmt, tipsOn: false });
  assert.equal(noTips.length, 0);
});

test('calendario .ics: formato válido, escape y plegado de líneas', () => {
  const ics = buildIcs([{ uid: 'fx:a:2026-10-17', date: '2026-10-17', title: 'Pago: Visa, BAC; ₡42.500', desc: 'Línea1\nLínea2' }], new Date('2026-10-15T12:00:00Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /DTSTART;VALUE=DATE:20261017\r\nDTEND;VALUE=DATE:20261018/);
  assert.match(ics, /SUMMARY:Pago: Visa\\, BAC\\; ₡42\.500/);
  assert.match(ics, /DESCRIPTION:Línea1\\nLínea2/);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 2);
  assert.match(ics, /TRIGGER:-PT15H/);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.equal(fold('é'.repeat(100)).split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75), true);
  assert.equal(buildIcs([{ uid: 'x', date: '2026-12-31', title: 't' }]).includes('DTEND;VALUE=DATE:20270101'), true);
});
