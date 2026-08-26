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
