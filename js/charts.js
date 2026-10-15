// Gráficas SVG sin dependencias. Siempre incluyen aria-label y se acompañan de leyenda/tabla.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** items: [{label, value, color}] */
export function donut(items, centerTop, centerBottom) {
  const total = items.reduce((a, i) => a + i.value, 0);
  if (total <= 0) return '';
  let acc = 0;
  const segs = items.map((i) => {
    const p = (i.value / total) * 100;
    const s = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${i.color}" stroke-width="5.5" stroke-dasharray="${Math.max(p - 0.6, 0.1)} ${100 - Math.max(p - 0.6, 0.1)}" stroke-dashoffset="${25 - acc}"/>`;
    acc += p;
    return s;
  });
  return `<svg class="donut" viewBox="0 0 42 42" role="img" aria-label="Distribución de gastos por categoría">
    <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--line)" stroke-width="5.5"/>
    ${segs.join('')}
    <text x="21" y="20" text-anchor="middle" class="d-top">${esc(centerTop)}</text>
    <text x="21" y="25.5" text-anchor="middle" class="d-bot">${esc(centerBottom)}</text>
  </svg>`;
}

/** rows: [{label, income, expense}] */
export function bars(rows, fmtShort) {
  const W = 320, H = 150, pad = { l: 4, r: 4, t: 14, b: 22 };
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
  const gw = (W - pad.l - pad.r) / rows.length;
  const bw = Math.min(16, gw / 3);
  const ch = H - pad.t - pad.b;
  const y = (v) => pad.t + ch - (v / max) * ch;
  const parts = rows.map((r, i) => {
    const cx = pad.l + gw * i + gw / 2;
    const h = (v) => Math.max(v > 0 ? 2 : 0, (v / max) * ch);
    return `<rect x="${cx - bw - 1}" y="${y(r.income)}" width="${bw}" height="${h(r.income)}" rx="3" fill="var(--income)"/>
      <rect x="${cx + 1}" y="${y(r.expense)}" width="${bw}" height="${h(r.expense)}" rx="3" fill="var(--expense)"/>
      <text x="${cx}" y="${H - 6}" text-anchor="middle" class="axis">${esc(r.label)}</text>`;
  });
  const desc = rows.map((r) => `${r.label}: ingresos ${fmtShort(r.income)}, gastos ${fmtShort(r.expense)}`).join('. ');
  return `<svg class="bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos y gastos por mes. ${esc(desc)}">
    <line x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + ch}" y2="${pad.t + ch}" stroke="var(--line)"/>
    ${parts.join('')}
  </svg>`;
}

/** series: [{name,color,points:number[]}]  (índice = mes). Línea simple con eje Y mínimo/máximo. */
export function lines(series, fmtShort, monthLabel = (i) => `mes ${i}`) {
  const W = 320, H = 170, pad = { l: 8, r: 8, t: 12, b: 24 };
  const n = Math.max(...series.map((s) => s.points.length));
  const max = Math.max(1, ...series.flatMap((s) => s.points));
  const x = (i) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const paths = series.map((s) => `<polyline fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" points="${s.points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>`).join('');
  const desc = series.map((s) => `${s.name}: de ${fmtShort(s.points[0])} a ${fmtShort(s.points.at(-1))}`).join('. ');
  return `<svg class="bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo de deudas por mes. ${esc(desc)}">
    <line x1="${pad.l}" x2="${W - pad.r}" y1="${H - pad.b}" y2="${H - pad.b}" stroke="var(--line)"/>
    ${paths}
    <text x="${pad.l}" y="${H - 6}" class="axis">${esc(monthLabel(0))}</text>
    <text x="${W - pad.r}" y="${H - 6}" text-anchor="end" class="axis">${esc(monthLabel(n - 1))}</text>
    <text x="${pad.l}" y="9" class="axis">${esc(fmtShort(max))}</text>
  </svg>`;
}
