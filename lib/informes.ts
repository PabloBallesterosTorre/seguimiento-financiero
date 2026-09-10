// Agregaciones específicas de la pantalla de Informes (tanda 5, mejora 8) que no
// encajaban ya en lib/prevision.ts, lib/planificador.ts o lib/deteccionPatrones.ts.
// Todas trabajan siempre sobre movimientos reales/históricos — nunca mezclan con
// previsión, salvo previstoVsRealPorCategoria, que compara explícitamente ambos.

export type MovimientoParaInforme = {
  categoria_id: string | null;
  tipo: string;
  importe: number;
  fecha: string;
};

// Total absoluto por categoría padre y por mes ("YYYY-MM"), para un tipo (ingreso o
// gasto) concreto. Sirve de base tanto para la media del periodo (8.3, dividiendo el
// total entre el número de meses del rango) como para la serie mensual (8.4).
export function agruparPorCategoriaPadreYMes(
  movimientos: MovimientoParaInforme[],
  tipo: "ingreso" | "gasto",
  categoriaEfectiva: (categoriaId: string) => string
): Map<string, Map<string, number>> {
  const resultado = new Map<string, Map<string, number>>();

  for (const m of movimientos) {
    if (m.tipo !== tipo || !m.categoria_id) continue;
    const categoriaId = categoriaEfectiva(m.categoria_id);
    const mesKey = m.fecha.slice(0, 7);
    if (!resultado.has(categoriaId)) resultado.set(categoriaId, new Map());
    const porMes = resultado.get(categoriaId)!;
    porMes.set(mesKey, (porMes.get(mesKey) ?? 0) + Math.abs(Number(m.importe)));
  }

  return resultado;
}

export type MediaPorCategoria = { categoriaId: string; total: number; media: number };

// Media mensual de cada categoría en el periodo: el total se divide siempre entre el
// número de meses del RANGO elegido (no entre los meses que de verdad tienen datos),
// tal como pide la mejora 8.3 — un mes sin gasto en una categoría cuenta como 0, no
// se ignora.
export function mediaPorCategoriaEnRango(
  porCategoriaYMes: Map<string, Map<string, number>>,
  mesesEnRango: number
): MediaPorCategoria[] {
  if (mesesEnRango <= 0) return [];

  return Array.from(porCategoriaYMes.entries())
    .map(([categoriaId, porMes]) => {
      const total = Array.from(porMes.values()).reduce((s, v) => s + v, 0);
      return { categoriaId, total, media: total / mesesEnRango };
    })
    .sort((a, b) => b.media - a.media);
}

export type FilaPrevistoVsReal = { categoriaId: string; previsto: number; real: number };

// Une, categoría a categoría, lo previsto (motor real de previsión, no un cálculo
// aparte) y lo real de un mes concreto — incluye una categoría aunque solo tenga uno
// de los dos lados, para no ocultar ni previsiones sin gasto real ni gastos reales
// sin previsión.
export function previstoVsRealPorCategoria(
  previstoPorCategoria: Map<string, number>,
  realPorCategoria: Map<string, number>
): FilaPrevistoVsReal[] {
  const categorias = new Set([...previstoPorCategoria.keys(), ...realPorCategoria.keys()]);

  return Array.from(categorias).map((categoriaId) => ({
    categoriaId,
    previsto: previstoPorCategoria.get(categoriaId) ?? 0,
    real: realPorCategoria.get(categoriaId) ?? 0,
  }));
}

