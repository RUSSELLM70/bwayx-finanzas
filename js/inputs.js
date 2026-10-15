// Validación y formato de campos. Convención es-CR: "." separa miles y "," separa decimales (1.250.000,50).
// Tipos (atributo data-n): money (2 dec) · pct (2 dec) · rate (6 dec) · int (solo dígitos) · text (alfanumérico).
const DEC = { money: 2, pct: 2, rate: 6 };
const MAX_INT_DIGITS = 12;
const TEXT_BAD = /[^\p{L}\p{N} .,\-_/&()#+']/gu; // letras (con tildes/ñ), números, espacio y puntuación básica

export const cleanText = (s, max = 120) => String(s ?? '').replace(TEXT_BAD, '').replace(/\s+/g, ' ').slice(0, max).trim();

const group = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Número → texto con formato (sin ceros finales). fmtNum(1250000) = "1.250.000"; fmtNum(0.5) = "0,5". */
export function fmtNum(n, maxDec = 2) {
  if (n === '' || n == null || !Number.isFinite(+n)) return '';
  const [i, d = ''] = (+n).toFixed(maxDec).split('.');
  const dec = d.replace(/0+$/, '');
  return `${i.startsWith('-') ? '-' : ''}${group(i.replace('-', ''))}${dec ? ',' + dec : ''}`;
}

/** Texto formateado → número (NaN si vacío). "1.250,50" → 1250.5 */
export function parseNum(s) {
  const t = String(s ?? '').trim().replace(/\s/g, '');
  return t ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : NaN;
}

/** Normaliza el texto de un campo según su tipo. `paste`: un único "." con 1-2 decimales se interpreta como decimal. */
export function normalize(raw, kind, paste = false) {
  if (kind === 'text') return raw.replace(TEXT_BAD, '').replace(/\s{2,}/g, ' ');
  if (kind === 'int') return raw.replace(/\D/g, '');
  const maxDec = DEC[kind];
  let s = raw.replace(/\s/g, '');
  if (paste && !s.includes(',')) {
    const parts = s.split('.');
    if (parts.length === 2 && parts[1].length > 0 && (parts[1].length !== 3 || /^0*$/.test(parts[0]))) s = parts[0] + ',' + parts[1];
  }
  const comma = s.indexOf(',');
  let int = (comma >= 0 ? s.slice(0, comma) : s).replace(/\D/g, '');
  let dec = comma >= 0 ? s.slice(comma + 1).replace(/\D/g, '').slice(0, maxDec) : null;
  int = int.replace(/^0+(?=\d)/, '').slice(0, MAX_INT_DIGITS);
  if (!int && dec !== null) int = '0';
  return group(int) + (dec !== null ? ',' + dec : '');
}

/** Aplica normalize a un <input> conservando la posición del cursor. */
export function sanitizeInput(el, kind, inputType = '') {
  const before = el.value;
  const after = normalize(before, kind, inputType === 'insertFromPaste');
  if (after === before) return false;
  const caret = el.selectionStart ?? before.length;
  const sig = (str) => str.replace(/[. ]/g, '').length; // caracteres significativos
  const target = sig(before.slice(0, caret));
  el.value = after;
  let pos = 0, seen = 0;
  while (pos < after.length && seen < target) { if (after[pos] !== '.') seen++; pos++; }
  el.setSelectionRange?.(pos, pos);
  return true;
}
