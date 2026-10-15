// Diálogos propios (reemplazan confirm/alert del navegador). `await ask({...})` → true si confirma.
import { $, esc, icon } from './ctx.js';

let current = null;
const TONES = { default: 'info', warn: 'alert', danger: 'trash' };

/** ask({title, message, confirm, cancel, tone: 'default'|'warn'|'danger'}). Con `cancel: null` es un aviso de un solo botón. */
export function ask({ title, message = '', confirm = 'Aceptar', cancel = 'Cancelar', tone = 'default' } = {}) {
  const root = $('#dialog');
  if (current) current.finish(false); // un solo diálogo a la vez
  const prev = document.activeElement;
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    root.hidden = false;
    root.innerHTML = `<div class="dlg ${tone}" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t"${message ? ' aria-describedby="dlg-m"' : ''}>
      <div class="dlg-ico">${icon(TONES[tone] || 'info', 26)}</div>
      <h2 id="dlg-t" class="dlg-title">${esc(title)}</h2>
      ${message ? `<p id="dlg-m" class="dlg-msg">${esc(message)}</p>` : ''}
      <div class="dlg-actions">${cancel ? `<button type="button" class="dlg-btn ghost" data-dlg="cancel">${esc(cancel)}</button>` : ''}<button type="button" class="dlg-btn ${tone === 'danger' ? 'danger' : 'primary'}" data-dlg="ok">${esc(confirm)}</button></div></div>`;
    current = {
      id, hasCancel: !!cancel,
      finish(v) {
        if (!current || current.id !== id) return;
        current = null; root.hidden = true; root.innerHTML = '';
        prev?.focus?.();
        resolve(v);
      },
    };
    // En acciones destructivas el foco inicial va a "Cancelar" (evita confirmar sin querer con Enter)
    root.querySelector?.(`[data-dlg="${tone === 'danger' && cancel ? 'cancel' : 'ok'}"]`)?.focus();
  });
}
export const inform = (title, message, confirm = 'Entendido') => ask({ title, message, confirm, cancel: null });
export const dialogOpen = () => current !== null;

document.addEventListener('click', (e) => {
  if (!current) return;
  const v = e.target.closest?.('[data-dlg]')?.dataset?.dlg;
  if (v) current.finish(v === 'ok');
  else if (e.target.id === 'dialog') current.finish(false); // toque en el fondo = cancelar
});
// Captura: mientras hay un diálogo abierto, el teclado es solo suyo
document.addEventListener('keydown', (e) => {
  if (!current) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); current.finish(!current.hasCancel); return; }
  if (e.key === 'Tab') {
    e.stopImmediatePropagation();
    const f = [...($('#dialog').querySelectorAll?.('button') || [])];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}, true);
