// Notificaciones locales (sin servidor). La app deja una agenda en IndexedDB y el service worker la dispara:
// con periodicsync (Chrome/Android instalada) y cada vez que la app pasa a segundo plano.
import { getKV, setKV, delKV } from './mirror.js';
import { buildAgenda, recentTipHashes } from './alerts.js';
import { alertContext } from './derive.js';
import { security, fmt, notifySettings } from './ctx.js';

const PERIODIC = 'finanzasos-agenda';
export const supported = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
export const permission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
const ready = () => navigator.serviceWorker.ready;

export async function enable() {
  if (!supported()) return 'unsupported';
  const p = await Notification.requestPermission();
  if (p === 'granted') { try { const r = await ready(); if ('periodicSync' in r) await r.periodicSync.register(PERIODIC, { minInterval: 12 * 36e5 }); } catch { /* opcional */ } }
  return p;
}
export async function disable() {
  try { const r = await ready(); await r.periodicSync?.unregister?.(PERIODIC); } catch { /* ya no estaba */ }
  await delKV('agenda');
}
export async function showNow(title, body, view = 'home') {
  const r = await ready();
  await r.showNotification(title, { body, tag: 'finanzasos-test', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { view } });
}

/** Recalcula la agenda con los datos actuales y avisa al service worker. Con PIN, los textos son genéricos. */
export async function refreshAgenda({ poke = false } = {}) {
  const n = notifySettings();
  if (!n.on || permission() !== 'granted') return;
  const now = Date.now();
  const notified = (await getKV('notified')) || {};
  const ctx = alertContext();
  const items = buildAgenda({ ...ctx, nowMs: now, lead: n.lead, tipsOn: n.tips, generic: security.active(), fmt, skipHashes: recentTipHashes(notified, now) });
  await setKV('agenda', { items, built: now });
  if (poke) (await ready()).active?.postMessage('agenda-check');
}
let timer;
export const scheduleRefresh = () => { clearTimeout(timer); timer = setTimeout(() => refreshAgenda().catch(() => {}), 800); };
