// Generador .xlsx sin dependencias: ZIP (sin compresión) + OOXML con gráficos nativos de Excel.
const enc = new TextEncoder();
const esc = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colL = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const serial = (iso) => { const [y, m, d] = iso.split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };

// ---------- ZIP ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function zip(files) { // files: [{name, data: string|Uint8Array}]
  const now = new Date();
  const dt = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const tm = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, tm, true); lh.setUint16(12, dt, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, tm, true); ch.setUint16(14, dt, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const csize = central.reduce((a, p) => a + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, csize, true); end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0));
  let o = 0; for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}

// ---------- Estilos ----------
export const S = { def: 0, title: 1, head: 2, text: 3, date: 4, money: 5, moneyB: 6, pct: 7, int: 8, bold: 9, note: 10, num: 11, rate: 12 };
const stylesXml = (symbol) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="5"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="&quot;${esc(symbol)}&quot;#,##0.00"/><numFmt numFmtId="166" formatCode="0.0%"/><numFmt numFmtId="167" formatCode="#,##0.00"/><numFmt numFmtId="168" formatCode="0.0000"/></numFmts>
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="16"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><i/><sz val="10"/><color rgb="FF71717A"/><name val="Calibri"/></font>
</fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD4D4D8"/></left><right style="thin"><color rgb="FFD4D4D8"/></right><top style="thin"><color rgb="FFD4D4D8"/></top><bottom style="thin"><color rgb="FFD4D4D8"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="13">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="168" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// ---------- Hoja ----------
export function sheet(name, widths = []) { return { name, cells: new Map(), widths, freeze: false, filter: null, charts: [] }; }
/** set(sh, fila, col, valor, estilo, fórmula?) — fila/col base 0. valor: number | string | {date:'YYYY-MM-DD'} */
export function set(sh, r, c, v, s = S.text, f) {
  if (!sh.cells.has(r)) sh.cells.set(r, new Map());
  sh.cells.get(r).set(c, { v, s, f });
}
const cellXml = (r, c, { v, s, f }) => {
  const ref = `${colL(c)}${r + 1}`;
  if (v && typeof v === 'object' && v.date) return `<c r="${ref}" s="${s}"><v>${serial(v.date)}</v></c>`;
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${s}">${f ? `<f>${esc(f)}</f>` : ''}<v>${v}</v></c>`;
  if (f) return `<c r="${ref}" s="${s}" t="str"><f>${esc(f)}</f><v>${esc(v ?? '')}</v></c>`;
  if (v === '' || v == null) return `<c r="${ref}" s="${s}"/>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
};
function sheetXml(sh, hasDrawing) {
  const rows = [...sh.cells.keys()].sort((a, b) => a - b);
  let maxC = 0, maxR = 0;
  const data = rows.map((r) => {
    const cs = [...sh.cells.get(r).keys()].sort((a, b) => a - b);
    maxC = Math.max(maxC, cs.at(-1)); maxR = Math.max(maxR, r);
    return `<row r="${r + 1}"${r === 0 && sh.freeze ? ' ht="24" customHeight="1"' : ''}>${cs.map((c) => cellXml(r, c, sh.cells.get(r).get(c))).join('')}</row>`;
  }).join('');
  const cols = sh.widths.length ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const pane = sh.freeze ? '<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${colL(maxC)}${maxR + 1}"/>${pane}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${data}</sheetData>${sh.filter ? `<autoFilter ref="${sh.filter}"/>` : ''}<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>${hasDrawing ? '<drawing r:id="rId1"/>' : ''}</worksheet>`;
}

