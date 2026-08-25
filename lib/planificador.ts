import { importeEfectivoPrevisto, previstoAplicaEnMes, type MovimientoPrevisto } from "./prevision";
import { simularConProgramadas, type TipoReduccion } from "./amortizacion";

export type DeudaParaProyeccion = {
  id: string;
  capital_pendiente: number;
  cuota: number;
  tipo_interes: number | null;
  valor_residual: number;
};

export type AmortizacionProgramadaDeuda = {
  deuda_id: string;
  fecha: string;
  importe: number;
  tipoReduccion: TipoReduccion;
};

export type MesProyeccion = { year: number; month: number; label: string };

export type PuntoProyeccion = {
  year: number;
  month: number;
  label: string;
  flujoNeto: number;
  saldoLiquido: number;
  deudaPendiente: number;
  valorInversion: number;
  patrimonioConDeuda: number;
  patrimonioSinDeuda: number;
};

// Proyecta, mes a mes, el flujo de caja (previstos + intereses de cuentas
// remuneradas), el capital pendiente de cada deuda (vía simularConProgramadas, con
// las amortizaciones ya planificadas) y el valor de inversión (partiendo del valor
// actual y sumando las aportaciones previstas categorizadas como inversión — sin
// asumir ninguna rentabilidad futura, solo lo que se sabe que se va a aportar).
// El capital pendiente de cada mes usa el mismo índice relativo que el resto de la
// previsión (mes 0 = mes actual), igual que ya hace el simulador de amortización —
// no pretende una sincronía exacta día a día entre el cargo de la cuota y el resto
// del flujo de caja de ese mes.
export function construirProyeccionPatrimonio(params: {
  meses: MesProyeccion[];
  fechaInicio: string;
  saldoLiquidoInicial: number;
  valorInversionInicial: number;
  previstos: MovimientoPrevisto[];
  interesesPorMes: Map<string, number>;
  deudas: DeudaParaProyeccion[];
  amortizacionesProgramadas: AmortizacionProgramadaDeuda[];
  esCategoriaInversion: (categoriaId: string | null) => boolean;
  mediaPorCategoria?: Map<string, number>;
}): PuntoProyeccion[] {
  const {
    meses,
    fechaInicio,
    saldoLiquidoInicial,
    valorInversionInicial,
    previstos,
    interesesPorMes,
    deudas,
    amortizacionesProgramadas,
    esCategoriaInversion,
    mediaPorCategoria = new Map(),
  } = params;

  const deudaPorMes = deudas.map((deuda) => {
    const programadas = amortizacionesProgramadas
      .filter((a) => a.deuda_id === deuda.id)
      .map((a) => ({ fecha: a.fecha, importe: a.importe, tipoReduccion: a.tipoReduccion }));

    const resultado = simularConProgramadas(
      deuda.capital_pendiente,
      deuda.tipo_interes ?? 0,
      deuda.cuota,
      deuda.valor_residual,
      fechaInicio,
      programadas,
      meses.length
    );

    return { filas: resultado.filas.map((f) => f.saldo), capitalInicial: deuda.capital_pendiente };
  });

  let saldoLiquido = saldoLiquidoInicial;
  let valorInversion = valorInversionInicial;

  return meses.map((mes, i) => {
    const aplicables = previstos.filter((p) => p.tipo !== "traspaso" && previstoAplicaEnMes(p, mes.year, mes.month));
    let flujoNeto = interesesPorMes.get(`${mes.year}-${mes.month}`) ?? 0;
    let aportacionInversion = 0;

    for (const p of aplicables) {
      const importe = importeEfectivoPrevisto(p, mediaPorCategoria);
      const signo = p.tipo === "ingreso" ? 1 : -1;
      flujoNeto += signo * importe;
      if (p.tipo === "gasto" && esCategoriaInversion(p.categoria_id)) {
        aportacionInversion += importe;
      }
    }

    saldoLiquido += flujoNeto;
    valorInversion += aportacionInversion;

    const deudaPendiente = deudaPorMes.reduce((suma, d) => {
      const saldo = d.filas[i] ?? d.filas[d.filas.length - 1] ?? d.capitalInicial;
      return suma + saldo;
    }, 0);

    return {
      year: mes.year,
      month: mes.month,
      label: mes.label,
      flujoNeto,
      saldoLiquido,
      deudaPendiente,
      valorInversion,
      patrimonioConDeuda: saldoLiquido + valorInversion - deudaPendiente,
      patrimonioSinDeuda: saldoLiquido + valorInversion,
    };
  });
}

export type PuntoAnual = {
  year: number;
  flujoNetoAnual: number;
  saldoLiquido: number;
  deudaPendiente: number;
  valorInversion: number;
  patrimonioConDeuda: number;
  patrimonioSinDeuda: number;
};

// Vista anual: una fila por año, con el flujo neto sumado y el resto de magnitudes
// tomadas al cierre (último mes del horizonte incluido en ese año).
export function agruparPorAnio(puntos: PuntoProyeccion[]): PuntoAnual[] {
  const porAnio = new Map<number, PuntoProyeccion[]>();
  for (const p of puntos) {
    if (!porAnio.has(p.year)) porAnio.set(p.year, []);
    porAnio.get(p.year)!.push(p);
  }

  return Array.from(porAnio.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, mesesAnio]) => {
      const ultimo = mesesAnio[mesesAnio.length - 1];
      return {
        year,
        flujoNetoAnual: mesesAnio.reduce((suma, m) => suma + m.flujoNeto, 0),
        saldoLiquido: ultimo.saldoLiquido,
        deudaPendiente: ultimo.deudaPendiente,
        valorInversion: ultimo.valorInversion,
        patrimonioConDeuda: ultimo.patrimonioConDeuda,
        patrimonioSinDeuda: ultimo.patrimonioSinDeuda,
      };
    });
}
