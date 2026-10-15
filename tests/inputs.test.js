import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { normalize, fmtNum, parseNum, sanitizeInput, cleanText } from '../js/inputs.js';
import { sanitizeImport } from '../js/store.js';

test('montos: separador de miles con "." y decimales con ","', () => {
  assert.equal(normalize('1250000', 'money'), '1.250.000');
  assert.equal(normalize('999', 'money'), '999');
  assert.equal(normalize('1000', 'money'), '1.000');
  assert.equal(normalize('1.250.000,5', 'money'), '1.250.000,5');
  assert.equal(normalize('12,345', 'money'), '12,34'); // máx. 2 decimales
  assert.equal(normalize(',5', 'money'), '0,5');
  assert.equal(normalize('0005', 'money'), '5');
  assert.equal(normalize('12a3-4$', 'money'), '1.234'); // letras y símbolos fuera
  assert.equal(normalize('1,2,3', 'money'), '1,23'); // una sola coma
  assert.equal(normalize('1234567890123456', 'money').replace(/\./g, '').length, 12); // tope de dígitos
});

test('pegado: "1234.50" es decimal, "1.234" son miles', () => {
  assert.equal(normalize('1234.50', 'money', true), '1.234,50');
  assert.equal(normalize('1.234', 'money', true), '1.234');
  assert.equal(normalize('1.250.000', 'money', true), '1.250.000');
  assert.equal(normalize('0.0019', 'rate', true), '0,0019');
});

test('borrar un dígito no cambia el significado (sin heurística al teclear)', () => {
  assert.equal(normalize('1.23', 'money', false), '123');
});

test('enteros y texto', () => {
  assert.equal(normalize('12a,3', 'int'), '123');
  assert.equal(normalize('Súper <b>"Ñandú"</b> #5 & más', 'text'), 'Súper bÑandú/b #5 & más');
  assert.equal(cleanText('  Hola   <script>alert(1)</script>  '), 'Hola scriptalert(1)/script');
  assert.equal(normalize('a;b=c{d}', 'text'), 'abcd');
});

test('formato y lectura son inversos', () => {
  for (const n of [0, 5, 999, 1000, 45000, 1250000.5, 0.5]) assert.equal(parseNum(fmtNum(n)), n);
  assert.equal(fmtNum(1250000), '1.250.000');
  assert.equal(fmtNum(0.0019, 6), '0,0019');
  assert.equal(fmtNum(''), '');
  assert.ok(Number.isNaN(parseNum('')));
});

test('cursor: se conserva tras insertar el separador', () => {
  const el = { value: '1234', selectionStart: 4, setSelectionRange(a) { this.pos = a; } };
  sanitizeInput(el, 'money', 'insertText');
  assert.equal(el.value, '1.234'); assert.equal(el.pos, 5);
  const mid = { value: '1.2534', selectionStart: 4, setSelectionRange(a) { this.pos = a; } }; // insertó "5" tras "1.2" en "1.234"
  sanitizeInput(mid, 'money', 'insertText');
  assert.equal(mid.value, '12.534'); assert.equal(mid.pos, 4); // el cursor queda justo después del "5"
  const del = { value: '1.23', selectionStart: 4, setSelectionRange(a) { this.pos = a; } }; // borró el último dígito de "1.234"
  sanitizeInput(del, 'money', 'deleteContentBackward');
  assert.equal(del.value, '123'); assert.equal(del.pos, 3);
});

test('importación limpia textos peligrosos', () => {
  const o = sanitizeImport({ txs: [{ type: 'expense', amount: 5, date: '2026-01-01', category: 'Co<mi>da', note: '<img src=x onerror=alert(1)>' }] });
  assert.ok(!/[<>=]/.test(o.txs[0].note + o.txs[0].category));
});

test('AUDITORÍA: todo <input> editable declara su tipo (data-n) o es de un tipo nativo seguro', () => {
  const bad = [];
  for (const f of readdirSync('js').filter((x) => x.endsWith('.js') && x !== 'inputs.js')) {
    for (const m of readFileSync('js/' + f, 'utf8').matchAll(/<input\b[^>]*>/g)) {
      const tag = m[0];
      if (/type="(date|hidden|file)"/.test(tag) || /data-n="(money|pct|rate|int|text)"/.test(tag)) continue;
      bad.push(`${f}: ${tag.slice(0, 80)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('AUDITORÍA: los campos numéricos tienen teclado numérico y los de texto no', () => {
  const bad = [];
  for (const f of readdirSync('js').filter((x) => x.endsWith('.js'))) {
    for (const m of readFileSync('js/' + f, 'utf8').matchAll(/<input\b[^>]*data-n="(money|pct|rate|int)"[^>]*>/g)) if (!/inputmode="(decimal|numeric)"/.test(m[0])) bad.push(`${f}: ${m[0].slice(0, 70)}`);
  }
  assert.deepEqual(bad, []);
});
