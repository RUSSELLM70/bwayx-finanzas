import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { d: {}, getItem(k) { return this.d[k] ?? null; }, setItem(k, v) { this.d[k] = String(v); }, removeItem(k) { delete this.d[k]; }, clear() { this.d = {}; } };
const vault = await import('../js/vault.js');
const KEY = 'finanzasos:v1';

test('PIN: cifra, no deja texto plano, exige PIN correcto y se puede quitar', async () => {
  const state = { txs: [{ id: 'a', note: 'SECRETO-Visa-12345', amount: 10 }], settings: {} };
  localStorage.setItem(KEY, JSON.stringify(state));
  assert.equal(vault.hasVault(), false);

  await vault.enable('4821', state, KEY);
  assert.ok(vault.hasVault() && vault.vaultActive());
  assert.equal(localStorage.getItem(KEY), null, 'se borró la copia en texto plano');
  assert.ok(!localStorage.getItem('finanzasos:enc').includes('SECRETO'), 'el contenido guardado está cifrado');

  state.txs.push({ id: 'b', note: 'nuevo', amount: 5 });
  await vault.write(state);

  vault.reset(); // simula cerrar y reabrir la app
  assert.equal(vault.vaultActive(), false);
  await assert.rejects(() => vault.unlock('0000'), 'PIN incorrecto falla');
  const back = await vault.unlock('4821');
  assert.equal(back.txs.length, 2);
  assert.equal(back.txs[0].note, 'SECRETO-Visa-12345');

  vault.disable(back, KEY);
  assert.equal(vault.hasVault(), false);
  assert.equal(JSON.parse(localStorage.getItem(KEY)).txs.length, 2);
});

test('cifrados distintos por escritura (IV aleatorio)', async () => {
  await vault.enable('1234', { txs: [] }, KEY);
  const a = localStorage.getItem('finanzasos:enc');
  await vault.write({ txs: [] });
  assert.notEqual(a, localStorage.getItem('finanzasos:enc'));
});
