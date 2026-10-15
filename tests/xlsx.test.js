import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { buildXlsx, zip } from '../js/xlsx.js';

export const sample = () => ({
  symbol: '₡', currency: 'CRC', generated: '15/10/2026',
  txs: [
    { date: '2026-09-15', type: 'income', category: 'Salario', note: 'Quincena', currency: 'CRC', orig: 450000, rate: 1, amount: 450000, source: 'Manual' },
    { date: '2026-09-20', type: 'expense', category: 'Comida', note: 'Súper & "más" <b>', currency: 'USD', orig: 50, rate: 510, amount: 25500, source: 'Manual' },
    { date: '2026-10-02', type: 'expense', category: 'Vivienda', note: 'Alquiler', currency: 'CRC', orig: 260000, rate: 1, amount: 260000, source: 'Gasto fijo' },
    { date: '2026-10-05', type: 'saving', category: 'Fondo', note: 'Depósito', currency: 'CRC', orig: 20000, rate: 1, amount: 20000, source: 'Ahorro' },
  ],
  pagos: [{ date: '2026-10-02', name: 'Alquiler', kind: 'Gasto fijo', amount: 260000, status: 'Pagado' }, { date: '2026-10-10', name: 'Mínimo Visa', kind: 'Mínimo tarjeta', amount: 42500, status: 'Pendiente' }],
  goals: [{ name: 'Fondo de emergencia', target: 1000000, saved: 20000 }],
  deposits: [{ date: '2026-10-05', goal: 'Fondo de emergencia', amount: 20000 }],
  debts: [{ name: 'Visa', type: 'Tarjeta', currency: 'CRC', balance: 850000, balanceBase: 850000, apr: 54, min: 42500, dueDay: 10 }],
  strategy: { extra: 50000, scenarios: [{ name: 'Solo mínimos', months: Infinity, interest: 1, paid: 2 }, { name: 'Avalancha', months: 12, interest: 3, paid: 4 }], order: [{ name: 'Visa', month: 12 }], schedule: [{ month: 0, min: 10, ava: 10, snow: 10 }, { month: 1, min: 9, ava: 8, snow: 8 }] },
  monthly: [{ label: 'sep 2026', income: 450000, expense: 25500 }, { label: 'oct 2026', income: 0, expense: 260000 }],
  categories: [{ name: 'Comida', amount: 25500 }, { name: 'Vivienda', amount: 260000 }],
});

test('xlsx: es un ZIP válido con las partes esperadas', () => {
  const bytes = buildXlsx(sample());
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b); // "PK"
  const txt = Buffer.from(bytes).toString('latin1');
  for (const part of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet6.xml', 'xl/charts/chart1.xml', 'xl/drawings/drawing1.xml']) assert.ok(txt.includes(part), part);
  writeFileSync(process.env.XLSX_OUT || '/dev/null', bytes);
});

test('zip: CRC y estructura legibles', () => {
  const z = zip([{ name: 'a.txt', data: 'hola' }]);
  assert.equal(Buffer.from(z.slice(-22, -18)).readUInt32LE(0), 0x06054b50);
});
