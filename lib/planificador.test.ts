import { describe, expect, it } from "vitest";
import {
  agruparPorAnio,
  construirHistoricoPatrimonio,
  construirProyeccionPatrimonio,
  type PuntoProyeccion,
} from "./planificador";
import { construirPeriodosConciliados, type MovimientoPrevisto } from "./prevision";
import { simularConProgramadas, type TipoReduccion } from "./amortizacion";

// Calcula el saldo teórico "puro" (sin el anclaje al capital pendiente real que aplica
// construirHistoricoPatrimonio) que tendría una deuda en `hoy`, para poder pasar ese
// mismo valor como capital_pendiente en los tests y así dejar el offset de anclaje en 0
// — de modo que los tests sigan comprobando la curva de amortización en sí, no el ancla.
function capitalPendienteTeoricoEn(
  capitalInicial: number,
  tipoInteres: number,
  cuota: number,
  valorResidual: number,
  fechaInicio: string,
  hoy: string,
  programadas: { fecha: string; importe: number; tipoReduccion: TipoReduccion }[] = []
): number {
  const [anioHoy, mesHoy] = hoy.split("-").map(Number);
  const [anioIni, mesIni] = fechaInicio.split("-").map(Number);
  const indice = anioHoy * 12 + (mesHoy - 1) - (anioIni * 12 + (mesIni - 1));
  const resultado = simularConProgramadas(capitalInicial, tipoInteres, cuota, valorResidual, fechaInicio, programadas, indice + 1);
  return resultado.filas[indice]?.saldo ?? valorResidual;
}

function previsto(overrides: Partial<MovimientoPrevisto> = {}): MovimientoPrevisto {
  return {
    id: "p1",
    descripcion: "Test",
    categoria_id: null,
    cuenta_id: null,
    tipo: "gasto",
    importe_estimado: 100,
    importe_min: null,
    importe_max: null,
    tipo_recurrencia: "recurrente",
    periodicidad: "mensual",
    fecha: null,
    fecha_inicio: "2026-01-01",
    fecha_fin: null,
    estado: "activo",
    origen_calculo: "fijo",
    ...overrides,
  };
}

const meses = [
  { year: 2026, month: 1, label: "Enero 2026" },
  { year: 2026, month: 2, label: "Febrero 2026" },
  { year: 2026, month: 3, label: "Marzo 2026" },
];

