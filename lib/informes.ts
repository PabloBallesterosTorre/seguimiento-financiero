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

// Cómo se traduce una fecha al mes al que pertenece ("YYYY-MM"). Por defecto es el mes
// natural; con el mes financiero activo se pasa `mesDe` de lib/mesFinanciero, que ancla
// la frontera en la nómina. Se inyecta en vez de importarse para que estas funciones
// sigan siendo puras y comprobables sin configuración.
export type MesDeFecha = (fecha: string) => string;

export const MES_NATURAL: MesDeFecha = (fecha) => fecha.slice(0, 7);

// Total absoluto por categoría padre y por mes ("YYYY-MM"), para un tipo (ingreso o
// gasto) concreto. Sirve de base tanto para la media del periodo (8.3, dividiendo el
// total entre el número de meses del rango) como para la serie mensual (8.4).
export function agruparPorCategoriaPadreYMes(
  movimientos: MovimientoParaInforme[],
  tipo: "ingreso" | "gasto",
  categoriaEfectiva: (categoriaId: string) => string,
  mesDe: MesDeFecha = MES_NATURAL
): Map<string, Map<string, number>> {
  const resultado = new Map<string, Map<string, number>>();

  for (const m of movimientos) {
    if (m.tipo !== tipo || !m.categoria_id) continue;
    const categoriaId = categoriaEfectiva(m.categoria_id);
    const mesKey = mesDe(m.fecha);
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

// ============================================================================
// Tanda 12: neto por categoría
// ============================================================================

// Id ficticio bajo el que se agrupan los movimientos que no tienen categoría. No se
// descartan: si desaparecieran, las dos mitades de "en qué se va y de dónde viene" no
// cuadrarían con el flujo mensual y el usuario no tendría forma de saber por qué faltan.
// Verlo también sirve de recordatorio de lo que queda por categorizar.
export const SIN_CATEGORIA = "__sin_categoria__";

export type NetoCategoria = {
  categoriaId: string;
  // Lo que salió y lo que entró en esa categoría, ambos en positivo.
  salidas: number;
  entradas: number;
  // salidas − entradas. Positivo = gasto neto; negativo = ingreso neto.
  neto: number;
  // Cuántos movimientos van en contra del signo dominante. Sirve para distinguir un
  // reembolso puntual de una categoría que de verdad va en los dos sentidos.
  movimientosContrarios: number;
};

// Agrupa por categoría padre NETEANDO entradas contra salidas, en vez de tratarlas como
// dos cosas distintas.
//
// Sin netear, los datos reales mienten: la categoría "Restaurantes" tiene 2.371,60 € de
// gastos y 1.016,64 € de "ingresos", que no son ingresos sino los Bizums de la gente
// cuando paga uno la cena. En un gráfico de "de dónde vienen mis ingresos", Restaurantes
// aparecía como la segunda fuente de ingresos del usuario. Neteado, es lo que es: 1.354,96 €
// de gasto real.
//
// Los traspasos ya vienen resueltos de `filtrarMovimientosPorCuentasSeleccionadas` (o
// eliminados, o convertidos en ingreso/gasto según el lado que esté en la selección), así
// que aquí se tratan como cualquier otro movimiento.
export function netoPorCategoria(
  movimientos: MovimientoParaInforme[],
  categoriaEfectiva: (categoriaId: string) => string
): NetoCategoria[] {
  const acumulado = new Map<string, { salidas: number; entradas: number }>();

  for (const m of movimientos) {
    const categoriaId = m.categoria_id ? categoriaEfectiva(m.categoria_id) : SIN_CATEGORIA;
    if (!acumulado.has(categoriaId)) acumulado.set(categoriaId, { salidas: 0, entradas: 0 });

    const acc = acumulado.get(categoriaId)!;
    const importe = Number(m.importe);
    if (importe < 0) acc.salidas += -importe;
    else acc.entradas += importe;
  }

  const filas: NetoCategoria[] = [];
  for (const [categoriaId, { salidas, entradas }] of acumulado) {
    const neto = salidas - entradas;
    // Los contrarios son los del signo que NO domina: si la categoría es gasto neto, los
    // contrarios son las entradas, y al revés.
    const movimientosContrarios = movimientos.filter((m) => {
      const suya = m.categoria_id ? categoriaEfectiva(m.categoria_id) : SIN_CATEGORIA;
      if (suya !== categoriaId) return false;
      return neto >= 0 ? Number(m.importe) > 0 : Number(m.importe) < 0;
    }).length;

    filas.push({ categoriaId, salidas, entradas, neto, movimientosContrarios });
  }

  return filas;
}

// Separa el resultado anterior en las dos mitades que pide la pantalla: en qué se va el
// dinero y de dónde viene. Una categoría cae en un lado u otro según su NETO, nunca en los
// dos: si de "Restaurantes" salen 2.371 € y entran 1.016 €, es un gasto, no las dos cosas.
//
// Se descartan las categorías cuyo neto redondea a cero: normalmente son traspasos mal
// clasificados o reembolsos exactos, y añaden una barra de 0,00 € que no dice nada.
export function separarGastosEIngresos(filas: NetoCategoria[]): {
  gastos: NetoCategoria[];
  ingresos: NetoCategoria[];
} {
  const significativas = filas.filter((f) => Math.abs(f.neto) >= 0.005);

  return {
    gastos: significativas.filter((f) => f.neto > 0).sort((a, b) => b.neto - a.neto),
    ingresos: significativas
      .filter((f) => f.neto < 0)
      .map((f) => ({ ...f, neto: -f.neto }))
      .sort((a, b) => b.neto - a.neto),
  };
}

// ============================================================================
// Tanda 12: cómo va el mes en curso
// ============================================================================

export type ComoVaElMes = {
  // Lo acumulado desde el cierre del mes anterior hasta hoy: exactamente "cuánto más (o
  // menos) tengo ahora que en el último movimiento antes de cobrar la nómina".
  acumulado: number;
  diasTranscurridos: number;
  // El mismo número en el mes anterior, contando los MISMOS días desde su arranque. Es la
  // única comparación justa a mitad de mes: comparar 21 días contra un mes entero diría
  // que siempre vas mejor.
  mismoPuntoMesAnterior: number | null;
  // Con cuánto cerró el mes anterior. Va aparte del anterior a propósito: en agosto de
  // 2026 este usuario iba en +40,44 € a día 21 y cerró en −1.370,48 €, porque todo el
  // gasto se concentró en los últimos ocho días. Enseñar solo uno de los dos números
  // engaña.
  cierreMesAnterior: number | null;
};

function diasEntre(desde: string, hasta: string): number {
  return Math.round(
    (new Date(`${hasta}T00:00:00Z`).getTime() - new Date(`${desde}T00:00:00Z`).getTime()) / 86400000
  );
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function sumaEntre(movimientos: { fecha: string; importe: number }[], desde: string, hasta: string): number {
  return movimientos
    .filter((m) => m.fecha >= desde && m.fecha <= hasta)
    .reduce((s, m) => s + Number(m.importe), 0);
}

// Responde a "¿cuánto me sobra este mes y voy mejor o peor que el anterior?".
//
// Los movimientos deben venir ya filtrados por ámbito (ver
// filtrarMovimientosPorCuentasSeleccionadas), que además anula los traspasos internos: así
// el dinero que pasa de lo personal a lo común sale como gasto de un lado e ingreso del
// otro, y al mirarlo todo junto se cancela.
export function comoVaElMes(params: {
  movimientos: { fecha: string; importe: number }[];
  inicioMesActual: string;
  hoy: string;
  inicioMesAnterior: string | null;
  finMesAnterior: string | null;
}): ComoVaElMes {
  const { movimientos, inicioMesActual, hoy, inicioMesAnterior, finMesAnterior } = params;

  const acumulado = sumaEntre(movimientos, inicioMesActual, hoy);
  const diasTranscurridos = Math.max(diasEntre(inicioMesActual, hoy), 0);

  if (!inicioMesAnterior || !finMesAnterior) {
    return { acumulado, diasTranscurridos, mismoPuntoMesAnterior: null, cierreMesAnterior: null };
  }

  // El mismo punto del mes anterior nunca se pasa de su cierre: si el mes anterior fue más
  // corto que los días que ya llevamos, se compara contra su cierre y no contra días que
  // pertenecían ya al mes siguiente.
  const mismoPuntoBruto = sumarDias(inicioMesAnterior, diasTranscurridos);
  const mismoPunto = mismoPuntoBruto > finMesAnterior ? finMesAnterior : mismoPuntoBruto;

  return {
    acumulado,
    diasTranscurridos,
    mismoPuntoMesAnterior: sumaEntre(movimientos, inicioMesAnterior, mismoPunto),
    cierreMesAnterior: sumaEntre(movimientos, inicioMesAnterior, finMesAnterior),
  };
}
