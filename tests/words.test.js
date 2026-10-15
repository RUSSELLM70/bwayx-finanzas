import test from 'node:test';
import assert from 'node:assert/strict';
import { amountWords, intToWords } from '../js/words.js';

test('números en letras', () => {
  const c = { 1: 'uno', 15: 'quince', 21: 'veintiuno', 30: 'treinta', 31: 'treinta y uno', 100: 'cien', 101: 'ciento uno', 999: 'novecientos noventa y nueve', 1000: 'mil', 2000: 'dos mil', 21000: 'veintiún mil', 31000: 'treinta y un mil', 200000: 'doscientos mil', 1250000: 'un millón doscientos cincuenta mil', 2000000: 'dos millones', 21000000: 'veintiún millones', 1000001: 'un millón uno', 999999999999: 'novecientos noventa y nueve mil novecientos noventa y nueve millones novecientos noventa y nueve mil novecientos noventa y nueve' };
  for (const [n, w] of Object.entries(c)) assert.equal(intToWords(+n), w, n);
});

test('con moneda: singular/plural, apócope, "de" y centavos', () => {
  assert.equal(amountWords(200000, 'CRC'), 'doscientos mil colones');
  assert.equal(amountWords(1, 'CRC'), 'un colón');
  assert.equal(amountWords(21, 'USD'), 'veintiún dólares');
  assert.equal(amountWords(1000000, 'CRC'), 'un millón de colones');
  assert.equal(amountWords(2000000, 'EUR'), 'dos millones de euros');
  assert.equal(amountWords(1250.5, 'USD'), 'mil doscientos cincuenta dólares con 50/100');
  assert.equal(amountWords(0.99, 'USD'), 'cero dólares con 99/100'.replace('cero dólares', 'cero dólares'));
  assert.equal(amountWords(10.999, 'USD'), 'once dólares');
});

test('entradas inválidas no muestran nada', () => {
  for (const v of [0, -5, NaN, Infinity, 1e12]) assert.equal(amountWords(v, 'CRC'), '');
});
