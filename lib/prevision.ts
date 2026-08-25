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
  periodicidad: "mensual" | "anual" | null;
  fecha: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: "activo" | "pausado";
  movimiento_real_id: string | null;
};

export function importeEstimado(
  p: Pick<MovimientoPrevisto, "importe_estimado" | "importe_min" | "importe_max">
): number {
  if (p.importe_min != null && p.importe_max != null) return (p.importe_min + p.importe_max) / 2;
  return Number(p.importe_estimado);
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
  if (p.periodicidad === "anual") return inicio.getMonth() + 1 === month;

  return false;
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
  subfilas: FilaDiagnostico[];
};

const SIN_CATEGORIA_CLAVE = "__sin_categoria__";
const INTERESES_CLAVE = "__intereses__";

// Tabla de diagnóstico de la previsión: para cada mes del horizonte, agrega el
// importe previsto por categoría padre (sumando sus subcategorías), dejando el
// desglose por subcategoría disponible para las filas expandibles. Sirve para ver de
// un vistazo qué está aplicando el motor de previsión mes a mes y detectar huecos o
// duplicados, combinando movimientos previstos (manuales y automáticos, incluida la
// cuota de deuda) y la previsión de intereses de cuentas remuneradas.
export function construirDiagnosticoPrevision(
  previstos: MovimientoPrevisto[],
  meses: { year: number; month: number }[],
  categorias: CategoriaInfo[],
  interesesPorMes: Map<string, number> = new Map()
): FilaDiagnostico[] {
  const nombreCategoria = new Map(categorias.map((c) => [c.id, c.nombre]));
  const padreDe = new Map(categorias.map((c) => [c.id, c.categoria_padre_id]));

  const directoPorCategoria = new Map<string, number[]>();
  const filaDirecta = (clave: string): number[] => {
    if (!directoPorCategoria.has(clave)) directoPorCategoria.set(clave, meses.map(() => 0));
    return directoPorCategoria.get(clave)!;
  };

  for (const p of previstos) {
    if (p.tipo === "traspaso") continue;
    const clave = p.categoria_id ?? SIN_CATEGORIA_CLAVE;
    const fila = filaDirecta(clave);
    const signo = p.tipo === "ingreso" ? 1 : -1;
    meses.forEach((mes, i) => {
      if (previstoAplicaEnMes(p, mes.year, mes.month)) fila[i] += signo * importeEstimado(p);
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
        subfilas: [],
      }));

    const importePropio = directoPorCategoria.get(padreClave) ?? meses.map(() => 0);
    const importesPorMes = meses.map(
      (_, i) => importePropio[i] + subfilas.reduce((suma, hijo) => suma + hijo.importesPorMes[i], 0)
    );

    return { categoriaId: padreClave, nombre: nombreDe(padreClave), importesPorMes, subfilas };
  });

  return filas.sort((a, b) => a.nombre.localeCompare(b.nombre));
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
