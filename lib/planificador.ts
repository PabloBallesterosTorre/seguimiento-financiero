import {
  importeEfectivoPrevisto,
  ocurrenciasEnMes,
  previstoAplicaEnMes,
  previstoYaMaterializadoEnMes,
  type MovimientoPrevisto,
} from "./prevision";
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
  esReal: boolean;
};

// Proyecta, mes a mes, el flujo de caja (previstos + intereses de cuentas
// remuneradas), el capital pendiente de cada deuda (vía simularConProgramadas, con
// las amortizaciones ya planificadas) y el valor de inversión (partiendo del valor
// actual, componiendo la rentabilidad anual asumida — tanda 8, mejora 2c; 0% si no se
// pasa — y sumando las aportaciones previstas categorizadas como inversión, que
// empiezan a componer desde el mes siguiente al que se aportan).
// El capital pendiente de cada mes usa el mismo índice relativo que el resto de la
// previsión (mes 0 = mes actual), igual que ya hace el simulador de amortización —
// no pretende una sincronía exacta día a día entre el cargo de la cuota y el resto
// del flujo de caja de ese mes. Un previsto ya conciliado para ese mismo mes
// (periodosConciliados) se excluye del flujo de ese mes: su importe ya está dentro de
// saldoLiquidoInicial/valorInversionInicial (saldo real de hoy), y sumarlo también
// como previsión lo contaría dos veces.
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
  periodosConciliados?: Set<string>;
  rentabilidadAnualAsumidaInversion?: number | null;
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
    periodosConciliados = new Set(),
    rentabilidadAnualAsumidaInversion = null,
  } = params;
  const tasaMensualInversion = rentabilidadAnualAsumidaInversion
    ? Math.pow(1 + rentabilidadAnualAsumidaInversion / 100, 1 / 12) - 1
    : 0;

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
    const aplicables = previstos.filter(
      (p) =>
        p.tipo !== "traspaso" &&
        previstoAplicaEnMes(p, mes.year, mes.month) &&
        !previstoYaMaterializadoEnMes(p.id, mes.year, mes.month, periodosConciliados)
    );
    let flujoNeto = interesesPorMes.get(`${mes.year}-${mes.month}`) ?? 0;
    let aportacionInversion = 0;

    for (const p of aplicables) {
      const importe = importeEfectivoPrevisto(p, mediaPorCategoria) * ocurrenciasEnMes(p, mes.year, mes.month);
      const signo = p.tipo === "ingreso" ? 1 : -1;
      flujoNeto += signo * importe;
      if (p.tipo === "gasto" && esCategoriaInversion(p.categoria_id)) {
        aportacionInversion += importe;
      }
    }

    saldoLiquido += flujoNeto;
    valorInversion = valorInversion * (1 + tasaMensualInversion) + aportacionInversion;

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
      esReal: false,
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
  esReal: boolean;
};

// Vista anual: una fila por año, con el flujo neto sumado y el resto de magnitudes
// tomadas al cierre (último mes del horizonte incluido en ese año). Un año que mezcla
// meses reales y proyectados (el año en curso) se marca esReal según su último mes,
// ya que los saldos mostrados son los de ese cierre.
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
        esReal: ultimo.esReal,
      };
    });
}

function finDeMesISO(year: number, month: number): string {
  const ultimoDia = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
}

function mesesEntre(fechaInicioISO: string, year: number, month: number): number {
  const [anioIni, mesIni] = fechaInicioISO.split("-").map(Number);
  return year * 12 + (month - 1) - (anioIni * 12 + (mesIni - 1));
}

export type MovimientoParaHistorico = {
  fecha: string;
  importe: number;
  categoria_id: string | null;
  tipo: "ingreso" | "gasto" | "traspaso";
};

export type DeudaParaHistorico = {
  id: string;
  capital_inicial: number;
  capital_pendiente: number;
  fecha_inicio: string;
  cuota: number;
  tipo_interes: number | null;
  valor_residual: number;
};