// ---------- Gráficos ----------
const NS = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const fill = (hex) => `<c:spPr><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill></c:spPr>`;
const ser = (type, s, i, cat, colors) => {
  const tx = `<c:tx><c:v>${esc(s.name)}</c:v></c:tx>`;
  const catX = `<c:cat><c:strRef><c:f>${esc(cat)}</c:f></c:strRef></c:cat>`;
  const valX = `<c:val><c:numRef><c:f>${esc(s.val)}</c:f></c:numRef></c:val>`;
  if (type === 'pie') {
    const dpts = colors.map((h, k) => `<c:dPt><c:idx val="${k}"/><c:bubble3D val="0"/>${fill(h)}</c:dPt>`).join('');
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}${dpts}<c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/></c:dLbls>${catX}${valX}</c:ser>`;
  }
  if (type === 'line') return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="none"/></c:marker>${catX}${valX}<c:smooth val="0"/></c:ser>`;
  return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}${fill(s.color)}<c:invertIfNegative val="0"/>${catX}${valX}</c:ser>`;
};
const PIE_COLORS = ['3B82F6', '22C55E', 'F59E0B', 'A78BFA', 'F87171', '06B6D4', 'EC4899', '84CC16', 'FB923C', '14B8A6', 'EAB308', '94A3B8'];
function chartXml(ch) {
  const title = `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:pPr><a:defRPr sz="1400" b="1"/></a:pPr><a:r><a:rPr lang="es-CR" sz="1400" b="1"/><a:t>${esc(ch.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`;
  const sers = ch.series.map((s, i) => ser(ch.type, s, i, ch.cat, PIE_COLORS)).join('');
  const axes = `<c:catAx><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="112"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>
<c:valAx><c:axId val="112"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="111"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  let plot;
  if (ch.type === 'pie') plot = `<c:pieChart><c:varyColors val="1"/>${sers}<c:firstSliceAng val="0"/></c:pieChart>`;
  else if (ch.type === 'line') plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:marker val="1"/><c:axId val="111"/><c:axId val="112"/></c:lineChart>${axes}`;
  else plot = `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${sers}<c:gapWidth val="80"/><c:axId val="111"/><c:axId val="112"/></c:barChart>${axes}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace ${NS}><c:roundedCorners val="0"/><c:chart>${title}<c:plotArea><c:layout/>${plot}</c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`;
}
const drawingXml = (charts) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${charts.map((ch, i) => `<xdr:twoCellAnchor><xdr:from><xdr:col>${ch.at[0]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${ch.at[1]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${ch.at[2]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${ch.at[3]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Gráfico ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`).join('')}</xdr:wsDr>`;

// ---------- Libro ----------
export function workbook(sheets, symbol) {
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const files = [];
  const ct = [], wbRels = [], wbSheets = [];
  let chartN = 0, drawN = 0;
  sheets.forEach((sh, i) => {
    const n = i + 1;
    const withCharts = sh.charts.length > 0;
    files.push({ name: `xl/worksheets/sheet${n}.xml`, data: sheetXml(sh, withCharts) });
    ct.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    wbRels.push(`<Relationship Id="rId${n}" Type="${R}/worksheet" Target="worksheets/sheet${n}.xml"/>`);
    wbSheets.push(`<sheet name="${esc(sh.name)}" sheetId="${n}" r:id="rId${n}"/>`);
    if (withCharts) {
      drawN++;
      files.push({ name: `xl/worksheets/_rels/sheet${n}.xml.rels`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/drawing" Target="../drawings/drawing${drawN}.xml"/></Relationships>` });
      files.push({ name: `xl/drawings/drawing${drawN}.xml`, data: drawingXml(sh.charts) });
      ct.push(`<Override PartName="/xl/drawings/drawing${drawN}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
      const rels = sh.charts.map((ch, k) => {
        chartN++;
        files.push({ name: `xl/charts/chart${chartN}.xml`, data: chartXml(ch) });
        ct.push(`<Override PartName="/xl/charts/chart${chartN}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
        return `<Relationship Id="rId${k + 1}" Type="${R}/chart" Target="../charts/chart${chartN}.xml"/>`;
      }).join('');
      files.push({ name: `xl/drawings/_rels/drawing${drawN}.xml.rels`, data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>` });
    }
  });
  const sid = sheets.length + 1;
  wbRels.push(`<Relationship Id="rId${sid}" Type="${R}/styles" Target="styles.xml"/>`);
  files.unshift(
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ct.join('')}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${wbSheets.join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wbRels.join('')}</Relationships>` },
    { name: 'xl/styles.xml', data: stylesXml(symbol) },
  );
  return zip(files);
}

// ---------- Modelo FinanzasOS → libro ----------
/**
 * m: {symbol, currency, generated, txs:[{date,type,category,note,currency,orig,rate,amount,source}],
 *     pagos:[{date,name,kind,amount,status}], goals:[{name,target,saved}], deposits:[{date,goal,amount}],
 *     debts:[{name,type,currency,balance,balanceBase,apr,min,dueDay}], strategy:{extra,scenarios:[{name,months,interest,paid}],order:[{name,month}],schedule:[{month,min,ava,snow}]},
 *     monthly:[{label,income,expense}], categories:[{name,amount}]}
 */
export function buildXlsx(m) {
  const sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
  const typeLabel = { income: 'Ingreso', expense: 'Gasto', saving: 'Ahorro', charge: 'Compra tarjeta' };

  // Movimientos
  const mov = sheet('Movimientos', [13, 11, 18, 36, 10, 16, 10, 18, 18]);
  mov.freeze = true;
  ['Fecha', 'Tipo', 'Categoría', 'Nota', 'Moneda', 'Monto original', 'Tasa', `Monto (${m.currency})`, 'Origen'].forEach((h, c) => set(mov, 0, c, h, S.head));
  const txs = [...m.txs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  txs.forEach((t, i) => {
    const r = i + 1;
    set(mov, r, 0, { date: t.date }, S.date); set(mov, r, 1, typeLabel[t.type] || t.type); set(mov, r, 2, t.category); set(mov, r, 3, t.note || '');
    set(mov, r, 4, t.currency); set(mov, r, 5, t.orig, S.num); set(mov, r, 6, t.rate, S.rate); set(mov, r, 7, t.amount, S.money); set(mov, r, 8, t.source);
  });
  mov.filter = `A1:I${Math.max(2, txs.length + 1)}`;

  // Pagos
  const pag = sheet('Pagos', [13, 34, 18, 18, 14]);
  pag.freeze = true;
  ['Vence', 'Concepto', 'Tipo', `Monto (${m.currency})`, 'Estado'].forEach((h, c) => set(pag, 0, c, h, S.head));
  m.pagos.forEach((p, i) => { const r = i + 1; set(pag, r, 0, { date: p.date }, S.date); set(pag, r, 1, p.name); set(pag, r, 2, p.kind); set(pag, r, 3, p.amount, S.money); set(pag, r, 4, p.status); });
  pag.filter = `A1:E${Math.max(2, m.pagos.length + 1)}`;
  const pend = sum(m.pagos.filter((p) => p.status !== 'Pagado'), (p) => p.amount);

  // Ahorros
  const ah = sheet('Ahorros', [30, 18, 18, 14, 4, 14]);
  set(ah, 0, 0, 'Metas de ahorro', S.title);
  ['Meta', 'Objetivo', 'Ahorrado', 'Avance'].forEach((h, c) => set(ah, 2, c, h, S.head));
  m.goals.forEach((g, i) => {
    const r = 3 + i;
    set(ah, r, 0, g.name); set(ah, r, 1, g.target || 0, S.money); set(ah, r, 2, g.saved, S.money);
    set(ah, r, 3, g.target ? g.saved / g.target : 0, S.pct, `IF(B${r + 1}>0,C${r + 1}/B${r + 1},0)`);
  });
  const gEnd = 3 + m.goals.length;
  set(ah, gEnd, 0, 'Total', S.bold); set(ah, gEnd, 1, sum(m.goals, (g) => g.target || 0), S.moneyB, m.goals.length ? `SUM(B4:B${gEnd})` : undefined);
  set(ah, gEnd, 2, sum(m.goals, (g) => g.saved), S.moneyB, m.goals.length ? `SUM(C4:C${gEnd})` : undefined); set(ah, gEnd, 3, '', S.bold);
  const dh = gEnd + 3;
  set(ah, dh - 1, 0, 'Depósitos y retiros', S.bold);
  ['Fecha', 'Meta', 'Monto'].forEach((h, c) => set(ah, dh, c, h, S.head));
  m.deposits.forEach((d, i) => { set(ah, dh + 1 + i, 0, { date: d.date }, S.date); set(ah, dh + 1 + i, 1, d.goal); set(ah, dh + 1 + i, 2, d.amount, S.money); });
  if (m.goals.length) ah.charts.push({ type: 'bar', title: 'Metas: objetivo vs ahorrado', cat: `Ahorros!$A$4:$A$${gEnd}`, series: [{ name: 'Objetivo', val: `Ahorros!$B$4:$B$${gEnd}`, color: '94A3B8' }, { name: 'Ahorrado', val: `Ahorros!$C$4:$C$${gEnd}`, color: '22C55E' }], at: [5, 2, 13, 19] });
  const savedTotal = sum(m.goals, (g) => g.saved);

  // Deudas
  const de = sheet('Deudas', [28, 12, 10, 18, 18, 12, 18, 12, 20]);
  set(de, 0, 0, 'Tarjetas y deudas', S.title);
  ['Nombre', 'Tipo', 'Moneda', 'Saldo (moneda original)', `Saldo (${m.currency})`, 'Tasa anual %', `Pago mínimo (${m.currency})`, 'Día de pago', 'Interés mensual aprox.'].forEach((h, c) => set(de, 2, c, h, S.head));
  m.debts.forEach((d, i) => {
    const r = 3 + i;
    set(de, r, 0, d.name); set(de, r, 1, d.type); set(de, r, 2, d.currency); set(de, r, 3, d.balance, S.num); set(de, r, 4, d.balanceBase, S.money);
    set(de, r, 5, d.apr, S.num); set(de, r, 6, d.min, S.money); set(de, r, 7, d.dueDay, S.int);
    set(de, r, 8, (d.balanceBase * d.apr) / 1200, S.money, `E${r + 1}*F${r + 1}/1200`);
  });
  const dEnd = 3 + m.debts.length;
  set(de, dEnd, 0, 'Total', S.bold);
  [1, 2, 3, 5, 7].forEach((c) => set(de, dEnd, c, '', S.bold));
  set(de, dEnd, 4, sum(m.debts, (d) => d.balanceBase), S.moneyB, m.debts.length ? `SUM(E4:E${dEnd})` : undefined);
  set(de, dEnd, 6, sum(m.debts, (d) => d.min), S.moneyB, m.debts.length ? `SUM(G4:G${dEnd})` : undefined);
  set(de, dEnd, 8, sum(m.debts, (d) => (d.balanceBase * d.apr) / 1200), S.moneyB, m.debts.length ? `SUM(I4:I${dEnd})` : undefined);
  const debtTotal = sum(m.debts, (d) => d.balanceBase);

  // Estrategia
  const es = sheet('Estrategia', [34, 16, 18, 18, 18]);
  set(es, 0, 0, 'Estrategia de pago de deudas', S.title);
  set(es, 1, 0, `Pago extra mensual considerado: ${m.symbol}${Math.round(m.strategy.extra).toLocaleString('en-US')}`, S.note);
  ['Escenario', 'Meses para liquidar', `Interés total (${m.currency})`, `Total pagado (${m.currency})`].forEach((h, c) => set(es, 3, c, h, S.head));
  m.strategy.scenarios.forEach((s, i) => {
    const r = 4 + i;
    set(es, r, 0, s.name); set(es, r, 1, Number.isFinite(s.months) ? s.months : 'No se liquida', Number.isFinite(s.months) ? S.int : S.text);
    set(es, r, 2, s.interest, S.money); set(es, r, 3, s.paid, S.money);
  });
  const oh = 4 + m.strategy.scenarios.length + 2;
  set(es, oh - 1, 0, 'Orden de pago recomendado (avalancha)', S.bold);
  ['Deuda', 'Se liquida en el mes'].forEach((h, c) => set(es, oh, c, h, S.head));
  m.strategy.order.forEach((o, i) => { set(es, oh + 1 + i, 0, o.name); set(es, oh + 1 + i, 1, o.month ?? 'No se liquida', o.month ? S.int : S.text); });
  const sh0 = oh + m.strategy.order.length + 3;
  set(es, sh0 - 1, 0, 'Saldo total pendiente por mes', S.bold);
  ['Mes', 'Solo mínimos', 'Avalancha', 'Bola de nieve'].forEach((h, c) => set(es, sh0, c, h, S.head));
  m.strategy.schedule.forEach((s, i) => { const r = sh0 + 1 + i; set(es, r, 0, s.month, S.int); set(es, r, 1, s.min, S.money); set(es, r, 2, s.ava, S.money); set(es, r, 3, s.snow, S.money); });
  const sEnd = sh0 + m.strategy.schedule.length;
  if (m.strategy.schedule.length > 1) es.charts.push({ type: 'line', title: 'Saldo de deudas: mínimos vs estrategia', cat: `Estrategia!$A$${sh0 + 2}:$A$${sEnd + 1}`, series: [{ name: 'Solo mínimos', val: `Estrategia!$B$${sh0 + 2}:$B$${sEnd + 1}`, color: 'F87171' }, { name: 'Avalancha', val: `Estrategia!$C$${sh0 + 2}:$C$${sEnd + 1}`, color: '2563EB' }, { name: 'Bola de nieve', val: `Estrategia!$D$${sh0 + 2}:$D$${sEnd + 1}`, color: '22C55E' }], at: [5, 3, 14, 22] });

  // Resumen
  const re = sheet('Resumen', [32, 18, 18, 18, 4]);
  const inc = sum(txs.filter((t) => t.type === 'income'), (t) => t.amount);
  const exp = sum(txs.filter((t) => t.type === 'expense'), (t) => t.amount);
  set(re, 0, 0, 'BWAY X - Finanzas — Resumen financiero', S.title);
  set(re, 1, 0, `Generado el ${m.generated} · Moneda base: ${m.currency}`, S.note);
  set(re, 3, 0, 'Indicador', S.head); set(re, 3, 1, 'Monto', S.head);
  const mv = 'Movimientos!$H:$H', mt = 'Movimientos!$B:$B';
  const kp = [
    ['Ingresos totales', inc, `SUMIFS(${mv},${mt},"Ingreso")`],
    ['Gastos totales', exp, `SUMIFS(${mv},${mt},"Gasto")`],
    ['Balance (ingresos − gastos)', inc - exp, 'B5-B6'],
    ['Ahorrado en metas', savedTotal, m.goals.length ? `Ahorros!$C$${gEnd + 1}` : undefined],
    ['Deuda total', debtTotal, m.debts.length ? `Deudas!$E$${dEnd + 1}` : undefined],
    ['Pagos pendientes o vencidos', pend, 'SUMIFS(Pagos!$D:$D,Pagos!$E:$E,"Pendiente")+SUMIFS(Pagos!$D:$D,Pagos!$E:$E,"Vencido")'],
  ];
  kp.forEach(([k, v, f], i) => { set(re, 4 + i, 0, k, S.bold); set(re, 4 + i, 1, v, S.moneyB, f); });
  const mh = 12;
  set(re, mh - 1, 0, 'Ingresos y gastos por mes', S.bold);
  ['Mes', 'Ingresos', 'Gastos', 'Balance'].forEach((h, c) => set(re, mh, c, h, S.head));
  m.monthly.forEach((x, i) => { const r = mh + 1 + i; set(re, r, 0, x.label); set(re, r, 1, x.income, S.money); set(re, r, 2, x.expense, S.money); set(re, r, 3, x.income - x.expense, S.money, `B${r + 1}-C${r + 1}`); });
  const mEnd = mh + m.monthly.length;
  if (m.monthly.length) re.charts.push({ type: 'bar', title: 'Ingresos vs gastos por mes', cat: `Resumen!$A$${mh + 2}:$A$${mEnd + 1}`, series: [{ name: 'Ingresos', val: `Resumen!$B$${mh + 2}:$B$${mEnd + 1}`, color: '22C55E' }, { name: 'Gastos', val: `Resumen!$C$${mh + 2}:$C$${mEnd + 1}`, color: 'F87171' }], at: [5, 3, 14, 20] });
  const ch0 = mEnd + 4;
  set(re, ch0 - 1, 0, 'Gastos por categoría', S.bold);
  ['Categoría', 'Monto', '% del gasto'].forEach((h, c) => set(re, ch0, c, h, S.head));
  const cats = [...m.categories].sort((a, b) => b.amount - a.amount);
  const ctot = sum(cats, (c) => c.amount) || 1;
  cats.forEach((c, i) => { const r = ch0 + 1 + i; set(re, r, 0, c.name); set(re, r, 1, c.amount, S.money); set(re, r, 2, c.amount / ctot, S.pct, `B${r + 1}/SUM(B$${ch0 + 2}:B$${ch0 + 1 + cats.length})`); });
  if (cats.length) re.charts.push({ type: 'pie', title: 'Gastos por categoría', cat: `Resumen!$A$${ch0 + 2}:$A$${ch0 + 1 + cats.length}`, series: [{ name: 'Gastos', val: `Resumen!$B$${ch0 + 2}:$B$${ch0 + 1 + cats.length}` }], at: [5, 21, 14, 40] });

  return workbook([re, mov, pag, ah, de, es], m.symbol);
}
