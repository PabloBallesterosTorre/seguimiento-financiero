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

// ============================================================================
// Tanda 10: rentabilidad real a partir del libro de operaciones.
//
// Hasta aquí este módulo solo sabía proyectar con la rentabilidad ASUMIDA. Con las
// operaciones registradas (lib: inversion_operaciones) ya se puede calcular la real.
// ============================================================================

export type OperacionInversion = {
  fecha: string;
  tipo: "compra" | "venta" | "aportacion" | "retirada" | "dividendo" | "ajuste";
  // Efectivo visto desde la inversión: positivo si entra en ella, negativo si sale.
  importe: number;
  participaciones: number | null;
  precio: number | null;
};

export type PosicionInversion = {
  participaciones: number;
  // Flujo de caja neto: lo aportado menos lo retirado. No es el coste fiscal de lo que
  // queda en cartera (ver el comentario de coste_neto en la migración 0022).
  aportadoNeto: number;
  // Media ponderada del precio pagado en las COMPRAS, que es lo que el usuario entiende
  // por "a cuánto me salió". Null si la inversión no se mide en participaciones.
  precioMedioCompra: number | null;
  valorMercado: number;
  // Ganancia total: realizada (lo ya vendido) + latente (lo que sigue en cartera).
  ganancia: number;
  // Ganancia sobre lo aportado, sin tener en cuenta cuánto tiempo llevaba dentro cada
  // euro. Es la cifra intuitiva, pero engaña con aportaciones periódicas: para eso está
  // la TIR. Null si no se ha aportado nada (no hay sobre qué calcular un porcentaje).
  rentabilidadSimple: number | null;
};

export function calcularPosicion(operaciones: OperacionInversion[], valorMercado: number): PosicionInversion {
  let participaciones = 0;
  let aportadoNeto = 0;
  let costeCompras = 0;
  let participacionesCompradas = 0;

  for (const op of operaciones) {
    participaciones += op.participaciones ?? 0;
    aportadoNeto += op.importe;
    if (op.importe > 0 && (op.participaciones ?? 0) > 0) {
      costeCompras += op.importe;
      participacionesCompradas += op.participaciones!;
    }
  }

  const ganancia = valorMercado - aportadoNeto;

  return {
    participaciones,
    aportadoNeto,
    precioMedioCompra: participacionesCompradas > 0 ? costeCompras / participacionesCompradas : null,
    valorMercado,
    ganancia,
    rentabilidadSimple: aportadoNeto > 0 ? (ganancia / aportadoNeto) * 100 : null,
  };
}

export type FlujoTIR = { fecha: string; importe: number };

// TIR anualizada (XIRR): la tasa anual a la que habría que descontar todos los flujos —
// cada aportación, cada retirada y el valor de mercado de hoy como flujo final — para
// que su valor presente sea cero.
//
// Por qué hace falta, y no basta con "ganancia / aportado": con un plan de ahorro, cada
// euro lleva dentro un tiempo distinto. 20 €/semana durante un año en un fondo que sube
// un 10% da una rentabilidad simple de ~5%, porque la mitad del dinero entró en los
// últimos meses. Ese 5% no es la rentabilidad del fondo ni la del ahorrador: es un
// artefacto de mezclar importes con antigüedades distintas. La TIR sí es comparable con
// el "X% anual" de cualquier otro producto.
//
// Se resuelve por Newton-Raphson, con bisección de respaldo cuando la derivada se acerca
// a cero o la iteración se va de rango (pasa con series cortas y muy volátiles). Devuelve
// null si el problema no tiene solución con sentido: sin flujos de los dos signos no hay
// ninguna tasa que anule el valor presente.
export function tirAnualizada(flujos: FlujoTIR[]): number | null {
  const relevantes = flujos.filter((f) => f.importe !== 0);
  if (relevantes.length < 2) return null;

  const hayPositivos = relevantes.some((f) => f.importe > 0);
  const hayNegativos = relevantes.some((f) => f.importe < 0);
  if (!hayPositivos || !hayNegativos) return null;

  const ordenados = [...relevantes].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const inicio = ordenados[0].fecha;
  const años = ordenados.map((f) => diasEntre(inicio, f.fecha) / 365);

  // Todos los flujos el mismo día: no hay plazo sobre el que anualizar nada.
  if (años[años.length - 1] === 0) return null;

  const van = (tasa: number): number =>
    ordenados.reduce((suma, f, i) => suma + f.importe / Math.pow(1 + tasa, años[i]), 0);

  const derivada = (tasa: number): number =>
    ordenados.reduce((suma, f, i) => suma - (años[i] * f.importe) / Math.pow(1 + tasa, años[i] + 1), 0);

  let tasa = 0.1;
  for (let i = 0; i < 50; i++) {
    const valor = van(tasa);
    if (Math.abs(valor) < 1e-7) return tasa * 100;
    const d = derivada(tasa);
    if (!Number.isFinite(d) || Math.abs(d) < 1e-10) break;
    const siguiente = tasa - valor / d;
    if (!Number.isFinite(siguiente) || siguiente <= -0.999999) break;
    if (Math.abs(siguiente - tasa) < 1e-10) return siguiente * 100;
    tasa = siguiente;
  }

  // Respaldo: bisección sobre un rango amplio (de −99,9% a +1000% anual). Es más lenta
  // pero no se escapa, siempre que el VAN cambie de signo dentro del intervalo.
  let bajo = -0.999;
  let alto = 10;
  let vanBajo = van(bajo);
  if (!Number.isFinite(vanBajo)) return null;
  if (vanBajo * van(alto) > 0) return null;

  for (let i = 0; i < 200; i++) {
    const medio = (bajo + alto) / 2;
    const vanMedio = van(medio);
    if (Math.abs(vanMedio) < 1e-9 || alto - bajo < 1e-12) return medio * 100;
    if (vanBajo * vanMedio < 0) {
      alto = medio;
    } else {
      bajo = medio;
      vanBajo = vanMedio;
    }
  }

  return ((bajo + alto) / 2) * 100;
}

