export type MovimientoPrevisto = {
  id: string;
  descripcion: string;
  categoria_id: string | null;
  cuenta_id: string | null;
  tipo: "ingreso" | "gasto" | "traspaso";
  importe_estimado: number;
  importe_min: number | null;
  importe_max: number | null;
  tipo_recurrencia: "unica_vez" | "recurrente";
  periodicidad: "mensual" | "bimensual" | "trimestral" | "semestral" | "anual" | null;
  fecha: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: "activo" | "pausado";
  movimiento_real_id: string | null;
  origen_calculo: "fijo" | "media_categoria";
};

export function importeEstimado(
  p: Pick<MovimientoPrevisto, "importe_estimado" | "importe_min" | "importe_max">
): number {
  if (p.importe_min != null && p.importe_max != null) return (p.importe_min + p.importe_max) / 2;
  return Number(p.importe_estimado);
}

// Importe a usar en una proyección: si el previsto es de origen 'media_categoria'
// (nivel 2 — categoría variable sin patrón de descripción propio), se recalcula a
// partir del histórico actual de esa categoría en vez de usar el importe congelado
// al aceptarlo, para que se actualice solo según llega más histórico. Si todavía no
// hay media calculada para esa categoría (p. ej. recién aceptada, sin histórico
// nuevo desde entonces), cae al importe guardado como respaldo.
export function importeEfectivoPrevisto(
  p: Pick<MovimientoPrevisto, "importe_estimado" | "importe_min" | "importe_max" | "origen_calculo" | "categoria_id" | "tipo">,
  mediaPorCategoria: Map<string, number> = new Map()
): number {
  if (p.origen_calculo === "media_categoria" && p.categoria_id) {
    const media = mediaPorCategoria.get(`${p.tipo}:${p.categoria_id}`);
    if (media !== undefined) return media;
  }
  return importeEstimado(p);
}

// ¿Aplica este movimiento previsto al mes (year, month 1-12) indicado?
export function previstoAplicaEnMes(p: MovimientoPrevisto, year: number, month: number): boolean {
  if (p.estado !== "activo") return false;

  if (p.tipo_recurrencia === "unica_vez") {
    if (!p.fecha) return false;
    const f = new Date(`${p.fecha}T00:00:00`);
    return f.getFullYear() === year && f.getMonth() + 1 === month;
  }

  if (!p.fecha_inicio) return false;
  const inicio = new Date(`${p.fecha_inicio}T00:00:00`);
  const inicioYM = inicio.getFullYear() * 12 + inicio.getMonth();
  const actualYM = year * 12 + (month - 1);
  if (actualYM < inicioYM) return false;

  if (p.fecha_fin) {
    const fin = new Date(`${p.fecha_fin}T00:00:00`);
    const finYM = fin.getFullYear() * 12 + fin.getMonth();
    if (actualYM > finYM) return false;
  }

  if (p.periodicidad === "mensual") return true;
  if (p.periodicidad === "bimensual") return (actualYM - inicioYM) % 2 === 0;
  if (p.periodicidad === "trimestral") return (actualYM - inicioYM) % 3 === 0;
  if (p.periodicidad === "semestral") return (actualYM - inicioYM) % 6 === 0;
  if (p.periodicidad === "anual") return inicio.getMonth() + 1 === month;

  return false;
}

// ¿Ya se materializó este previsto para el mes (year, month) indicado? Es decir, ¿su
// movimiento_real_id apunta a un movimiento real fechado ese mismo mes? Sirve para no
// contar dos veces un mes que mezcla lo ya ocurrido (reflejado en el saldo real) con
// lo previsto para lo que falta: si ya se concilió, ese importe ya está dentro del
// saldo real de partida y no debe volver a sumarse como previsión.
export function previstoYaMaterializadoEnMes(
  p: Pick<MovimientoPrevisto, "movimiento_real_id">,
  year: number,
  month: number,
  fechaPorMovimientoReal: Map<string, string>
): boolean {
  if (!p.movimiento_real_id) return false;
  const fecha = fechaPorMovimientoReal.get(p.movimiento_real_id);
  if (!fecha) return false;
  const f = new Date(`${fecha}T00:00:00`);
  return f.getFullYear() === year && f.getMonth() + 1 === month;
}

