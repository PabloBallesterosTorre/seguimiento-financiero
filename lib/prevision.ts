export type MovimientoPrevisto = {
  id: string;
  descripcion: string;
  categoria_id: string | null;
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
