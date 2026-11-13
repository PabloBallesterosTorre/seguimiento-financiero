// Tanda 18: cálculos de inmuebles. Funciones puras: las pantallas traen los datos de
// Supabase y aquí solo se hacen cuentas, para poder probarlas sin base de datos.

export type UsoInmueble = "alquiler" | "vivienda_habitual" | "segunda_residencia" | "otro";

export const USOS_INMUEBLE: { value: UsoInmueble; label: string }[] = [
  { value: "alquiler", label: "En alquiler" },
  { value: "vivienda_habitual", label: "Vivienda habitual" },
  { value: "segunda_residencia", label: "Segunda residencia" },
  { value: "otro", label: "Otro" },
];

export function etiquetaUso(uso: string): string {
  return USOS_INMUEBLE.find((u) => u.value === uso)?.label ?? "Otro";
}

export type InmuebleBase = {
  valor_actual: number | null;
  porcentaje_propiedad: number;
  precio_compra: number | null;
  gastos_compra: number;
};

export type DeudaInmueble = {
  capital_inicial: number;
  capital_pendiente: number;
  cuota: number;
  tipo_interes: number | null;
  fecha_fin: string | null;
  valor_residual: number | null;
};

export type MovimientoInmueble = {
  fecha: string;
  importe: number;
  // true para las cuotas de la hipoteca enlazada: no son un gasto del piso como la
  // comunidad, porque buena parte es capital que se devuelve y vuelve a ti como patrimonio.
  esCuotaHipoteca: boolean;
};

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Valor de la parte que es tuya: el valor se guarda al 100 %. */
export function valorTuParte(i: Pick<InmuebleBase, "valor_actual" | "porcentaje_propiedad">): number {
  return redondear(Number(i.valor_actual ?? 0) * (Number(i.porcentaje_propiedad) / 100));
}

/** Lo que te costó tu parte: precio de compra más gastos, por tu porcentaje. */
export function costeTuParte(i: InmuebleBase): number | null {
  if (i.precio_compra === null || i.precio_compra === undefined) return null;
  return redondear((Number(i.precio_compra) + Number(i.gastos_compra ?? 0)) * (Number(i.porcentaje_propiedad) / 100));
}

export function revalorizacion(i: InmuebleBase): { abs: number; pct: number | null } | null {
  const coste = costeTuParte(i);
  if (coste === null || i.valor_actual === null) return null;
  const abs = redondear(valorTuParte(i) - coste);
  return { abs, pct: coste > 0 ? (abs / coste) * 100 : null };
}

export type EstadoHipoteca = {
  pendiente: number;
  cuota: number;
  tin: number | null;
  interesCuota: number;
  capitalCuota: number;
  pctDevuelto: number;
  fechaFin: string | null;
  mesesRestantes: number | null;
};

/**
 * "Así va tu hipoteca": de la próxima cuota, cuánto es interés y cuánto capital, y qué
 * parte del préstamo está ya devuelta. Sistema francés, como el resto de la app.
 */
export function estadoHipoteca(d: DeudaInmueble, hoy: string): EstadoHipoteca {
  const pendiente = Number(d.capital_pendiente);
  const cuota = Number(d.cuota);
  const tin = d.tipo_interes === null ? null : Number(d.tipo_interes);
  const interesCuota = tin === null ? 0 : redondear((pendiente * tin) / 100 / 12);
  const capitalCuota = redondear(Math.max(cuota - interesCuota, 0));
  const inicial = Number(d.capital_inicial);
  const pctDevuelto = inicial > 0 ? Math.min(Math.max(((inicial - pendiente) / inicial) * 100, 0), 100) : 0;

  let mesesRestantes: number | null = null;
  if (d.fecha_fin) {
    const [a1, m1] = hoy.split("-").map(Number);
    const [a2, m2] = d.fecha_fin.split("-").map(Number);
    mesesRestantes = Math.max((a2 - a1) * 12 + (m2 - m1), 0);
  }
  return { pendiente, cuota, tin, interesCuota, capitalCuota, pctDevuelto, fechaFin: d.fecha_fin, mesesRestantes };
}

