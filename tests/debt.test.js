import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, compare, priorityOrder, splitIncome, totalMin } from '../js/debt.js';

const cards = [
  { id: 'a', name: 'Visa', balance: 1000, apr: 60, min: 60 },
  { id: 'b', name: 'MC', balance: 400, apr: 30, min: 30 },
];

test('avalancha: la tarjeta con mayor tasa va primero; bola de nieve: el menor saldo', () => {
  assert.equal(priorityOrder(cards, 'avalanche')[0].id, 'a');
  assert.equal(priorityOrder(cards, 'snowball')[0].id, 'b');
});

test('pagar extra reduce meses e intereses; avalancha nunca paga más interés que bola de nieve', () => {
  const c = compare(cards, 100);
  assert.ok(c.avalanche.months < c.minOnly.months);
  assert.ok(c.avalanche.interest < c.minOnly.interest);
  assert.ok(c.avalanche.interest <= c.snowball.interest + 1e-6);
});

test('la simulación liquida todo y el total pagado = saldo + intereses', () => {
  const r = simulate(cards, 300, 'avalanche');
  assert.ok(Number.isFinite(r.months));
  assert.ok(Math.abs(r.paid - (1400 + r.interest)) < 0.01);
  assert.equal(r.schedule.at(-1).total, 0);
});

test('mínimo menor al interés nunca liquida (Infinity)', () => {
  const r = simulate([{ id: 'x', name: 'X', balance: 1000, apr: 60, min: 10 }], 10);
  assert.equal(r.months, Infinity);
});

test('reparto del ingreso: orden de prioridades y extra a la deuda correcta', () => {
  const p = splitIncome({ income: 1000, obligations: 300, mins: [{ id: 'a', name: 'Visa', amount: 60 }], living: 300, savingsPct: 10, debts: cards });
  assert.deepEqual(p.steps.map((s) => s.kind), ['bills', 'min', 'living', 'saving', 'extra']);
  assert.equal(p.extra, 240);
  assert.equal(p.target.id, 'a');
  assert.equal(p.shortfall, 0);
});

test('reparto con ingreso insuficiente reporta faltante', () => {
  const p = splitIncome({ income: 200, obligations: 300, mins: [], living: 0, savingsPct: 0, debts: cards });
  assert.equal(p.shortfall, 100);
  assert.equal(totalMin(cards), 90);
});
