import test from 'node:test';
import assert from 'node:assert/strict';
import { advise, summarize, futureValue } from '../js/advice.js';
import { rangeOf, shift } from '../js/dates.js';

const fmt = (n) => `$${Math.round(n)}`;
const tx = (type, amount, category, date = '2026-10-05') => ({ id: Math.random().toString(), type, amount, category, date, note: '' });
const base = { prev: [], kind: 'month', settings: { savingsGoalPct: 20, budgets: {} }, todayISO: '2026-10-15', fmt };

test('summarize calcula totales y tasa de ahorro', () => {
  const s = summarize([tx('income', 1000, 'Salario'), tx('expense', 400, 'Comida')]);
  assert.equal(s.net, 600);
  assert.equal(s.savingsRate, 0.6);
  assert.equal(s.byCat.Comida, 400);
});

test('alerta cuando se gasta más de lo que se gana', () => {
  const cur = [tx('income', 1000, 'Salario'), tx('expense', 1300, 'Compras')];
  const r = advise({ ...base, cur, all: cur });
  assert.equal(r[0].level, 'alert');
});

test('felicita cuando supera la meta de ahorro', () => {
  const cur = [tx('income', 1000, 'Salario'), tx('expense', 300, 'Comida')];
  const r = advise({ ...base, cur, all: cur });
  assert.equal(r[0].level, 'good');
});

test('detecta presupuesto superado', () => {
  const cur = [tx('income', 1000, 'Salario'), tx('expense', 250, 'Ocio')];
  const r = advise({ ...base, cur, all: cur, settings: { savingsGoalPct: 20, budgets: { Ocio: 200 } } });
  assert.ok(r.some((a) => a.title.includes('Presupuesto de Ocio superado')));
});

test('sin movimientos invita a registrar', () => {
  const r = advise({ ...base, cur: [], all: [] });
  assert.equal(r.length, 1);
});

test('valor futuro con tasa 0 es lineal', () => {
  assert.equal(futureValue(100, 0, 1), 1200);
});

test('quincenas: rango y navegación', () => {
  assert.deepEqual([rangeOf('fortnight', '2026-10-15').start, rangeOf('fortnight', '2026-10-15').end], ['2026-10-01', '2026-10-15']);
  assert.equal(rangeOf('fortnight', '2026-02-20').end, '2026-02-28');
  assert.equal(shift('fortnight', '2026-10-05', -1), '2026-09-30');
  assert.equal(shift('fortnight', '2026-10-05', 1), '2026-10-16');
  assert.equal(shift('month', '2026-01-31', 1), '2026-02-01');
});

import { fixedIn } from '../js/fixed.js';
test('gastos fijos: aplican el día indicado, ajustan fin de mes y respetan since', () => {
  const f = [{ id: 'a', name: 'Alquiler', amount: 100, category: 'Vivienda', day: 31, since: '2026-02-01' }];
  const r = fixedIn(f, { start: '2026-01-01', end: '2026-03-31' });
  assert.deepEqual(r.map((t) => t.date), ['2026-02-28', '2026-03-31']);
  assert.equal(fixedIn(f, { start: '2026-03-01', end: '2026-03-15' }).length, 0);
});

test('consejo de gastos fijos sobre ingreso', () => {
  const cur = [tx('income', 1000, 'Salario')];
  const r = advise({ ...base, cur, all: cur, fixedMonthly: 700 });
  assert.ok(r.some((a) => a.level === 'alert' && a.title.includes('gastos fijos')));
});

import { converter, changeBase } from '../js/money.js';
test('conversión de monedas y cambio de base', () => {
  const st = { currency: 'CRC', altCurrency: 'USD', altRate: 500 };
  const conv = converter(st);
  assert.equal(conv(10, 'USD'), 5000);
  assert.equal(conv(10, 'CRC'), 10);
  changeBase(st, 'USD');
  assert.deepEqual([st.currency, st.altCurrency, st.altRate], ['USD', 'CRC', 0.002]);
  assert.equal(converter(st)(1000, 'CRC'), 2);
});

test('summarize separa ahorro de gastos', () => {
  const s = summarize([tx('income', 100, 'Salario'), tx('expense', 30, 'Comida'), { ...tx('saving', 20, 'Meta'), type: 'saving' }]);
  assert.equal(s.expense, 30); assert.equal(s.saved, 20); assert.equal(s.net, 70);
});

test('gastos fijos se miden contra el ingreso mensual estimado, no solo el periodo parcial', () => {
  const cur = [tx('income', 500, 'Salario')]; // solo una quincena recibida
  const r = advise({ ...base, cur, all: cur, fixedMonthly: 400, monthlyIncomeEst: 1000 });
  assert.ok(r.some((a) => a.level === 'good' && a.title.includes('40%')));
});

test('semanas: lunes a domingo, etiqueta y navegación', () => {
  const w = rangeOf('week', '2026-10-15'); // jueves
  assert.deepEqual([w.start, w.end, w.kind], ['2026-10-12', '2026-10-18', 'week']);
  assert.equal(w.label, 'Semana 12 – 18 oct 2026');
  assert.equal(rangeOf('week', '2026-10-18').start, '2026-10-12', 'el domingo pertenece a la semana que termina');
  assert.equal(rangeOf('week', '2026-10-19').start, '2026-10-19', 'el lunes empieza otra');
  assert.equal(rangeOf('week', '2026-10-30').label, 'Semana 26 oct – 1 nov 2026'.replace('26 oct', '26 oct'));
  assert.equal(shift('week', '2026-10-15', -1), '2026-10-08');
  assert.equal(shift('week', '2026-12-30', 1), '2027-01-06');
  assert.equal(rangeOf('week', shift('week', '2026-10-15', -1)).start, '2026-10-05');
});

test('consejos con periodo semanal: proyección mensual (~4,33 semanas) y presupuesto proporcional', () => {
  const cur = [tx('income', 100000, 'Salario'), tx('expense', 20000, 'Ocio')];
  const r = advise({ ...base, kind: 'week', cur, all: cur, settings: { savingsGoalPct: 20, budgets: { Ocio: 60000 } } });
  assert.ok(r.some((a) => a.title.includes('Presupuesto de Ocio superado')), '60.000/mes ≈ 14.000/semana < 20.000');
  assert.ok(r.some((a) => /Qué hacer con tu excedente|Orden recomendado/.test(a.title)), 'proyecta ahorro mensual con ingreso semanal');
  assert.ok(!r.some((a) => /NaN|undefined/.test(a.title + a.text)));
});
