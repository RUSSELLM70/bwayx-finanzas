import test from 'node:test';
import assert from 'node:assert/strict';

// IndexedDB mínimo en memoria (sobrevive aunque localStorage se vacíe, como en el navegador)
const store = new Map();
globalThis.indexedDB = {
  open() {
    const req = { result: { createObjectStore() {}, close() {}, transaction() {
      const t = { objectStore: () => ({
        put: (v, k) => { store.set(k, v); const r = {}; queueMicrotask(() => t.oncomplete()); return r; },
        get: (k) => { const r = { result: store.get(k) }; queueMicrotask(() => t.oncomplete()); return r; },
        delete: (k) => { store.delete(k); const r = {}; queueMicrotask(() => t.oncomplete()); return r; },
      }) };
      return t;
    } } };
    queueMicrotask(() => { req.onupgradeneeded?.(); req.onsuccess(); });
    return req;
  },
};
globalThis.localStorage = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = String(v); }, removeItem(k) { delete this.d[k]; }, clear() { this.d = {}; } };

const { mirrorNow, restoreIfEmpty, clearMirror } = await import('../js/mirror.js');
const vault = await import('../js/vault.js');

test('el navegador vacía localStorage → los datos vuelven desde el espejo', async () => {
  localStorage.setItem('finanzasos:v1', JSON.stringify({ txs: [{ id: 'x', note: 'mis datos' }] }));
  await mirrorNow();
  localStorage.clear();
  assert.equal(localStorage.getItem('finanzasos:v1'), null);
  assert.equal(await restoreIfEmpty(), true);
  assert.equal(JSON.parse(localStorage.getItem('finanzasos:v1')).txs[0].note, 'mis datos');
});

test('no pisa datos existentes', async () => {
  localStorage.setItem('finanzasos:v1', '{"txs":[]}');
  assert.equal(await restoreIfEmpty(), false);
  assert.equal(localStorage.getItem('finanzasos:v1'), '{"txs":[]}');
});

test('con PIN se espeja lo cifrado, nunca texto plano, y se restaura igual', async () => {
  localStorage.clear(); await clearMirror();
  await vault.enable('4821', { txs: [{ note: 'SECRETO' }] }, 'finanzasos:v1');
  await mirrorNow();
  assert.ok(!JSON.stringify([...store.values()]).includes('SECRETO'));
  localStorage.clear(); vault.reset();
  assert.equal(await restoreIfEmpty(), true);
  assert.equal((await vault.unlock('4821')).txs[0].note, 'SECRETO');
});

test('"Borrar todo" también limpia el espejo (no resucita datos)', async () => {
  localStorage.setItem('finanzasos:v1', '{"txs":[1]}'); await mirrorNow();
  await clearMirror(); localStorage.clear();
  assert.equal(await restoreIfEmpty(), false);
});

test('sin IndexedDB (modo privado/antiguo) no rompe nada', async () => {
  const saved = globalThis.indexedDB; delete globalThis.indexedDB;
  localStorage.setItem('finanzasos:v1', '{}');
  await mirrorNow(); assert.equal(await restoreIfEmpty(), false);
  globalThis.indexedDB = saved;
});

// ---- blindaje: corrupción, historial, guardia contra vacío ----
const KEY = 'finanzasos:v1';
const data = (n) => JSON.stringify({ txs: Array.from({ length: n }, (_, i) => ({ id: String(i) })), debts: [], goals: [], fixed: [] });
const reset = async () => { localStorage.clear(); await clearMirror(); };
const { listHistory, applyEntry, status } = await import('../js/mirror.js');
const { save, load } = await import('../js/store.js');

test('dato dañado: se conserva copia del dañado y se restaura la última versión buena', async () => {
  await reset();
  localStorage.setItem(KEY, data(3)); await mirrorNow();
  localStorage.setItem(KEY, '{"txs":[{"id":"1","amount":5'); // escritura cortada
  assert.equal(await restoreIfEmpty(), true);
  assert.equal(JSON.parse(localStorage.getItem(KEY)).txs.length, 3);
  assert.ok(Object.keys(localStorage.d).some((k) => k.startsWith('finanzasos:corrupt:')), 'copia del dato dañado conservada');
  assert.equal(status.corrupt, true);
});

test('un estado vacío no pisa una copia con datos', async () => {
  await reset();
  localStorage.setItem(KEY, data(4)); await mirrorNow();
  localStorage.setItem(KEY, data(0)); await mirrorNow();
  localStorage.clear();
  assert.equal(await restoreIfEmpty(), true);
  assert.equal(JSON.parse(localStorage.getItem(KEY)).txs.length, 4);
});

test('no espeja datos dañados', async () => {
  await reset();
  localStorage.setItem(KEY, data(2)); await mirrorNow();
  localStorage.setItem(KEY, '{roto'); await mirrorNow();
  localStorage.clear();
  await restoreIfEmpty();
  assert.equal(JSON.parse(localStorage.getItem(KEY)).txs.length, 2);
});

test('historial: guarda versiones y permite volver a una anterior', async () => {
  await reset();
  localStorage.setItem(KEY, data(1)); await mirrorNow(true);
  localStorage.setItem(KEY, data(2)); await mirrorNow(true);
  localStorage.setItem(KEY, data(5)); await mirrorNow(true);
  const h = await listHistory();
  assert.deepEqual(h.map((e) => JSON.parse(e.plain).txs.length), [5, 2, 1]); // más nueva primero
  applyEntry(h[2]);
  assert.equal(JSON.parse(localStorage.getItem(KEY)).txs.length, 1);
});

test('el historial no se llena con copias idénticas ni crece sin límite', async () => {
  await reset();
  localStorage.setItem(KEY, data(1));
  for (let i = 0; i < 5; i++) await mirrorNow(true);
  assert.equal((await listHistory()).length, 1);
  for (let i = 2; i < 40; i++) { localStorage.setItem(KEY, data(i)); await mirrorNow(true); }
  assert.ok((await listHistory()).length <= 14 + 12);
});

test('guardado verificado: save() confirma lectura y añade versión de esquema', () => {
  localStorage.clear();
  assert.equal(save(load()), true);
  assert.equal(JSON.parse(localStorage.getItem(KEY)).schema, 1);
  const real = localStorage.setItem.bind(localStorage);
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(save(load()), false);
  localStorage.setItem = real;
  localStorage.setItem = (k, v) => real(k, String(v).slice(0, 10)); // escritura truncada
  assert.equal(save(load()), false);
  localStorage.setItem = real;
});
