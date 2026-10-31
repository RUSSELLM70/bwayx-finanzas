import test from 'node:test';
import assert from 'node:assert/strict';
import { qKey, qRange, fixedHitsRange, qDefault, qSelected, qItems, qTotal, qLoaded, qProgress } from '../js/quincena.js';

const fixed = [
  { id: 'alq', name: 'Alquiler', amount: 120000, category: 'Hogar', freq: 'monthly', day: 1 },
  { id: 'net', name: 'Internet', amount: 22000, category: 'Servicios', freq: 'monthly', day: 5 },
  { id: 'gym', name: 'Gimnasio', amount: 15000, category: 'Salud', freq: 'fortnight', since: '2026-10-01' },
  { id: 'nfx', name: 'Netflix', amount: 4500, category: 'Ocio', freq: 'monthly', day: 20 },
];

test('qKey/qRange: la clave es el inicio de la quincena', () => {
  assert.equal(qKey('2026-10-05'), '2026-10-01');
  assert.equal(qKey('2026-10-20'), '2026-10-16');
  assert.equal(qRange('2026-10-20').end, '2026-10-31');
});

test('fixedHitsRange: mensual cae por día; quincenal cae por ciclo', () => {
  const r1 = qRange('2026-10-05'); // 1–15
  const r2 = qRange('2026-10-20'); // 16–31
  assert.equal(fixedHitsRange(fixed[0], r1), true);  // Alquiler día 1 en 1–15
  assert.equal(fixedHitsRange(fixed[0], r2), false); // no en 16–31
  assert.equal(fixedHitsRange(fixed[3], r1), false); // Netflix día 20 no en 1–15
  assert.equal(fixedHitsRange(fixed[3], r2), true);  // sí en 16–31
  assert.equal(fixedHitsRange(fixed[2], r1), true);  // Gimnasio quincenal cae en ambas
  assert.equal(fixedHitsRange(fixed[2], r2), true);
});

test('qDefault (sin historial): pre-carga TODOS los gastos fijos', () => {
  assert.deepEqual(qDefault(fixed, '2026-10-05', {}).sort(), ['alq', 'gym', 'net', 'nfx']);
  assert.deepEqual(qDefault(fixed, '2026-10-20', {}).sort(), ['alq', 'gym', 'net', 'nfx']);
});

test('qDefault aprende: repite la última quincena cargada (filtrando borrados)', () => {
  const qsel = { '2026-10-01': ['alq', 'nfx'] };
  assert.deepEqual(qDefault(fixed, '2026-10-20', qsel).sort(), ['alq', 'nfx']);
  // si un fijo fue borrado, no lo repite
  assert.deepEqual(qDefault(fixed, '2026-10-20', { '2026-10-01': ['alq', 'zzz'] }), ['alq']);
});

test('qSelected: usa la selección cargada; qLoaded refleja si se tocó', () => {
  const qsel = { '2026-10-16': ['net'] };
  assert.equal(qLoaded('2026-10-20', qsel), true);
  assert.equal(qLoaded('2026-10-05', qsel), false);
  assert.deepEqual(qSelected(fixed, '2026-10-20', qsel), ['net']);
});

test('qItems: marca checked y paid; qTotal suma solo los seleccionados', () => {
  const qsel = { '2026-10-01': ['alq', 'net'] };
  const paid = { 'qz:2026-10-01:alq': true };
  const items = qItems(fixed, '2026-10-05', qsel, paid);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(byId.alq.checked, true);
  assert.equal(byId.alq.paid, true);
  assert.equal(byId.nfx.checked, false);
  assert.equal(qTotal(fixed, '2026-10-05', qsel), 142000);
  assert.deepEqual(qProgress(fixed, '2026-10-05', qsel, paid), { paid: 1, total: 2 });
});