// Previstos recurrentes o de única vez que podrían corresponder a un movimiento (al
// importar o dar de alta a mano): mismo tipo, misma categoría exacta, aplicable en el
// mes de la fecha del movimiento, e importe "parecido". Puede haber más de un
// candidato (ambigüedad) — el llamador decide cómo resolverlo (p. ej. mostrando un
// desplegable con todos y dejando "sin vincular" como opción por defecto), nunca se
// elige uno automáticamente aquí.
export function previstosCoincidentes(
  movimiento: { fecha: string; tipo: "ingreso" | "gasto"; categoria_id: string | null; importe: number },
  previstos: MovimientoPrevisto[]
): MovimientoPrevisto[] {
  if (movimiento.categoria_id === null) return [];

  const f = new Date(`${movimiento.fecha}T00:00:00`);
  const year = f.getFullYear();
  const month = f.getMonth() + 1;
  const importeAbs = Math.abs(movimiento.importe);

  return previstos.filter((p) => {
    if (p.tipo !== movimiento.tipo) return false;
    if (p.categoria_id !== movimiento.categoria_id) return false;
    if (!previstoAplicaEnMes(p, year, month)) return false;

    if (p.importe_min != null && p.importe_max != null) {
      const margen = (p.importe_max - p.importe_min) * 0.15;
      return importeAbs >= p.importe_min - margen && importeAbs <= p.importe_max + margen;
    }

    const estimado = importeEstimado(p);
    const tolerancia = Math.max(estimado * 0.3, 20);
    return Math.abs(importeAbs - estimado) <= tolerancia;
  });
}

// Categoría "real" de una previsión: si ya está conciliada con un movimiento real,
// manda la categoría de ese movimiento (puede haberse categorizado o corregido
// después de crear la previsión), no la que tenía la previsión al crearse. Evita el
// bug de mostrar "Sin categoría" para una previsión ya vinculada a una transacción
// categorizada.
export function categoriaEfectivaId(
  previsto: Pick<MovimientoPrevisto, "categoria_id" | "movimiento_real_id">,
  categoriaPorMovimientoReal: Map<string, string | null>
): string | null {
  if (!previsto.movimiento_real_id) return previsto.categoria_id;
  const categoriaDelReal = categoriaPorMovimientoReal.get(previsto.movimiento_real_id);
  return categoriaDelReal !== undefined ? categoriaDelReal : previsto.categoria_id;
}

export type CategoriaInfo = { id: string; nombre: string; categoria_padre_id: string | null };

export type FilaDiagnostico = {
  categoriaId: string;
  nombre: string;
  importesPorMes: number[];
  mediaPorMes: boolean[];
  subfilas: FilaDiagnostico[];
};

const SIN_CATEGORIA_CLAVE = "__sin_categoria__";
const INTERESES_CLAVE = "__intereses__";