describe("construirProyeccionPatrimonio", () => {
  it("acumula el saldo líquido con el flujo neto mes a mes", () => {
    const puntos = construirProyeccionPatrimonio({
      meses,
      fechaInicio: "2026-01-01",
      saldoLiquidoInicial: 1000,
      valorInversionInicial: 0,
      previstos: [previsto({ tipo: "ingreso", importe_estimado: 2000 }), previsto({ tipo: "gasto", importe_estimado: 500 })],
      interesesPorMes: new Map(),
      deudas: [],
      amortizacionesProgramadas: [],
      esCategoriaInversion: () => false,
    });

    expect(puntos[0].flujoNeto).toBeCloseTo(1500, 2);
    expect(puntos[0].saldoLiquido).toBeCloseTo(2500, 2);
    expect(puntos[2].saldoLiquido).toBeCloseTo(5500, 2);
  });

  it("suma los intereses previstos al flujo neto", () => {
    const puntos = construirProyeccionPatrimonio({
      meses,
      fechaInicio: "2026-01-01",
      saldoLiquidoInicial: 0,
      valorInversionInicial: 0,
      previstos: [],
      interesesPorMes: new Map([["2026-1", 10]]),
      deudas: [],
      amortizacionesProgramadas: [],
      esCategoriaInversion: () => false,
    });

    expect(puntos[0].flujoNeto).toBeCloseTo(10, 2);
    expect(puntos[1].flujoNeto).toBeCloseTo(0, 2);
  });

  it("una aportación a inversión resta del líquido y suma al valor de inversión (patrimonio total no cambia)", () => {
    const puntos = construirProyeccionPatrimonio({
      meses,
      fechaInicio: "2026-01-01",
      saldoLiquidoInicial: 1000,
      valorInversionInicial: 5000,
      previstos: [previsto({ tipo: "gasto", categoria_id: "inversion", importe_estimado: 100 })],
      interesesPorMes: new Map(),
      deudas: [],
      amortizacionesProgramadas: [],
      esCategoriaInversion: (id) => id === "inversion",
    });

    expect(puntos[0].saldoLiquido).toBeCloseTo(900, 2);
    expect(puntos[0].valorInversion).toBeCloseTo(5100, 2);
    expect(puntos[0].patrimonioSinDeuda).toBeCloseTo(6000, 2);
  });

  it("con rentabilidad anual asumida, el valor de inversión compone mes a mes antes de sumar la aportación", () => {
    const doceMeses = Array.from({ length: 12 }, (_, i) => ({ year: 2026, month: i + 1, label: `Mes ${i + 1}` }));
    const puntos = construirProyeccionPatrimonio({
      meses: doceMeses,
      fechaInicio: "2026-01-01",
      saldoLiquidoInicial: 0,
      valorInversionInicial: 10000,
      previstos: [],
      interesesPorMes: new Map(),
      deudas: [],
      amortizacionesProgramadas: [],
      esCategoriaInversion: () => false,
      rentabilidadAnualAsumidaInversion: 12,
    });

    expect(puntos[11].valorInversion).toBeCloseTo(11200, 0); // 12% compuesto durante 12 meses ≈ 12% anual
  });

  it("un previsto de nivel 2 usa la media recalculada en la proyección de flujo", () => {
    const puntos = construirProyeccionPatrimonio({
      meses,
      fechaInicio: "2026-01-01",
      saldoLiquidoInicial: 1000,
      valorInversionInicial: 0,
      previstos: [
        previsto({ tipo: "gasto", categoria_id: "ocio", importe_estimado: 40, origen_calculo: "media_categoria" }),
      ],
      interesesPorMes: new Map(),
      deudas: [],
      amortizacionesProgramadas: [],
      esCategoriaInversion: () => false,
      mediaPorCategoria: new Map([["gasto:ocio", 90]]),
    });

    expect(puntos[0].flujoNeto).toBeCloseTo(-90, 2);
  });

  it("proyecta el capital pendiente de una deuda a la baja mes a mes", () => {
    const puntos = construirProyeccionPatrimonio({
      meses,
      fechaInicio: "2026-01-01",
      saldoLiquidoInicial: 0,
      valorInversionInicial: 0,
      previstos: [],
      interesesPorMes: new Map(),
      deudas: [{ id: "d1", capital_pendiente: 150000, cuota: 831.9, tipo_interes: 3, valor_residual: 0 }],
      amortizacionesProgramadas: [],
      esCategoriaInversion: () => false,
    });

    expect(puntos[0].deudaPendiente).toBeLessThan(150000);
    expect(puntos[1].deudaPendiente).toBeLessThan(puntos[0].deudaPendiente);
    expect(puntos[0].patrimonioConDeuda).toBeLessThan(puntos[0].patrimonioSinDeuda);
  });

  it("un previsto ya conciliado para ese mismo mes no se cuenta dos veces", () => {
    const periodosConciliados = construirPeriodosConciliados([{ previsto_id: "p1", periodo: "2026-01-01" }]);
    const puntos = construirProyeccionPatrimonio({
      meses,
      fechaInicio: "2026-01-01",
      saldoLiquidoInicial: 1000,
      valorInversionInicial: 0,
      previstos: [previsto({ id: "p1", tipo: "gasto", importe_estimado: 800 })],
      interesesPorMes: new Map(),
      deudas: [],
      amortizacionesProgramadas: [],
      esCategoriaInversion: () => false,
      periodosConciliados,
    });

    expect(puntos[0].flujoNeto).toBe(0);
    expect(puntos[0].saldoLiquido).toBe(1000);
  });

  it("un previsto conciliado en OTRO mes sí se proyecta con normalidad en este", () => {
    const periodosConciliados = construirPeriodosConciliados([{ previsto_id: "p1", periodo: "2025-12-01" }]);
    const puntos = construirProyeccionPatrimonio({
      meses,
      fechaInicio: "2026-01-01",
      saldoLiquidoInicial: 1000,
      valorInversionInicial: 0,
      previstos: [previsto({ id: "p1", tipo: "gasto", importe_estimado: 800 })],
      interesesPorMes: new Map(),
      deudas: [],
      amortizacionesProgramadas: [],
      esCategoriaInversion: () => false,
      periodosConciliados,
    });

    expect(puntos[0].flujoNeto).toBeCloseTo(-800, 2);
  });

  it("una amortización programada reduce el capital pendiente proyectado", () => {
    const base = construirProyeccionPatrimonio({
      meses,
      fechaInicio: "2026-01-01",
      saldoLiquidoInicial: 0,
      valorInversionInicial: 0,
      previstos: [],
      interesesPorMes: new Map(),
      deudas: [{ id: "d1", capital_pendiente: 150000, cuota: 831.9, tipo_interes: 3, valor_residual: 0 }],
      amortizacionesProgramadas: [],
      esCategoriaInversion: () => false,
    });

    const conExtra = construirProyeccionPatrimonio({
      meses,
      fechaInicio: "2026-01-01",
      saldoLiquidoInicial: 0,
      valorInversionInicial: 0,
      previstos: [],
      interesesPorMes: new Map(),
      deudas: [{ id: "d1", capital_pendiente: 150000, cuota: 831.9, tipo_interes: 3, valor_residual: 0 }],
      amortizacionesProgramadas: [{ deuda_id: "d1", fecha: "2026-02-01", importe: 20000, tipoReduccion: "reducir_plazo" }],
      esCategoriaInversion: () => false,
    });

    expect(conExtra.at(-1)!.deudaPendiente).toBeLessThan(base.at(-1)!.deudaPendiente);
  });
});

