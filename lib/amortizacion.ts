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

export type ResultadoAmortizacionExtra = {
  antes: ResultadoSimulacion;
  despues: ResultadoSimulacion;
  cuotaNueva: number | null;
  ahorroIntereses: number;
  mesesAhorrados: number;
};

export function simularAmortizacionExtra(params: {
  saldoActual: number;
  tasaAnual: number;
  cuotaActual: number;
  valorResidual: number;
  importeExtra: number;
  recurrencia: Recurrencia;
  tipoReduccion: TipoReduccion;
}): ResultadoAmortizacionExtra {
  const { saldoActual, tasaAnual, cuotaActual, valorResidual, importeExtra, recurrencia, tipoReduccion } = params;

  const antes = simularAmortizacion(saldoActual, tasaAnual, cuotaActual, valorResidual);

  let despues: ResultadoSimulacion;
  let cuotaNueva: number | null = null;

  if (recurrencia === "puntual") {
    const nuevoSaldo = Math.max(saldoActual - importeExtra, valorResidual);

    if (tipoReduccion === "reducir_cuota") {
      cuotaNueva = calcularCuota(nuevoSaldo, tasaAnual, antes.mesesRestantes, valorResidual);
      despues = simularAmortizacion(nuevoSaldo, tasaAnual, cuotaNueva, valorResidual);
    } else {
      despues = simularAmortizacion(nuevoSaldo, tasaAnual, cuotaActual, valorResidual);
    }
  } else {
    despues = simularAmortizacion(saldoActual, tasaAnual, cuotaActual, valorResidual, {
      extraRecurrente: importeExtra,
      frecuenciaExtra: recurrencia,
    });
  }

  return {
    antes,
    despues,
    cuotaNueva,
    ahorroIntereses: antes.interesesTotales - despues.interesesTotales,
    mesesAhorrados: antes.mesesRestantes - despues.mesesRestantes,
  };
}
