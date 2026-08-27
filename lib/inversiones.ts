// Tanda 8, mejora 2b/2c: evolución diaria interpolada de una inversión y proyección
// futura con rentabilidad asumida. No hay dato de mercado diario real (eso es fase 2,
// vía Stooq/CoinGecko) — mientras tanto, se combina lo barato de la actualización
// manual (puntos reales en inversion_valoraciones) con una curva coherente entre
// ellos, usando la rentabilidad anual asumida en vez de una línea recta simple.

export type ValoracionInversion = { fecha: string; valor: number };
export type PuntoEvolucionInversion = { fecha: string; valor: number; esReal: boolean };

const DIA_MS = 24 * 60 * 60 * 1000;
const MAX_PUNTOS_INTERMEDIOS = 60; // limita el nº de puntos interpolados por tramo, para no saturar el gráfico en tramos muy largos

function diasEntre(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DIA_MS);
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function tasaDiaria(rentabilidadAnualPct: number): number {
  return Math.pow(1 + rentabilidadAnualPct / 100, 1 / 365) - 1;
}

// Construye la serie de evolución diaria de una inversión: los puntos reales
// (valoraciones manuales) se devuelven tal cual; entre dos puntos reales
// consecutivos se interpola con una curva geométrica que conecta exactamente ambos
// valores (nunca se inventa un valor final distinto del siguiente dato real); desde
// el último punto real hasta hoy, al no haber un segundo extremo con el que conectar,
// se extrapola componiendo la rentabilidad anual asumida (o se mantiene plano si la
// inversión no tiene rentabilidad asumida). Todo punto que no sea un dato guardado
// tal cual queda marcado esReal:false para que la interfaz lo distinga como estimación.
export function construirEvolucionInversion(
  valoraciones: ValoracionInversion[],
  rentabilidadAnualAsumida: number | null,
  hoy: string
): PuntoEvolucionInversion[] {
  const reales = [...valoraciones].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  if (reales.length === 0) return [];

  const puntos: PuntoEvolucionInversion[] = [];

  for (let i = 0; i < reales.length; i++) {
    puntos.push({ fecha: reales[i].fecha, valor: reales[i].valor, esReal: true });

    const siguiente = reales[i + 1];
    if (!siguiente) continue;

    const dias = diasEntre(reales[i].fecha, siguiente.fecha);
    if (dias <= 1) continue;

    const ratioTotal = reales[i].valor !== 0 ? siguiente.valor / reales[i].valor : 1;
    const pasos = Math.min(dias - 1, MAX_PUNTOS_INTERMEDIOS);
    const paso = Math.max(1, Math.floor(dias / (pasos + 1)));
    for (let d = paso; d < dias; d += paso) {
      const valor = reales[i].valor * Math.pow(ratioTotal, d / dias);
      puntos.push({ fecha: sumarDias(reales[i].fecha, d), valor, esReal: false });
    }
  }

  const ultimo = reales[reales.length - 1];
  const diasHastaHoy = diasEntre(ultimo.fecha, hoy);
  if (diasHastaHoy > 0) {
    const tasa = rentabilidadAnualAsumida ? tasaDiaria(rentabilidadAnualAsumida) : 0;
    const pasos = Math.min(diasHastaHoy, MAX_PUNTOS_INTERMEDIOS);
    const paso = Math.max(1, Math.floor(diasHastaHoy / pasos));
    for (let d = paso; d < diasHastaHoy; d += paso) {
      puntos.push({ fecha: sumarDias(ultimo.fecha, d), valor: ultimo.valor * Math.pow(1 + tasa, d), esReal: false });
    }
    puntos.push({ fecha: hoy, valor: ultimo.valor * Math.pow(1 + tasa, diasHastaHoy), esReal: false });
  }

  return puntos;
}

// Proyecta, mes a mes, el valor futuro de una inversión (o del conjunto, con una
// rentabilidad ponderada): compone la rentabilidad anual asumida sobre el valor ya
// acumulado y suma, cada mes, la aportación recurrente de ese mes (que empieza a
// componer desde el mes siguiente) — misma lógica que ya usa lib/planificador.ts
// para deuda, reutilizada aquí para que el criterio de "proyección estimada" sea
// consistente en toda la app.
export function proyectarValorInversion(params: {
  valorInicial: number;
  rentabilidadAnualAsumida: number | null;
  aportacionMensual: number;
  meses: number;
}): number[] {
  const { valorInicial, rentabilidadAnualAsumida, aportacionMensual, meses } = params;
  const tasaMensual = rentabilidadAnualAsumida ? Math.pow(1 + rentabilidadAnualAsumida / 100, 1 / 12) - 1 : 0;

  let valor = valorInicial;
  const serie: number[] = [];
  for (let i = 0; i < meses; i++) {
    valor = valor * (1 + tasaMensual) + aportacionMensual;
    serie.push(valor);
  }
  return serie;
}

// Rentabilidad anual asumida ponderada por valor actual, para cuando El Planificador
// necesita un único porcentaje que representar al conjunto de todas las inversiones
// del usuario (la proyección agregada de patrimonio no distingue instrumento a
// instrumento). Una inversión sin rentabilidad asumida cuenta con un 0% en la media,
// no se excluye — omitirla sobreestimaría el conjunto.
export function rentabilidadPonderada(inversiones: { valor_actual: number; rentabilidad_anual_asumida: number | null }[]): number | null {
  const totalValor = inversiones.reduce((s, i) => s + i.valor_actual, 0);
  if (totalValor <= 0) return null;
  const sumaPonderada = inversiones.reduce((s, i) => s + i.valor_actual * (i.rentabilidad_anual_asumida ?? 0), 0);
  return sumaPonderada / totalValor;
}