describe("agruparPorAnio", () => {
  function punto(overrides: Partial<PuntoProyeccion>): PuntoProyeccion {
    return {
      year: 2026,
      month: 1,
      label: "",
      flujoNeto: 0,
      saldoLiquido: 0,
      deudaPendiente: 0,
      valorInversion: 0,
      patrimonioConDeuda: 0,
      patrimonioSinDeuda: 0,
      esReal: false,
      ...overrides,
    };
  }

  it("suma el flujo neto del año y se queda con los saldos del último mes de ese año", () => {
    const puntos = [
      punto({ year: 2026, month: 11, flujoNeto: 100, saldoLiquido: 1100, patrimonioConDeuda: 900 }),
      punto({ year: 2026, month: 12, flujoNeto: 100, saldoLiquido: 1200, patrimonioConDeuda: 1000 }),
      punto({ year: 2027, month: 1, flujoNeto: 50, saldoLiquido: 1250, patrimonioConDeuda: 1050 }),
    ];

    const anual = agruparPorAnio(puntos);

    expect(anual).toHaveLength(2);
    expect(anual[0]).toMatchObject({ year: 2026, flujoNetoAnual: 200, saldoLiquido: 1200, patrimonioConDeuda: 1000 });
    expect(anual[1]).toMatchObject({ year: 2027, flujoNetoAnual: 50, saldoLiquido: 1250, patrimonioConDeuda: 1050 });
  });

  it("un año que mezcla meses reales y proyectados hereda esReal de su último mes", () => {
    const puntos = [
      punto({ year: 2026, month: 6, esReal: true }),
      punto({ year: 2026, month: 7, esReal: false }),
    ];
    expect(agruparPorAnio(puntos)[0].esReal).toBe(false);
  });
});