// Prepara los flujos de una inversión para la TIR: cada operación con el signo que tiene
// para el bolsillo del inversor (una compra es dinero que SALE, así que entra como
// negativa) más el valor de mercado de hoy como si se liquidara la posición entera.
export function flujosParaTIR(operaciones: OperacionInversion[], valorMercado: number, hoy: string): FlujoTIR[] {
  const flujos: FlujoTIR[] = operaciones.map((op) => ({ fecha: op.fecha, importe: -op.importe }));
  if (valorMercado !== 0) flujos.push({ fecha: hoy, importe: valorMercado });
  return flujos;
}

// Serie mensual de valor de mercado frente a aportado acumulado, que es el gráfico que
// de verdad responde a "¿estoy ganando dinero?": la distancia entre las dos líneas es la
// ganancia. El valor se toma de la última valoración conocida en cada mes (sin inventar
// nada por delante del primer dato real) y lo aportado, de las operaciones.
export type PuntoCartera = { mes: string; valor: number; aportado: number };

export function construirSerieCartera(
  valoracionesPorInversion: { inversionId: string; fecha: string; valor: number }[],
  operaciones: { fecha: string; importe: number }[],
  meses: string[]
): PuntoCartera[] {
  const ordenadas = [...valoracionesPorInversion].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));

  return meses.map((mes) => {
    // "-31" no es una fecha real en todos los meses, pero aquí solo se usa para comparar
    // cadenas ISO: cualquier día de ese mes es <= "AAAA-MM-31" y cualquier día posterior
    // es mayor. Evita tener que calcular el último día real de cada mes.
    const finDeMes = `${mes}-31`;

    // Última valoración conocida de cada inversión hasta el final de ese mes. Una
    // inversión que todavía no existía en ese mes simplemente no suma.
    const ultimaPorInversion = new Map<string, number>();
    for (const v of ordenadas) {
      if (v.fecha <= finDeMes) ultimaPorInversion.set(v.inversionId, v.valor);
    }

    const valor = [...ultimaPorInversion.values()].reduce((s, v) => s + v, 0);
    const aportado = operaciones.filter((o) => o.fecha <= finDeMes).reduce((s, o) => s + o.importe, 0);

    return { mes, valor, aportado };
  });
}

// Lista de meses "AAAA-MM" entre dos fechas, ambas incluidas. La usa el cuadro de mando
// para cubrir desde la primera operación de la cartera hasta hoy.
export function mesesEntre(desde: string, hasta: string): string[] {
  const meses: string[] = [];
  let year = Number(desde.slice(0, 4));
  let month = Number(desde.slice(5, 7));
  const fin = hasta.slice(0, 7);

  while (meses.length < 600) {
    const mes = `${year}-${String(month).padStart(2, "0")}`;
    if (mes > fin) break;
    meses.push(mes);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return meses;
}
