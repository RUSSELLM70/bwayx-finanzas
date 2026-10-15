// Motor de recomendaciones: funciones puras, sin DOM. Reglas simples y explicables.
export const NEEDS = ['Vivienda', 'Servicios', 'Comida', 'Transporte', 'Salud', 'Deudas', 'Educación'];
export const WANTS = ['Restaurantes', 'Ocio', 'Compras', 'Suscripciones', 'Otros'];
export const EXPENSE_CATS = [...NEEDS, ...WANTS];
export const INCOME_CATS = ['Salario', 'Freelance', 'Negocio', 'Inversiones', 'Otros'];

export function summarize(txs) {
  const s = { income: 0, expense: 0, saved: 0, byCat: {}, expenses: [] };
  for (const t of txs) {
    if (t.type === 'income') s.income += t.amount;
    else if (t.charge) s.charged = (s.charged || 0) + t.amount; // compra con tarjeta: el efectivo sale al pagarla
    else if (t.type === 'saving') s.saved += t.amount;
    else {
      s.expense += t.amount;
      s.byCat[t.category] = (s.byCat[t.category] || 0) + t.amount;
      s.expenses.push(t);
    }
  }
  s.net = s.income - s.expense;
  s.savingsRate = s.income > 0 ? s.net / s.income : null;
  return s;
}

/** Valor futuro de aportes mensuales `pmt` a tasa anual `rate` durante `years`. */
export function futureValue(pmt, rate, years) {
  const r = rate / 12;
  const n = years * 12;
  return r === 0 ? pmt * n : pmt * ((Math.pow(1 + r, n) - 1) / r);
}

const PERIOD_TO_MONTH = { day: null, week: 52 / 12, fortnight: 2, month: 1 };

/**
 * @param {{cur:object[], prev:object[], all:object[], kind:string, settings:object, todayISO:string, fmt:(n:number)=>string}} p
 * @returns {{level:'good'|'info'|'warn'|'alert', title:string, text:string}[]}
 */