describe("construirHistoricoPatrimonio", () => {
  const mesesPasados = [
    { year: 2026, month: 1, label: "Enero 2026" },
    { year: 2026, month: 2, label: "Febrero 2026" },
    { year: 2026, month: 3, label: "Marzo 2026" },
  ];

  it("reconstruye el líquido histórico restando del saldo actual los movimientos posteriores", () => {
    const movimientos = [
      { fecha: "2026-01-15", importe: 1000, categoria_id: null, tipo: "ingreso" as const },
      { fecha: "2026-02-10", importe: -200, categoria_id: null, tipo: "gasto" as const },
      { fecha: "2026-03-05", importe: -100, categoria_id: null, tipo: "gasto" as const },
    ];

    const puntos = construirHistoricoPatrimonio({
      meses: mesesPasados,
      movimientos,
      saldoLiquidoActual: 700,
      deudas: [],
      amortizacionesAplicadasPorDeuda: new Map(),
      esCategoriaInversion: () => false,
      hoy: "2026-03-15",
    });

    expect(puntos[0].saldoLiquido).toBeCloseTo(1000, 2);
    expect(puntos[1].saldoLiquido).toBeCloseTo(800, 2);
    expect(puntos[2].saldoLiquido).toBeCloseTo(700, 2);
    expect(puntos.every((p) => p.esReal)).toBe(true);
  });

  it("acumula el coste aportado a inversión mes a mes", () => {
    const movimientos = [
      { fecha: "2026-01-10", importe: -50, categoria_id: "inversion", tipo: "gasto" as const },
      { fecha: "2026-02-10", importe: -50, categoria_id: "inversion", tipo: "gasto" as const },
      { fecha: "2026-03-10", importe: -50, categoria_id: "inversion", tipo: "gasto" as const },
    ];

    const puntos = construirHistoricoPatrimonio({
      meses: mesesPasados,
      movimientos,
      saldoLiquidoActual: 0,
      deudas: [],
      amortizacionesAplicadasPorDeuda: new Map(),
      esCategoriaInversion: (id) => id === "inversion",
      hoy: "2026-03-15",
    });

    expect(puntos[0].valorInversion).toBeCloseTo(50, 2);
    expect(puntos[1].valorInversion).toBeCloseTo(100, 2);
    expect(puntos[2].valorInversion).toBeCloseTo(150, 2);
  });

  it("reconstruye el capital pendiente de una deuda desde su origen y no antes de que existiera", () => {
    const hoy = "2026-06-01";
    const capitalPendiente = capitalPendienteTeoricoEn(150000, 3, 831.9, 0, "2026-01-01", hoy);
    const puntos = construirHistoricoPatrimonio({
      meses: [
        { year: 2025, month: 12, label: "" },
        { year: 2026, month: 1, label: "" },
        { year: 2026, month: 2, label: "" },
      ],
      movimientos: [],
      saldoLiquidoActual: 0,
      deudas: [
        {
          id: "d1",
          capital_inicial: 150000,
          capital_pendiente: capitalPendiente,
          fecha_inicio: "2026-01-01",
          cuota: 831.9,
          tipo_interes: 3,
          valor_residual: 0,
        },
      ],
      amortizacionesAplicadasPorDeuda: new Map(),
      esCategoriaInversion: () => false,
      hoy,
    });

    expect(puntos[0].deudaPendiente).toBe(0);
    expect(puntos[1].deudaPendiente).toBeGreaterThan(0);
    expect(puntos[1].deudaPendiente).toBeLessThan(150000);
    expect(puntos[2].deudaPendiente).toBeLessThan(puntos[1].deudaPendiente);
  });

  it("una amortización ya aplicada en el pasado reduce el capital pendiente reconstruido desde esa fecha", () => {
    const hoy = "2026-06-01";
    const fechaInicio = "2025-01-01";
    const programadas = [{ fecha: "2025-06-01", importe: 20000, tipoReduccion: "reducir_plazo" as TipoReduccion }];
    const capitalPendienteSinExtra = capitalPendienteTeoricoEn(150000, 3, 831.9, 0, fechaInicio, hoy);
    const capitalPendienteConExtra = capitalPendienteTeoricoEn(150000, 3, 831.9, 0, fechaInicio, hoy, programadas);

    const sinExtra = construirHistoricoPatrimonio({
      meses: mesesPasados,
      movimientos: [],
      saldoLiquidoActual: 0,
      deudas: [{ id: "d1", capital_inicial: 150000, capital_pendiente: capitalPendienteSinExtra, fecha_inicio: fechaInicio, cuota: 831.9, tipo_interes: 3, valor_residual: 0 }],
      amortizacionesAplicadasPorDeuda: new Map(),
      esCategoriaInversion: () => false,
      hoy,
    });

    const conExtra = construirHistoricoPatrimonio({
      meses: mesesPasados,
      movimientos: [],
      saldoLiquidoActual: 0,
      deudas: [{ id: "d1", capital_inicial: 150000, capital_pendiente: capitalPendienteConExtra, fecha_inicio: fechaInicio, cuota: 831.9, tipo_interes: 3, valor_residual: 0 }],
      amortizacionesAplicadasPorDeuda: new Map([["d1", programadas.map((p) => ({ deuda_id: "d1", ...p }))]]),
      esCategoriaInversion: () => false,
      hoy,
    });

    expect(conExtra[0].deudaPendiente).toBeLessThan(sinExtra[0].deudaPendiente);
  });

  it("ancla la curva histórica al capital pendiente real de hoy, sin salto en el último punto", () => {
    const fechaInicio = "2023-01-01";
    const hoy = "2026-04-01";
    const capitalTeorico = capitalPendienteTeoricoEn(150000, 3, 831.9, 0, fechaInicio, hoy);
    // Capital pendiente real distinto del teórico (p. ej. porque la cuota real vigente no
    // coincide exactamente con la usada para reconstruir el pasado) — simula justo el caso
    // del bug: un desajuste entre la amortización teórica y el dato real de hoy.
    const capitalPendienteReal = capitalTeorico + 8570;

    const puntos = construirHistoricoPatrimonio({
      meses: [
        { year: 2026, month: 1, label: "" },
        { year: 2026, month: 2, label: "" },
        { year: 2026, month: 3, label: "" },
      ],
      movimientos: [],
      saldoLiquidoActual: 0,
      deudas: [
        {
          id: "d1",
          capital_inicial: 150000,
          capital_pendiente: capitalPendienteReal,
          fecha_inicio: fechaInicio,
          cuota: 831.9,
          tipo_interes: 3,
          valor_residual: 0,
        },
      ],
      amortizacionesAplicadasPorDeuda: new Map(),
      esCategoriaInversion: () => false,
      hoy,
    });

    // El último punto histórico (marzo 2026, un mes antes de "hoy") debe quedar desplazado
    // por el mismo offset que ancla "hoy" al capital pendiente real — no por el valor teórico
    // sin ajustar — porque la curva entera se desplaza, no solo el punto de "hoy" (que ni
    // siquiera forma parte de este histórico: lo pone la proyección futura, con el valor real
    // directamente).
    const capitalTeoricoUltimoMes = capitalPendienteTeoricoEn(150000, 3, 831.9, 0, fechaInicio, "2026-03-01");
    const offset = capitalPendienteReal - capitalTeorico;
    const esperadoUltimoPunto = capitalTeoricoUltimoMes + offset;

    const ultimoPunto = puntos[puntos.length - 1];
    expect(ultimoPunto.deudaPendiente).toBeGreaterThan(capitalTeorico);
    expect(ultimoPunto.deudaPendiente).toBeCloseTo(esperadoUltimoPunto, 2);
  });
});
