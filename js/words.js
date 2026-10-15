// Monto en letras (español). 200000 → "doscientos mil"; con moneda: "doscientos mil colones".
const U = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const T = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const H = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
const NOUN = { CRC: ['colón', 'colones'], USD: ['dólar', 'dólares'], MXN: ['peso mexicano', 'pesos mexicanos'], COP: ['peso colombiano', 'pesos colombianos'], EUR: ['euro', 'euros'] };

const apocope = (s) => s.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un'); // "un mil", "veintiún mil"

function below1000(n) {
  if (n === 100) return 'cien';
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 30 ? (r ? U[r] : '') : `${T[Math.floor(r / 10)]}${r % 10 ? ' y ' + U[r % 10] : ''}`;
  return [H[h], rest].filter(Boolean).join(' ');
}
function below1e6(n) {
  const th = Math.floor(n / 1000), r = n % 1000;
  const a = th === 0 ? '' : th === 1 ? 'mil' : `${apocope(below1000(th))} mil`;
  return [a, r ? below1000(r) : ''].filter(Boolean).join(' ');
}
/** Entero ≥ 0 (hasta 999.999.999.999) → texto. */
export function intToWords(n) {
  if (n === 0) return 'cero';
  if (n >= 1e6) {
    const m = Math.floor(n / 1e6), rest = n % 1e6;
    const head = m === 1 ? 'un millón' : `${apocope(intToWords(m))} millones`;
    return rest ? `${head} ${below1e6(rest)}` : head;
  }
  return below1e6(n);
}

/** amountWords(1250.5, 'CRC') → "mil doscientos cincuenta colones con 50/100". Cadena vacía si no hay monto válido. */
export function amountWords(value, cur) {
  if (!Number.isFinite(value) || value <= 0 || value >= 1e12) return '';
  const cents = Math.round((value % 1) * 100);
  const whole = cents === 100 ? Math.floor(value) + 1 : Math.floor(value);
  const c = cents === 100 ? 0 : cents;
  if (whole === 0 && c === 0) return '';
  const noun = NOUN[cur];
  let text = apocope(intToWords(whole));
  if (noun) {
    if (whole >= 1e6 && whole % 1e6 === 0) text += ' de';
    text += ` ${whole === 1 ? noun[0] : noun[1]}`;
  }
  return c ? `${text} con ${String(c).padStart(2, '0')}/100` : text;
}
