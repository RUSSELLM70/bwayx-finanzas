// Copia espejo en IndexedDB + historial de versiones. Si el navegador vacía localStorage, o el dato se daña,
// la app recupera la última versión buena. Se espeja el texto tal cual (en claro o ya cifrado con PIN).
import { KEY } from './store.js';
import { ENC } from './vault.js';

const DB = 'finanzasos-mirror', STORE = 'kv', SNAP = 'snapshot', HIST = 'history';
const MIN_GAP = 10 * 60 * 1000, KEEP_RECENT = 12, KEEP_DAYS = 14;
export const status = { restored: false, corrupt: false };

const openDb = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function run(mode, fn) {
  if (typeof indexedDB === 'undefined') return undefined;
  try {
    const db = await openDb();
    return await new Promise((res, rej) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => { db.close?.(); res(req?.result); };
      t.onerror = t.onabort = () => rej(t.error);
    });
  } catch { return undefined; }
}

const parses = (s) => { try { JSON.parse(s); return true; } catch { return false; } };
const hasData = (plain) => { try { const o = JSON.parse(plain); return !!(o.txs?.length || o.debts?.length || o.goals?.length || o.fixed?.length); } catch { return false; } };
const usable = (e) => e && (e.enc != null || (e.plain != null && parses(e.plain)));
const day = (t) => new Date(t).toDateString();
const same = (a, b) => a && b && a.plain === b.plain && a.enc === b.enc;

function prune(hist) {
  const out = hist.slice(0, KEEP_RECENT);
  const days = new Set(out.map((h) => day(h.t)));
  for (const h of hist.slice(KEEP_RECENT)) {
    if (!days.has(day(h.t)) && Date.now() - h.t < KEEP_DAYS * 864e5) { out.push(h); days.add(day(h.t)); }
  }
  return out;
}

/** Guarda la copia espejo y, cada ≥10 min o con `force`, una versión en el historial. */
export async function mirrorNow(force = false) {
  const plain = localStorage.getItem(KEY), enc = localStorage.getItem(ENC);
  if (plain == null && enc == null) return;
  if (enc == null && !parses(plain)) return; // nunca espejar un dato dañado
  const prev = await run('readonly', (s) => s.get(SNAP));
  // No pisar una copia con datos por un estado vacío (p. ej. arranque tras un fallo)
  if (!force && enc == null && !hasData(plain) && prev && (prev.enc != null || hasData(prev.plain))) return;
  const snap = { plain, enc, t: Date.now() };
  await run('readwrite', (s) => s.put(snap, SNAP));
  const hist = (await run('readonly', (s) => s.get(HIST))) || [];
  if (force || !hist.length || (snap.t - hist[0].t >= MIN_GAP && !same(hist[0], snap))) {
    if (!same(hist[0], snap)) await run('readwrite', (s) => s.put(prune([snap, ...hist]), HIST));
  }
}

/** Restaura si localStorage está vacío o el dato está dañado. Devuelve true si repuso algo. */
export async function restoreIfEmpty() {
  const plain = localStorage.getItem(KEY), enc = localStorage.getItem(ENC);
  const broken = enc == null && plain != null && !parses(plain);
  if (!broken && (plain != null || enc != null)) return false;
  if (broken) {
    status.corrupt = true;
    try { localStorage.setItem(`finanzasos:corrupt:${Date.now()}`, plain); } catch { /* sin espacio: seguimos */ }
    localStorage.removeItem(KEY);
  }
  const snap = await run('readonly', (s) => s.get(SNAP));
  const hist = (await run('readonly', (s) => s.get(HIST))) || [];
  const pick = [snap, ...hist].find(usable);
  if (!pick) return false;
  applyEntry(pick);
  status.restored = true;
  return true;
}

export const listHistory = async () => (await run('readonly', (s) => s.get(HIST))) || [];
export function applyEntry(e) {
  if (e.plain != null) localStorage.setItem(KEY, e.plain); else localStorage.removeItem(KEY);
  if (e.enc != null) localStorage.setItem(ENC, e.enc); else localStorage.removeItem(ENC);
}
export const clearMirror = async () => { for (const k of [SNAP, HIST, 'agenda', 'notified']) await run('readwrite', (s) => s.delete(k)); };

// Almacén genérico clave-valor (lo comparten la app y el service worker: agenda de avisos y avisos ya enviados)
export const getKV = (k) => run('readonly', (s) => s.get(k));
export const setKV = (k, v) => run('readwrite', (s) => s.put(v, k));
export const delKV = (k) => run('readwrite', (s) => s.delete(k));
