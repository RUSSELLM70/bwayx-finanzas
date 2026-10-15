// Cifrado opcional en el dispositivo: PIN → PBKDF2 (250k) → AES-256-GCM. Sin servidor; el PIN nunca se guarda.
export const ENC = 'finanzasos:enc';
const b64 = (u) => btoa(String.fromCharCode(...u));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let key = null, salt = null;

export const hasVault = () => !!localStorage.getItem(ENC);
export const vaultActive = () => key !== null;

async function derive(pin, s) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: s, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
  return JSON.stringify({ v: 1, salt: b64(salt), iv: b64(iv), data: b64(ct) });
}
/** Descifra con el PIN; lanza si es incorrecto. Deja la clave en memoria. */
export async function unlock(pin) {
  const { salt: s, iv, data } = JSON.parse(localStorage.getItem(ENC));
  const k = await derive(pin, unb64(s));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, k, unb64(data));
  key = k; salt = unb64(s);
  return JSON.parse(new TextDecoder().decode(plain));
}
/** Activa el PIN: cifra el estado y elimina la copia en texto plano. */
export async function enable(pin, state, plainKey) {
  salt = crypto.getRandomValues(new Uint8Array(16));
  key = await derive(pin, salt);
  localStorage.setItem(ENC, await seal(state));
  localStorage.removeItem(plainKey);
}
export async function write(state) { localStorage.setItem(ENC, await seal(state)); }
/** Quita el PIN: guarda en texto plano y borra la copia cifrada. */
export function disable(state, plainKey) {
  localStorage.setItem(plainKey, JSON.stringify(state));
  localStorage.removeItem(ENC);
  key = null; salt = null;
}
export function reset() { key = null; salt = null; }