/** Los `n` meses (YYYY-MM) que acaban en el de `hoy`, del más antiguo al más reciente. */
export function mesesHasta(hoy: string, n: number): string[] {
  const [a, m] = hoy.split("-").map(Number);
  const meses: string[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const total = a * 12 + (m - 1) - k;
    meses.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`);
  }
  return meses;
}

export type MesInmueble = { mes: string; ingresos: number; gastos: number; cuotas: number; neto: number };

export type RendimientoInmueble = {
  meses: MesInmueble[];
  // Meses que cuentan para las medias: desde el primer movimiento dentro de la ventana,
  // para que un piso comprado hace tres meses no salga con su renta dividida entre doce.
  mesesConDatos: number;
  ingresos: number;
  gastos: number;
  cuotas: number;
  interesesEstimados: number;
  flujoMensual: number;
  rentabilidadBruta: number | null;
  rentabilidadNeta: number | null;
};

/**
 * Lo que da o cuesta el inmueble en los últimos 12 meses naturales.
 *
 *  - Flujo mensual: todo lo que entra menos todo lo que sale, cuotas incluidas. Es la
 *    pregunta "¿cuánto me deja (o me cuesta) al mes?".
 *  - Rentabilidad bruta: rentas anualizadas sobre el valor de tu parte.
 *  - Rentabilidad neta: descuenta los gastos y los INTERESES de la hipoteca, pero no el
 *    capital que amortizas, que no es un coste: pasa de deuda a patrimonio. Los intereses
 *    se estiman con el reparto de la cuota actual (interés de este mes / cuota).
 */
export function rendimientoInmueble(
  movimientos: MovimientoInmueble[],
  valor: number,
  hipoteca: EstadoHipoteca | null,
  hoy: string
): RendimientoInmueble {
  const meses = mesesHasta(hoy, 12);
  const porMes = new Map<string, MesInmueble>(meses.map((mes) => [mes, { mes, ingresos: 0, gastos: 0, cuotas: 0, neto: 0 }]));

  let primerMes: string | null = null;
  for (const m of movimientos) {
    const fila = porMes.get(m.fecha.slice(0, 7));
    if (!fila) continue;
    const importe = Number(m.importe);
    if (m.esCuotaHipoteca) fila.cuotas += -importe;
    else if (importe >= 0) fila.ingresos += importe;
    else fila.gastos += -importe;
    if (primerMes === null || fila.mes < primerMes) primerMes = fila.mes;
  }

  const filas = meses.map((mes) => {
    const f = porMes.get(mes)!;
    return {
      mes,
      ingresos: redondear(f.ingresos),
      gastos: redondear(f.gastos),
      cuotas: redondear(f.cuotas),
      neto: redondear(f.ingresos - f.gastos - f.cuotas),
    };
  });

  const mesesConDatos = primerMes === null ? 0 : meses.length - meses.indexOf(primerMes);
  const ingresos = redondear(filas.reduce((s, f) => s + f.ingresos, 0));
  const gastos = redondear(filas.reduce((s, f) => s + f.gastos, 0));
  const cuotas = redondear(filas.reduce((s, f) => s + f.cuotas, 0));
  const parteInteres = hipoteca && hipoteca.cuota > 0 ? Math.min(hipoteca.interesCuota / hipoteca.cuota, 1) : 0;
  const interesesEstimados = redondear(cuotas * parteInteres);

  const anualizar = (x: number) => (mesesConDatos > 0 ? (x / mesesConDatos) * 12 : 0);
  const rentabilidadBruta = valor > 0 && mesesConDatos > 0 ? (anualizar(ingresos) / valor) * 100 : null;
  const rentabilidadNeta =
    valor > 0 && mesesConDatos > 0 ? (anualizar(ingresos - gastos - interesesEstimados) / valor) * 100 : null;

  return {
    meses: filas,
    mesesConDatos,
    ingresos,
    gastos,
    cuotas,
    interesesEstimados,
    flujoMensual: mesesConDatos > 0 ? redondear((ingresos - gastos - cuotas) / mesesConDatos) : 0,
    rentabilidadBruta,
    rentabilidadNeta,
  };
}

/**
 * Aprendizaje por categoría: si los movimientos ya vinculados de una categoría van todos
 * al mismo inmueble (al menos dos, y al menos la mitad de los de esa categoría), los
 * nuevos de esa categoría se vinculan solos. "Comunidad Pablo" aprende enseguida; una
 * categoría genérica como "Suministros", con un solo recibo del piso entre muchos de casa,
 * no.
 */
export function inmueblePorCategoria(
  filas: { categoria_id: string | null; inmueble_id: string | null }[]
): Map<string, string> {
  const stats = new Map<string, { total: number; vinculados: number; inmuebles: Set<string>; ultimo: string | null }>();
  for (const f of filas) {
    if (!f.categoria_id) continue;
    const s = stats.get(f.categoria_id) ?? { total: 0, vinculados: 0, inmuebles: new Set<string>(), ultimo: null };
    s.total++;
    if (f.inmueble_id) {
      s.vinculados++;
      s.inmuebles.add(f.inmueble_id);
      s.ultimo = f.inmueble_id;
    }
    stats.set(f.categoria_id, s);
  }
  const resultado = new Map<string, string>();
  for (const [categoria, s] of stats) {
    if (s.inmuebles.size === 1 && s.vinculados >= 2 && s.vinculados * 2 >= s.total && s.ultimo) {
      resultado.set(categoria, s.ultimo);
    }
  }
  return resultado;
}

/**
 * Valor de tus inmuebles al cierre de un mes, para las series de patrimonio con deuda
 * (Planificador). Usa el valor actual, sin proyectar revalorización, y un inmueble solo
 * cuenta desde el mes en que se compró: antes el dinero estaba en otra parte.
 */
export function valorInmueblesEnMes(
  inmuebles: { valor_actual: number | null; porcentaje_propiedad: number; fecha_compra: string | null }[],
  year: number,
  month: number
): number {
  const mes = `${year}-${String(month).padStart(2, "0")}`;
  return redondear(
    inmuebles
      .filter((i) => !i.fecha_compra || i.fecha_compra.slice(0, 7) <= mes)
      .reduce((s, i) => s + valorTuParte(i), 0)
  );
}
