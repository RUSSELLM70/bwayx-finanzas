// Contexto compartido: estado, helpers de formato, iconos y utilidades de UI.
import { today, iso } from './dates.js';
import { EXPENSE_CATS } from './advice.js';
import { load, save, KEY } from './store.js';
import * as vault from './vault.js';
import { amountWords } from './words.js';
import * as mirror from './mirror.js';
import { converter, SYMBOLS } from './money.js';

// Pantalla de bloqueo: si hay PIN, se pide antes de cargar los datos (cifrados en este dispositivo).
async function openState() {
  await mirror.restoreIfEmpty(); // recupera desde la copia espejo si el navegador vació localStorage
  if (!vault.hasVault()) return load();
  const main = document.querySelector('#main');
  document.querySelector('#fab').hidden = true;
  return new Promise((resolve) => {
    const show = (msg = '') => {
      main.innerHTML = `<div class="page lock"><h1 class="h1">BWAY X - Finanzas</h1><p class="muted">Tus datos están cifrados en este dispositivo. Ingresa tu PIN.</p>
        <form id="lockform"><div class="field"><label for="pin">PIN</label><input id="pin" data-n="int" class="input amount num" type="password" inputmode="numeric" autocomplete="off"></div>
        <p class="error" role="alert">${msg}</p><button class="btn block" type="submit">Desbloquear</button></form></div>`;
      const f = document.querySelector('#lockform');
      document.querySelector('#pin').focus();
      document.querySelector('#pin').addEventListener('input', (e) => sanitizeInput(e.target, 'int'));
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        try { resolve(load(await vault.unlock(document.querySelector('#pin').value))); }
        catch { show('PIN incorrecto.'); }
      });
    };
    show();
  });
}
export const state = await openState();
export const ui = { view: 'home', kind: 'fortnight', anchor: today(), filter: 'all', q: '', step: 1, ifreq: 'fortnight', method: null };
export const $ = (s) => document.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const persist = () => {
  if (vault.vaultActive()) vault.write(state).then(mirror.mirrorNow).catch(() => toast('No se pudo guardar. Exporta una copia de seguridad.'));
  else if (!save(state)) toast('No se pudo guardar: almacenamiento lleno o bloqueado. Exporta una copia.');
  else mirror.mirrorNow();
};

// Salud del almacenamiento: ¿instalada como app? ¿el navegador prometió no borrar los datos?
const ua = globalThis.navigator?.userAgent || '';
export const health = {
  installed: (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || globalThis.navigator?.standalone === true,
  persisted: null,
  ios: /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && globalThis.navigator?.maxTouchPoints > 1),
  iosOtherBrowser: /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua), // en iPhone solo Safari puede instalar
  browser: typeof matchMedia === 'function',
  android: /android/i.test(ua),
  prompt: null,
};
globalThis.navigator?.storage?.persisted?.().then((p) => { health.persisted = p; }).catch(() => {});
/** ¿Toca mostrar el aviso de instalar? No si ya está instalada, si pidió no verlo más o si lo pospuso. */
export function installDue(settings, h, todayIso = today()) {
  if (h.installed || settings.hideInstall) return false;
  return !settings.installSnooze || todayIso >= settings.installSnooze;
}
export const snoozeDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
export const notifySettings = () => ({ on: false, lead: 2, tips: true, ...(state.settings.notify || {}) });
export const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(iso + 'T00:00:00').getTime()) / 86400000) : Infinity);
export const markBackup = () => { state.settings.lastBackup = today(); persist(); };
export const security = {
  async enablePin(pin) { await vault.enable(pin, state, KEY); mirror.mirrorNow(); },
  disablePin() { vault.disable(state, KEY); mirror.mirrorNow(); },
  active: () => vault.vaultActive(),
  reset: () => { vault.reset(); mirror.clearMirror(); },
};
export const round2 = (n) => Math.round(n * 100) / 100;
export { parseNum } from './inputs.js';
import { parseNum, sanitizeInput } from './inputs.js';
export const sortTx = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
export const conv = (a, c) => converter(state.settings)(a, c);

// render() se registra desde app.js para evitar imports circulares
let _render = () => {};
export const setRender = (f) => { _render = f; };
export const render = () => _render();

