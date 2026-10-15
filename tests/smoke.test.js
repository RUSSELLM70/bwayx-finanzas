import test from 'node:test';
import assert from 'node:assert/strict';
import { demoData, sanitizeImport } from '../js/store.js';
import { advise, summarize } from '../js/advice.js';
import { donut, bars } from '../js/charts.js';
import { rangeOf, today, inRange } from '../js/dates.js';

const fmt = (n) => `₡${Math.round(n)}`;

test('datos de ejemplo producen consejos y gráficas válidas', () => {
  const txs = demoData(new Date(2026, 9, 15));
  assert.ok(txs.length > 50);
  const r = rangeOf('month', '2026-10-15');
  const cur = txs.filter((t) => inRange(t.date, r));
  const prev = txs.filter((t) => inRange(t.date, rangeOf('month', '2026-09-15')));
  const tips = advise({ cur, prev, all: txs, kind: 'month', settings: { savingsGoalPct: 20, budgets: { Comida: 50000 } }, todayISO: '2026-10-15', fmt });
  assert.ok(tips.length >= 3);
  assert.ok(tips.every((t) => t.title && t.text && !/NaN|undefined|Infinity/.test(t.title + t.text)), JSON.stringify(tips));
  const s = summarize(cur);
  const items = Object.entries(s.byCat).map(([label, value]) => ({ label, value, color: '#fff' }));
  assert.match(donut(items, '₡1', 'gastado'), /<svg/);
  assert.match(bars([{ label: 'oct', income: 5, expense: 3 }], fmt), /<svg/);
});

test('importación descarta registros inválidos', () => {
  const out = sanitizeImport({ txs: [{ type: 'income', amount: 10, date: '2026-01-01' }, { type: 'x', amount: 5, date: '2026-01-01' }, { type: 'expense', amount: -3, date: '2026-01-01' }] });
  assert.equal(out.txs.length, 1);
  assert.throws(() => sanitizeImport({}));
});