// Reconstruye, mes a mes, lo que de verdad pasó: líquido (saldo actual menos todos los
// movimientos posteriores a cada cierre de mes — exacto, viene del histórico real),
// deuda pendiente (simulando cada deuda hacia adelante desde su capital inicial y
// fecha de inicio, con las amortizaciones extra ya aplicadas en su fecha real, y
// ANCLANDO la curva resultante al capital pendiente real de hoy — se calcula el saldo
// teórico que la simulación daría hoy y se le suma a toda la curva histórica la
// diferencia frente al capital pendiente real, para que conecte sin salto con el
// primer punto de la proyección futura, que sí parte del dato real. Sin este ajuste,
// cualquier diferencia entre la amortización teórica y la cuota/capital realmente
// vigente hoy (o una cuota que cambió y de la que no se guarda historial) se traduce en
// un salto discontinuo justo en el mes de hoy) e inversión aportada (suma acumulada de
// aportaciones categorizadas como inversión — coste, NO el valor de mercado histórico,
// que no se registra en ningún sitio).
export function construirHistoricoPatrimonio(params: {
  meses: MesProyeccion[];
  movimientos: MovimientoParaHistorico[];
  saldoLiquidoActual: number;
  deudas: DeudaParaHistorico[];
  amortizacionesAplicadasPorDeuda: Map<string, AmortizacionProgramadaDeuda[]>;
  esCategoriaInversion: (categoriaId: string | null) => boolean;
  hoy: string;
}): PuntoProyeccion[] {
  const {
    meses,
    movimientos,
    saldoLiquidoActual,
    deudas,
    amortizacionesAplicadasPorDeuda,
    esCategoriaInversion,
    hoy,
  } = params;
  const [hoyYear, hoyMonth] = hoy.split("-").map(Number);

  const finesDeMes = meses.map((mes) => finDeMesISO(mes.year, mes.month));

  const liquidoPorMes = finesDeMes.map((fin) => {
    const sumaPosterior = movimientos.filter((m) => m.fecha > fin).reduce((s, m) => s + Number(m.importe), 0);
    return saldoLiquidoActual - sumaPosterior;
  });

  const inversionPorMes = finesDeMes.map((fin) =>
    movimientos
      .filter((m) => m.tipo === "gasto" && esCategoriaInversion(m.categoria_id) && m.fecha <= fin)
      .reduce((s, m) => s + Math.abs(Number(m.importe)), 0)
  );

  const ultimoMes = meses[meses.length - 1];
  const simulacionesPorDeuda = deudas.map((deuda) => {
    const programadas = (amortizacionesAplicadasPorDeuda.get(deuda.id) ?? []).map((a) => ({
      fecha: a.fecha,
      importe: a.importe,
      tipoReduccion: a.tipoReduccion,
    }));
    const indiceHoy = mesesEntre(deuda.fecha_inicio, hoyYear, hoyMonth);
    const mesesNecesarios = Math.max(
      indiceHoy,
      ultimoMes ? mesesEntre(deuda.fecha_inicio, ultimoMes.year, ultimoMes.month) : 0
    );
    const resultado = simularConProgramadas(
      deuda.capital_inicial,
      deuda.tipo_interes ?? 0,
      deuda.cuota,
      deuda.valor_residual,
      deuda.fecha_inicio,
      programadas,
      Math.max(mesesNecesarios + 1, 600)
    );
    const teoricoHoy = indiceHoy >= 0 ? (resultado.filas[indiceHoy]?.saldo ?? deuda.valor_residual) : deuda.capital_inicial;
    const offset = deuda.capital_pendiente - teoricoHoy;
    return { filas: resultado.filas, fechaInicio: deuda.fecha_inicio, valorResidual: deuda.valor_residual, offset };
  });

  const deudaPorMes = meses.map((mes) =>
    simulacionesPorDeuda.reduce((suma, d) => {
      const indice = mesesEntre(d.fechaInicio, mes.year, mes.month);
      if (indice < 0) return suma; // la deuda todavía no existía ese mes
      const fila = d.filas[indice];
      const saldo = fila ? fila.saldo + d.offset : d.valorResidual;
      return suma + saldo;
    }, 0)
  );

  return meses.map((mes, i) => {
    const finAnterior = i === 0 ? null : finesDeMes[i - 1];
    const flujoNeto = movimientos
      .filter((m) => m.fecha <= finesDeMes[i] && (finAnterior === null || m.fecha > finAnterior))
      .reduce((s, m) => s + Number(m.importe), 0);

    return {
      year: mes.year,
      month: mes.month,
      label: mes.label,
      flujoNeto,
      saldoLiquido: liquidoPorMes[i],
      deudaPendiente: deudaPorMes[i],
      valorInversion: inversionPorMes[i],
      patrimonioConDeuda: liquidoPorMes[i] + inversionPorMes[i] - deudaPorMes[i],
      patrimonioSinDeuda: liquidoPorMes[i] + inversionPorMes[i],
      esReal: true,
    };
  });
}