// ---------- Formato ----------
const zeroDec = (c) => c === 'CRC' || c === 'COP';
export const fmtC = (n, cur) => new Intl.NumberFormat('es', { style: 'currency', currency: cur, maximumFractionDigits: zeroDec(cur) ? 0 : 2 }).format(n);
export const fmt = (n) => fmtC(n, state.settings.currency);
export const fmtShort = (n) => new Intl.NumberFormat('es', { style: 'currency', currency: state.settings.currency, notation: 'compact', maximumFractionDigits: 1 }).format(n);
export const symbol = () => SYMBOLS[state.settings.currency] || state.settings.currency;

// ---------- Iconos (trazos 24x24 estilo Lucide) ----------
export const P = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  bulb: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2.3h6c0-1.1.4-1.8 1-2.3A7 7 0 0 0 12 2z',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  left: 'M15 18l-6-6 6-6', right: 'M9 18l6-6-6-6',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M19 12l-7 7-7-7',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  check: 'M20 6L9 17l-5-5',
  checkc: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4L12 14l-3-3',
  info: 'M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  card: 'M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM2 10h20M6 15h4',
  piggy: 'M19 10a7 7 0 0 0-13.5-2.5H4a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h1a7 7 0 0 0 2 3v2h3v-1h4v1h3v-2.5A7 7 0 0 0 22 12h-1M15.5 10.5h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  share: 'M12 15V3M8 7l4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8',
  addsq: 'M4 4h16v16H4zM12 8v8M8 12h8',
  phone: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2',
  plus: 'M12 5v14M5 12h14',
  table: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18',
  swap: 'M7 16V4M3 8l4-4 4 4M17 8v12M13 16l4 4 4-4',
};
export const icon = (n, size = 20) => `<svg viewBox="0 0 24 24" aria-hidden="true" width="${size}" height="${size}"><path d="${P[n]}"/></svg>`;
export const PALETTE = ['#3b82f6', '#22c55e', '#f59e0b', '#a78bfa', '#f87171', '#06b6d4', '#ec4899', '#84cc16', '#fb923c', '#14b8a6', '#eab308', '#94a3b8'];
export const catColor = (c) => PALETTE[Math.max(0, EXPENSE_CATS.indexOf(c)) % PALETTE.length];

// ---------- Moneda en formularios ----------
const curOptions = (sel) => [state.settings.currency, state.settings.altCurrency].filter((c, i, a) => c && a.indexOf(c) === i)
  .map((c) => `<option value="${c}" ${c === sel ? 'selected' : ''}>${c}</option>`).join('');
export const curField = (id, sel) => `<select id="${id}" class="input cur" aria-label="Moneda">${curOptions(sel || state.settings.currency)}</select>`;
export const prevLine = (amtId, curId) => `<p class="muted prev" data-prev="${amtId},${curId}" aria-live="polite"></p>`;
/** Monta (una vez) y actualiza la línea con el monto en letras arriba de cada campo de dinero. */
function updateWords() {
  document.querySelectorAll?.('input[data-n="money"]').forEach((el) => {
    if (el.closest('.budget-row')) return; // dentro de la cuadrícula de presupuestos no cabe una línea extra
    const box = el.closest('.amtrow') || el;
    let w = box.previousElementSibling;
    if (!w?.classList?.contains('words')) {
      w = document.createElement('p');
      w.className = 'words';
      box.parentNode.insertBefore(w, box);
    }
    const cur = el.dataset.cur || el.closest('.amtrow')?.querySelector('select')?.value || (el.id.startsWith('d-') ? $('#d-cur')?.value : null) || state.settings.currency;
    w.textContent = amountWords(parseNum(el.value), cur);
  });
}
export function updatePreviews() {
  updateWords();
  document.querySelectorAll?.('[data-prev]').forEach((el) => {
    const [a, c] = el.dataset.prev.split(',');
    const val = parseNum($('#' + a)?.value);
    const cur = $('#' + c)?.value;
    el.textContent = val > 0 && cur && cur !== state.settings.currency ? `≈ ${fmt(conv(val, cur))} (tipo de cambio ${state.settings.altRate})` : '';
  });
}
/** {amount (base), orig?} a partir de un monto en `cur`. */
export function mkAmount(n, cur) {
  const base = state.settings.currency;
  if (!cur || cur === base) return { amount: round2(n) };
  return { amount: round2(conv(n, cur)), orig: { amount: round2(n), currency: cur, rate: state.settings.altRate } };
}

let toastT;
export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 2400);
}