export function advise({ cur, prev, all, kind, settings, todayISO, fmt, fixedMonthly = 0, debtInfo = null, cushion = null, monthlyIncomeEst = 0 }) {
  const out = [];
  const add = (level, title, text) => out.push({ level, title, text });
  const c = summarize(cur);
  const p = summarize(prev);
  const goal = (settings.savingsGoalPct ?? 20) / 100;
  const pct = (x) => `${Math.round(x * 100)}%`;

  if (cur.length === 0) {
    add('info', 'Empieza registrando', 'Anota tus ingresos y gastos de este periodo y aquí aparecerán recomendaciones a tu medida.');
    return out;
  }

  // 1. Tasa de ahorro frente a la meta
  if (c.income > 0) {
    const r = c.savingsRate;
    if (r < 0) add('alert', 'Estás gastando más de lo que ganas', `Gastaste ${fmt(c.expense)} y recibiste ${fmt(c.income)}: faltan ${fmt(-c.net)}. Prioriza recortar gastos de "deseo" y evita usar crédito para cubrir la diferencia.`);
    else if (r < goal) add('warn', `Ahorras ${pct(r)}, tu meta es ${pct(goal)}`, `Para llegar a tu meta te faltan ${fmt(goal * c.income - c.net)} este periodo. Una forma: separar el ahorro apenas recibes el pago, antes de gastar.`);
    else add('good', `Vas muy bien: ahorras ${pct(r)}`, `Superas tu meta de ${pct(goal)}. Mantén el hábito y que ese dinero trabaje (ver recomendaciones de inversión).`);
  } else if (c.expense > 0) {
    add('info', 'Sin ingresos registrados', 'Registra tus pagos recibidos para calcular tu tasa de ahorro.');
  }

  // 1b. Peso de los gastos fijos sobre el ingreso mensual estimado
  const mult0 = PERIOD_TO_MONTH[kind];
  const monthlyIncome = monthlyIncomeEst > 0 ? monthlyIncomeEst : c.income * (mult0 || 0);
  if (fixedMonthly > 0 && monthlyIncome > 0) {
    const share = fixedMonthly / monthlyIncome;
    const free = monthlyIncome - fixedMonthly;
    if (share > 0.6) add('alert', `Tus gastos fijos son ${pct(share)} de tu ingreso`, `Fijos: ${fmt(fixedMonthly)} al mes de ${fmt(monthlyIncome)} estimados. Solo quedan ${fmt(Math.max(0, free))} para todo lo demás. Es difícil ahorrar así: revisa si puedes renegociar o reducir alguno.`);
    else if (share > 0.5) add('warn', `Tus gastos fijos son ${pct(share)} de tu ingreso`, `Pasan del 50% recomendado para necesidades. Después de fijos te quedan ${fmt(free)} al mes.`);
    else add('good', `Gastos fijos controlados (${pct(share)})`, `Después de pagar tus fijos te quedan ${fmt(free)} al mes para vivir, ahorrar e invertir.`);
  }

  // 1c. Deudas: resumen de la estrategia (el detalle está en la pantalla Deudas)
  if (debtInfo && debtInfo.total > 0) {
    if (!Number.isFinite(debtInfo.minOnlyMonths)) {
      add('alert', 'Pagando solo el mínimo tus deudas no bajan', `Debes ${fmt(debtInfo.total)} y los intereses (≈${fmt(debtInfo.monthlyInterest)} al mes) se comen el pago mínimo. Necesitas pagar más que el mínimo para salir.`);
    } else if (debtInfo.extra > 0 && Number.isFinite(debtInfo.planMonths)) {
      add('warn', `Puedes salir de deudas en ${debtInfo.planMonths} meses`, `Pagando ${fmt(debtInfo.extra)} extra al mes al "${debtInfo.priorityName}" (la de mayor interés) ahorras ${fmt(debtInfo.interestSaved)} en intereses frente a pagar solo mínimos (${debtInfo.minOnlyMonths} meses).`);
    } else {
      add('warn', `Tienes ${fmt(debtInfo.total)} en deudas`, `Con solo mínimos tardarías ${debtInfo.minOnlyMonths} meses y pagarías ${fmt(debtInfo.minOnlyInterest)} de interés. Cada pago extra al "${debtInfo.priorityName}" acelera la salida.`);
    }
  }

  // 2. Regla 50/30/20
  if (c.income > 0) {
    const needs = NEEDS.reduce((a, k) => a + (c.byCat[k] || 0), 0);
    const wants = WANTS.reduce((a, k) => a + (c.byCat[k] || 0), 0);
    if (needs / c.income > 0.5) add('warn', `Necesidades: ${pct(needs / c.income)} de tus ingresos`, 'La referencia es 50%. Revisa vivienda, servicios y deudas: renegociar plan de internet/celular, seguros o tasas suele liberar dinero fijo cada mes.');
    if (wants / c.income > 0.3) add('warn', `Deseos: ${pct(wants / c.income)} de tus ingresos`, `La referencia es 30%. Recortar un tercio de ese rubro te devolvería ${fmt(wants / 3)} este periodo.`);
  }

  // 3. Categoría dominante
  const top = Object.entries(c.byCat).sort((a, b) => b[1] - a[1])[0];
  if (top && c.expense > 0 && top[1] / c.expense > 0.35 && !['Vivienda'].includes(top[0])) {
    add('info', `${top[0]} concentra ${pct(top[1] / c.expense)} de tus gastos`, `Es tu mayor rubro (${fmt(top[1])}). Fijarte un tope para esta categoría es el cambio con más impacto.`);
  }

  // 4. Categorías que subieron vs. periodo anterior
  if (p.expense > 0) {
    const ups = Object.entries(c.byCat)
      .map(([k, v]) => ({ k, v, d: v - (p.byCat[k] || 0), prev: p.byCat[k] || 0 }))
      .filter((x) => x.prev > 0 && x.v > x.prev * 1.25 && x.d > c.expense * 0.05)
      .sort((a, b) => b.d - a.d)
      .slice(0, 2);
    for (const u of ups) add('warn', `${u.k} subió ${pct(u.v / u.prev - 1)} vs. el periodo anterior`, `Pasaste de ${fmt(u.prev)} a ${fmt(u.v)}. ¿Fue algo puntual o un nuevo hábito?`);
  }

  // 5. Gastos hormiga
  if (c.income > 0 && c.expenses.length >= 8) {
    const small = c.expenses.filter((t) => t.amount <= c.income * 0.02);
    const sum = small.reduce((a, t) => a + t.amount, 0);
    if (small.length >= 8 && sum >= c.expense * 0.08) {
      add('warn', 'Gastos hormiga', `${small.length} compras pequeñas suman ${fmt(sum)} (${pct(sum / c.expense)} de tus gastos). Cafés, antojos y suscripciones olvidadas pasan desapercibidos pero pesan.`);
    }
  }

  // 6. Presupuestos por categoría (se comparan con el equivalente mensual del periodo)
  const factor = { day: 1 / 30, week: 7 / 30, fortnight: 0.5, month: 1 }[kind];
  for (const [cat, limit] of Object.entries(settings.budgets || {})) {
    if (!limit || limit <= 0) continue;
    const spent = c.byCat[cat] || 0;
    const allowed = limit * factor;
    if (spent > allowed) add('alert', `Presupuesto de ${cat} superado`, `Llevas ${fmt(spent)} de ${fmt(allowed)} permitidos en este periodo.`);
    else if (spent > allowed * 0.8) add('warn', `${cat}: ya usaste ${pct(spent / allowed)} del presupuesto`, `Te quedan ${fmt(allowed - spent)} para el resto del periodo.`);
  }

  // 7. Fondo de emergencia
  const tot = summarize(all);
  const dates = all.map((t) => t.date).sort();
  let emergencyOk = false;
  if (tot.expense > 0 && dates.length) {
    const spanDays = Math.max(30, (new Date(todayISO) - new Date(dates[0])) / 86400000);
    const monthlyExpense = tot.expense / (spanDays / 30);
    const months = Math.max(0, cushion ?? tot.net) / monthlyExpense;
    emergencyOk = months >= 3;
    if (months < 3) add('warn', `Tu colchón cubre ${months.toFixed(1)} meses de gastos`, `Lo ideal es de 3 a 6 meses (${fmt(monthlyExpense * 3)} – ${fmt(monthlyExpense * 6)}). Antes de invertir, construye este fondo en una cuenta de ahorro con liquidez.`);
    else add('good', `Colchón de emergencia: ${months.toFixed(1)} meses`, 'Cubres al menos 3 meses de gastos. Buena base para empezar a invertir.');
  }

  // 8. Inversión (educativo, no asesoría)
  const mult = PERIOD_TO_MONTH[kind];
  if (mult && c.net > 0) {
    const monthly = c.net * mult;
    const fv = futureValue(monthly, 0.06, 10);
    const invest = Math.round(monthly * 0.5);
    if (emergencyOk) {
      add('info', 'Qué hacer con tu excedente', `Con ${fmt(monthly)} de ahorro mensual, destinar ${fmt(invest)} a un fondo indexado diversificado (ETF amplio) o a certificados a plazo, de forma constante, podría crecer a unos ${fmt(fv / 2 + monthly * 60)} en 10 años a un 6% anual (proyección ilustrativa, no garantizada).`);
    } else {
      add('info', 'Orden recomendado para tu dinero', `1) Fondo de emergencia, 2) pagar deudas con tasa alta, 3) invertir. Con ${fmt(monthly)} al mes, en 10 años habrías acumulado ${fmt(monthly * 120)} aun sin rendimientos.`);
    }
    add('info', 'Perfiles de inversión comunes', 'Conservador: cuentas de ahorro de alto rendimiento y certificados a plazo. Moderado: mezcla de renta fija y fondos indexados. Dinámico: mayormente acciones/ETF globales a largo plazo (más de 5 años). Diversifica y no inviertas dinero que necesites pronto. Esto es información educativa, no asesoría financiera.');
  } else if (!mult) {
    add('info', 'Más claridad con periodos largos', 'Cambia a Quincena o Mes para ver proyecciones de ahorro e inversión.');
  }

  return out;
}