// Tabla de diagnóstico de la previsión: para cada mes del horizonte, agrega el
// importe previsto por categoría padre (sumando sus subcategorías), dejando el
// desglose por subcategoría disponible para las filas expandibles. Sirve para ver de
// un vistazo qué está aplicando el motor de previsión mes a mes y detectar huecos o
// duplicados, combinando movimientos previstos (manuales y automáticos, incluida la
// cuota de deuda), la previsión de intereses de cuentas remuneradas, y el nivel 2
// (media histórica por categoría, recalculada vía `mediaPorCategoria` en vez del
// importe congelado al aceptar la sugerencia). `mediaPorMes` marca, celda a celda, si
// el importe mostrado viene de una media variable (nivel 2) para poder distinguirlo
// visualmente de un ítem fijo (nivel 1, manual o deuda).
export function construirDiagnosticoPrevision(
  previstos: MovimientoPrevisto[],
  meses: { year: number; month: number }[],
  categorias: CategoriaInfo[],
  interesesPorMes: Map<string, number> = new Map(),
  mediaPorCategoria: Map<string, number> = new Map()
): FilaDiagnostico[] {
  const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));
  const padreDe = new Map(categorias.map((c) => [c.id, c.categoria_padre_id]));

  const directoPorCategoria = new Map<string, number[]>();
  const esMediaPorCategoria = new Map<string, boolean[]>();
  const filaDirecta = (clave: string): number[] => {
    if (!directoPorCategoria.has(clave)) directoPorCategoria.set(clave, meses.map(() => 0));
    return directoPorCategoria.get(clave)!;
  };
  const filaEsMedia = (clave: string): boolean[] => {
    if (!esMediaPorCategoria.has(clave)) esMediaPorCategoria.set(clave, meses.map(() => false));
    return esMediaPorCategoria.get(clave)!;
  };

  for (const p of previstos) {
    if (p.tipo === "traspaso") continue;
    const clave = p.categoria_id ?? SIN_CATEGORIA_CLAVE;
    const fila = filaDirecta(clave);
    const filaMedia = filaEsMedia(clave);
    const signo = p.tipo === "ingreso" ? 1 : -1;
    const esMedia = p.origen_calculo === "media_categoria";
    meses.forEach((mes, i) => {
      if (!previstoAplicaEnMes(p, mes.year, mes.month)) return;
      fila[i] += signo * importeEfectivoPrevisto(p, mediaPorCategoria);
      if (esMedia) filaMedia[i] = true;
    });
  }

  if (interesesPorMes.size > 0) {
    const fila = filaDirecta(INTERESES_CLAVE);
    meses.forEach((mes, i) => {
      fila[i] += interesesPorMes.get(`${mes.year}-${mes.month}`) ?? 0;
    });
  }

  const nombreDe = (clave: string): string => {
    if (clave === SIN_CATEGORIA_CLAVE) return "Sin categoría";
    if (clave === INTERESES_CLAVE) return "Intereses (cuentas remuneradas)";
    return nombreCategoria.get(clave) ?? "Categoría eliminada";
  };

  const esPseudoCategoria = (clave: string) => clave === SIN_CATEGORIA_CLAVE || clave === INTERESES_CLAVE;

  const clavesConDatos = Array.from(directoPorCategoria.keys());
  const clavesPadre = new Set(
    clavesConDatos.map((clave) => (esPseudoCategoria(clave) ? clave : padreDe.get(clave) ?? clave))
  );

  const filas: FilaDiagnostico[] = Array.from(clavesPadre).map((padreClave) => {
    const subfilas: FilaDiagnostico[] = clavesConDatos
      .filter((clave) => clave !== padreClave && !esPseudoCategoria(clave) && padreDe.get(clave) === padreClave)
      .map((clave) => ({
        categoriaId: clave,
        nombre: nombreDe(clave),
        importesPorMes: filaDirecta(clave),
        mediaPorMes: filaEsMedia(clave),
        subfilas: [],
      }));

    const importePropio = directoPorCategoria.get(padreClave) ?? meses.map(() => 0);
    const mediaPropia = esMediaPorCategoria.get(padreClave) ?? meses.map(() => false);
    const importesPorMes = meses.map(
      (_, i) => importePropio[i] + subfilas.reduce((suma, hijo) => suma + hijo.importesPorMes[i], 0)
    );
    const mediaPorMes = meses.map((_, i) => mediaPropia[i] || subfilas.some((hijo) => hijo.mediaPorMes[i]));

    return { categoriaId: padreClave, nombre: nombreDe(padreClave), importesPorMes, mediaPorMes, subfilas };
  });

  // Orden por defecto (tanda 5, mejora 7): ingresos antes que gastos. Una categoría
  // no está ligada a un único tipo, así que se agrupa por el signo del total del
  // periodo (positivo = se comporta como ingreso, negativo = como gasto); dentro de
  // cada grupo, alfabético como ya hacía antes.
  const sumaTotal = (fila: FilaDiagnostico) => fila.importesPorMes.reduce((s, v) => s + v, 0);
  return filas.sort((a, b) => {
    const grupoA = sumaTotal(a) >= 0 ? 0 : 1;
    const grupoB = sumaTotal(b) >= 0 ? 0 : 1;
    if (grupoA !== grupoB) return grupoA - grupoB;
    return a.nombre.localeCompare(b.nombre);
  });
}

export function generarMeses(n: number): { year: number; month: number; label: string }[] {
  const hoy = new Date();
  const meses = [];

  for (let i = 0; i < n; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    const raw = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(d);
    meses.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: raw.charAt(0).toUpperCase() + raw.slice(1),
    });
  }

  return meses;
}

// n meses anteriores al mes actual, en orden cronológico ascendente (el más antiguo
// primero, terminando justo antes del mes actual) — para la vista histórica del
// Planificador, complementaria a `generarMeses`.
export function generarMesesHaciaAtras(n: number): { year: number; month: number; label: string }[] {
  const hoy = new Date();
  const meses = [];

  for (let i = n; i >= 1; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const raw = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(d);
    meses.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: raw.charAt(0).toUpperCase() + raw.slice(1),
    });
  }

  return meses;
}
