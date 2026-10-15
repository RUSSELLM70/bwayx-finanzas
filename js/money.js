// Monedas: moneda base + una moneda secundaria con tipo de cambio manual.
export const CURRENCIES = { CRC: '₡ Colón (CRC)', USD: '$ Dólar (USD)', MXN: '$ Peso mexicano (MXN)', COP: '$ Peso colombiano (COP)', EUR: '€ Euro (EUR)' };
export const SYMBOLS = { CRC: '₡', USD: 'US$', MXN: 'MX$', COP: 'COL$', EUR: '€' };

/** Devuelve (monto, moneda) → monto en moneda base. altRate = unidades de base por 1 de la moneda secundaria. */
export function converter(st) {
  return (amount, cur) => (!cur || cur === st.currency ? amount : cur === st.altCurrency ? amount * st.altRate : amount);
}

/** Al cambiar la moneda base: si coincide con la secundaria se intercambian y se invierte la tasa. */
export function changeBase(st, next) {
  if (next === st.currency) return;
  if (next === st.altCurrency) { st.altCurrency = st.currency; st.altRate = st.altRate ? 1 / st.altRate : 1; }
  st.currency = next;
}
