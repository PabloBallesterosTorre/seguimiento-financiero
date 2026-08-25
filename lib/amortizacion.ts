// Cálculos de amortización (sistema francés: cuota constante, la parte de interés
// baja y la de capital sube en cada periodo). Soporta valor residual (financiación
// con pago final, típico en coches) como suelo en vez de cero.

export type FilaAmortizacion = {
  mes: number;
  interes: number;
  principal: number;
  saldo: number;
};

export type ResultadoSimulacion = {
  filas: FilaAmortizacion[];
  mesesRestantes: number;
  interesesTotales: number;
  cuotaNoCubreIntereses: boolean;
};

export type Recurrencia = "puntual" | "mensual" | "anual";
export type TipoReduccion = "reducir_cuota" | "reducir_plazo";

export function simularAmortizacion(
  saldoInicial: number,
  tasaAnual: number,
  cuota: number,
  valorResidual = 0,
  opciones?: { extraRecurrente?: number; frecuenciaExtra?: "mensual" | "anual" },
  maxMeses = 600
): ResultadoSimulacion {
  const tasaMensual = tasaAnual / 100 / 12;
  let saldo = saldoInicial;
  const filas: FilaAmortizacion[] = [];
  let interesesTotales = 0;
  let cuotaNoCubreIntereses = false;
  let mes = 0;

  while (saldo > valorResidual + 0.01 && mes < maxMeses) {
    mes++;
    const interes = saldo * tasaMensual;
    let reduccion = cuota - interes;

    if (reduccion <= 0) {
      cuotaNoCubreIntereses = true;
      break;
    }

    if (opciones?.extraRecurrente) {
      if (opciones.frecuenciaExtra === "mensual") reduccion += opciones.extraRecurrente;
      else if (opciones.frecuenciaExtra === "anual" && mes % 12 === 0) reduccion += opciones.extraRecurrente;
    }

    if (saldo - reduccion < valorResidual) {
      reduccion = saldo - valorResidual;
    }

    saldo = Math.max(saldo - reduccion, valorResidual);
    interesesTotales += interes;
    filas.push({ mes, interes, principal: reduccion, saldo });
  }

  return { filas, mesesRestantes: filas.length, interesesTotales, cuotaNoCubreIntereses };
}

// Cuota de una anualidad (sistema francés) con valor residual opcional.
export function calcularCuota(saldo: number, tasaAnual: number, meses: number, valorResidual = 0): number {
  if (meses <= 0) return 0;
  const i = tasaAnual / 100 / 12;
  if (i === 0) return (saldo - valorResidual) / meses;

  const factor = Math.pow(1 + i, -meses);
  return ((saldo - valorResidual * factor) * i) / (1 - factor);
}

export type AmortizacionProgramada = {
  fecha: string; // ISO AAAA-MM-DD
  importe: number;
  tipoReduccion: TipoReduccion;
};

export type ResultadoSimulacionProgramada = ResultadoSimulacion & {
  cuotaFinal: number;
};

function sumarMeses(fechaISO: string, n: number): Date {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  return new Date(anio, mes - 1 + n, dia);
}

function anioMes(fecha: Date): number {
  return fecha.getFullYear() * 12 + fecha.getMonth();
}

// Simula la amortización desde `fechaInicio`, aplicando cada amortización
// programada en el mes en que cae su fecha (antes de la cuota normal de ese mes),
// encadenadas en orden cronológico: el capital pendiente antes de cada una es el
// resultante de aplicar todas las anteriores. Con la lista vacía equivale a
// `simularAmortizacion` sin extras.
export function simularConProgramadas(
  saldoInicial: number,
  tasaAnual: number,
  cuotaInicial: number,
  valorResidual: number,
  fechaInicio: string,
  amortizacionesProgramadas: AmortizacionProgramada[],
  maxMeses = 600
): ResultadoSimulacionProgramada {
  const tasaMensual = tasaAnual / 100 / 12;
  const eventos = [...amortizacionesProgramadas].sort((a, b) => a.fecha.localeCompare(b.fecha));

  let saldo = saldoInicial;
  let cuota = cuotaInicial;
  let indiceEvento = 0;
  let interesesTotales = 0;
  let cuotaNoCubreIntereses = false;
  const filas: FilaAmortizacion[] = [];
  let mes = 0;

  while (saldo > valorResidual + 0.01 && mes < maxMeses) {
    mes++;
    const fechaCursor = anioMes(sumarMeses(fechaInicio, mes));

    while (indiceEvento < eventos.length && anioMes(new Date(eventos[indiceEvento].fecha)) <= fechaCursor) {
      const evento = eventos[indiceEvento];
      const mesesRestantesAntes = simularAmortizacion(saldo, tasaAnual, cuota, valorResidual).mesesRestantes;
      saldo = Math.max(saldo - evento.importe, valorResidual);
      if (evento.tipoReduccion === "reducir_cuota") {
        cuota = calcularCuota(saldo, tasaAnual, mesesRestantesAntes, valorResidual);
      }
      indiceEvento++;
    }

    if (saldo <= valorResidual + 0.01) break;

    const interes = saldo * tasaMensual;
    let principal = cuota - interes;

    if (principal <= 0) {
      cuotaNoCubreIntereses = true;
      break;
    }

    if (saldo - principal < valorResidual) principal = saldo - valorResidual;

    saldo = Math.max(saldo - principal, valorResidual);
    interesesTotales += interes;
    filas.push({ mes, interes, principal, saldo });
  }

  return { filas, mesesRestantes: filas.length, interesesTotales, cuotaNoCubreIntereses, cuotaFinal: cuota };
}
