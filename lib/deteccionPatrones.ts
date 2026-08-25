import { normalizarDescripcion } from "@/lib/categorizacion";

export type MovimientoHistorico = {
  descripcion: string;
  categoria_id: string | null;
  tipo: "ingreso" | "gasto";
  importe: number;
  fecha: string;
};

export type CandidatoDescripcion = {
  clave: string;
  descripcion: string;
  categoria_id: string | null;
  tipo: "ingreso" | "gasto";
  periodicidad: "mensual" | "anual";
  importe_estimado: number;
  ocurrencias: number;
  proximaFecha: string;
};

export type CandidatoCategoria = {
  clave: string;
  categoria_id: string;
  tipo: "ingreso" | "gasto";
  importe_estimado: number;
  mesesConDatos: number;
};

// Moda de las categorías de un grupo de ocurrencias, ignorando las que todavía no
// están categorizadas (null): si una sola ocurrencia ya está categorizada, esa
// categoría debe ganar sobre la mayoría sin categorizar, en vez de que "sin
// categoría" gane por ser la más repetida mientras el usuario va categorizando
// poco a poco las apariciones de un mismo patrón recurrente.
function modaCategoria(valores: (string | null)[]): string | null {
  const conCategoria = valores.filter((v): v is string => v !== null);
  if (conCategoria.length === 0) return null;

  const conteo = new Map<string, number>();
  for (const v of conCategoria) conteo.set(v, (conteo.get(v) ?? 0) + 1);
  return Array.from(conteo.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

function diasEntre(a: string, b: string): number {
  const msPorDia = 1000 * 60 * 60 * 24;
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / msPorDia;
}

// Nivel 1: patrones por descripción repetida (mensuales o anuales/estacionales).
export function detectarPatronesPorDescripcion(movimientos: MovimientoHistorico[]): CandidatoDescripcion[] {
  const grupos = new Map<string, MovimientoHistorico[]>();

  for (const m of movimientos) {
    const clave = `${m.tipo}:${normalizarDescripcion(m.descripcion)}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(m);
  }

  const candidatos: CandidatoDescripcion[] = [];

  for (const [clave, grupo] of grupos.entries()) {
    if (grupo.length < 2) continue;

    const ordenado = [...grupo].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const deltas: number[] = [];
    for (let i = 1; i < ordenado.length; i++) {
      deltas.push(diasEntre(ordenado[i - 1].fecha, ordenado[i].fecha));
    }
    const avgDelta = deltas.reduce((s, d) => s + d, 0) / deltas.length;

    let periodicidad: "mensual" | "anual" | null = null;
    if (avgDelta >= 25 && avgDelta <= 35 && ordenado.length >= 3) periodicidad = "mensual";
    else if (avgDelta >= 330 && avgDelta <= 400 && ordenado.length >= 2) periodicidad = "anual";
    if (!periodicidad) continue;

    const importeMedio = ordenado.reduce((s, m) => s + Math.abs(m.importe), 0) / ordenado.length;
    const ultima = ordenado[ordenado.length - 1];
    const proxima = new Date(ultima.fecha);
    proxima.setDate(proxima.getDate() + Math.round(avgDelta));

    candidatos.push({
      clave,
      descripcion: ultima.descripcion,
      categoria_id: modaCategoria(ordenado.map((m) => m.categoria_id)),
      tipo: ultima.tipo,
      periodicidad,
      importe_estimado: Math.round(importeMedio * 100) / 100,
      ocurrencias: ordenado.length,
      proximaFecha: proxima.toISOString().slice(0, 10),
    });
  }

  return candidatos.sort((a, b) => b.ocurrencias - a.ocurrencias);
}

// Nivel 2: media mensual por categoría, para el gasto/ingreso variable que no tiene
// un patrón de descripción único (excluye lo ya cubierto por el nivel 1). Se agrega
// siempre a nivel de categoría padre (vía `categoriaEfectiva`) para que una categoría
// con subcategorías salga como una única sugerencia, no una por subcategoría.
export function detectarMediaPorCategoria(
  movimientos: MovimientoHistorico[],
  clavesYaCubiertas: Set<string>,
  categoriaEfectiva: (categoriaId: string) => string = (id) => id
): CandidatoCategoria[] {
  const restantes = movimientos.filter(
    (m) => m.categoria_id && !clavesYaCubiertas.has(`${m.tipo}:${normalizarDescripcion(m.descripcion)}`)
  );

  const porCategoria = new Map<string, { tipo: "ingreso" | "gasto"; porMes: Map<string, number> }>();

  for (const m of restantes) {
    const categoriaId = categoriaEfectiva(m.categoria_id!);
    const clave = `${m.tipo}:${categoriaId}`;
    if (!porCategoria.has(clave)) porCategoria.set(clave, { tipo: m.tipo, porMes: new Map() });
    const entrada = porCategoria.get(clave)!;
    const mesKey = m.fecha.slice(0, 7);
    entrada.porMes.set(mesKey, (entrada.porMes.get(mesKey) ?? 0) + Math.abs(m.importe));
  }

  const candidatos: CandidatoCategoria[] = [];

  for (const [clave, entrada] of porCategoria.entries()) {
    const meses = Array.from(entrada.porMes.values());
    if (meses.length < 2) continue;

    const media = meses.reduce((s, v) => s + v, 0) / meses.length;

    candidatos.push({
      clave,
      categoria_id: clave.split(":")[1],
      tipo: entrada.tipo,
      importe_estimado: Math.round(media * 100) / 100,
      mesesConDatos: meses.length,
    });
  }

  return candidatos.sort((a, b) => b.mesesConDatos - a.mesesConDatos);
}