// Resuelve qué cuentas están seleccionadas para el filtro de informes/planificador/
// prevision/home: si la URL trae el parámetro "cuentas" (ids separados por coma) manda
// sobre cualquier otra cosa; si no, se aplica la preferencia guardada (lista de cuentas
// EXCLUIDAS) sobre las cuentas activas actuales — así una cuenta activa nueva aparece
// seleccionada por defecto aunque el usuario ya hubiera personalizado la selección antes
// de crearla. Solo se devuelven ids que sigan existiendo entre las cuentas activas.
export function resolverCuentasSeleccionadas(
  idsCuentasActivas: string[],
  paramCuentasURL: string | undefined,
  idsExcluidosGuardados: string[]
): Set<string> {
  if (paramCuentasURL !== undefined) {
    const idsURL = new Set(paramCuentasURL.split(",").filter(Boolean));
    return new Set(idsCuentasActivas.filter((id) => idsURL.has(id)));
  }
  const excluidos = new Set(idsExcluidosGuardados);
  return new Set(idsCuentasActivas.filter((id) => !excluidos.has(id)));
}

// Filtra movimientos según la selección de cuentas activa, resolviendo el caso de los
// traspasos entre cuentas propias (enlazados por traspaso_grupo_id, uno por cuenta):
// - Si TODAS las cuentas del grupo de traspaso están dentro de la selección, el
//   traspaso se descarta (neto cero, como si no existiera — no es ni gasto ni ingreso).
// - Si la cuenta del movimiento está seleccionada pero alguna otra cuenta del grupo NO
//   lo está (o no se encuentra su pareja en absoluto), el dinero sale/entra del
//   conjunto de cuentas que se está mirando: se trata como un gasto real (importe
//   negativo) o un ingreso real (importe positivo), cambiando su `tipo` en consecuencia.
// - Los movimientos de cuentas no seleccionadas se descartan siempre.
// Invariante del resultado: nunca queda ningún movimiento con tipo "traspaso" — todos
// los que sobreviven han quedado reclasificados como "ingreso" o "gasto".
export function filtrarMovimientosPorCuentasSeleccionadas<
  T extends { cuenta_id: string; tipo: string; importe: number; traspaso_grupo_id: string | null }
>(movimientos: T[], idsCuentasSeleccionadas: ReadonlySet<string>): T[] {
  const cuentasPorGrupo = new Map<string, Set<string>>();
  for (const m of movimientos) {
    if (m.tipo !== "traspaso" || !m.traspaso_grupo_id) continue;
    if (!cuentasPorGrupo.has(m.traspaso_grupo_id)) cuentasPorGrupo.set(m.traspaso_grupo_id, new Set());
    cuentasPorGrupo.get(m.traspaso_grupo_id)!.add(m.cuenta_id);
  }

  const resultado: T[] = [];
  for (const m of movimientos) {
    if (!idsCuentasSeleccionadas.has(m.cuenta_id)) continue;

    if (m.tipo !== "traspaso") {
      resultado.push(m);
      continue;
    }

    const otrasCuentasDelGrupo = m.traspaso_grupo_id
      ? Array.from(cuentasPorGrupo.get(m.traspaso_grupo_id) ?? []).filter((c) => c !== m.cuenta_id)
      : [];
    const parejaTambienSeleccionada =
      otrasCuentasDelGrupo.length > 0 && otrasCuentasDelGrupo.every((c) => idsCuentasSeleccionadas.has(c));
    if (parejaTambienSeleccionada) continue;

    const tipoEfectivo = Number(m.importe) >= 0 ? "ingreso" : "gasto";
    resultado.push({ ...m, tipo: tipoEfectivo } as T);
  }
  return resultado;
}

// Ahorro de un mes concreto (real o previsto, misma fórmula que el dashboard).
// `aportacionInversionDelMes` va siempre en positivo (cuánto se aportó ese mes); el
// flujo neto ya la incluye restada como si fuera un gasto más, así que si la
// aportación cuenta como ahorro se le suma de vuelta para que no reste dos veces.
export function ahorroDelMes(
  flujoNeto: number,
  aportacionInversionDelMes: number,
  incluirInversionEnAhorro: boolean
): number {
  return incluirInversionEnAhorro ? flujoNeto + aportacionInversionDelMes : flujoNeto;
}
