import { describe, expect, it } from "vitest";
import {
  agruparPorAnio,
  construirHistoricoPatrimonio,
  construirProyeccionPatrimonio,
  type PuntoProyeccion,
} from "./planificador";
import type { MovimientoPrevisto } from "./prevision";

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
    movimiento_real_id: null,
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
    });

    expect(puntos[0].valorInversion).toBeCloseTo(50, 2);
    expect(puntos[1].valorInversion).toBeCloseTo(100, 2);
    expect(puntos[2].valorInversion).toBeCloseTo(150, 2);
  });

  it("reconstruye el capital pendiente de una deuda desde su origen y no antes de que existiera", () => {
    const puntos = construirHistoricoPatrimonio({
      meses: [
        { year: 2025, month: 12, label: "" },
        { year: 2026, month: 1, label: "" },
        { year: 2026, month: 2, label: "" },
      ],
      movimientos: [],
      saldoLiquidoActual: 0,
      deudas: [{ id: "d1", capital_inicial: 150000, fecha_inicio: "2026-01-01", cuota: 831.9, tipo_interes: 3, valor_residual: 0 }],
      amortizacionesAplicadasPorDeuda: new Map(),
      esCategoriaInversion: () => false,
    });

    expect(puntos[0].deudaPendiente).toBe(0);
    expect(puntos[1].deudaPendiente).toBeGreaterThan(0);
    expect(puntos[1].deudaPendiente).toBeLessThan(150000);
    expect(puntos[2].deudaPendiente).toBeLessThan(puntos[1].deudaPendiente);
  });

  it("una amortización ya aplicada en el pasado reduce el capital pendiente reconstruido desde esa fecha", () => {
    const deudas = [{ id: "d1", capital_inicial: 150000, fecha_inicio: "2025-01-01", cuota: 831.9, tipo_interes: 3, valor_residual: 0 }];
    const sinExtra = construirHistoricoPatrimonio({
      meses: mesesPasados,
      movimientos: [],
      saldoLiquidoActual: 0,
      deudas,
      amortizacionesAplicadasPorDeuda: new Map(),
      esCategoriaInversion: () => false,
    });

    const conExtra = construirHistoricoPatrimonio({
      meses: mesesPasados,
      movimientos: [],
      saldoLiquidoActual: 0,
      deudas,
      amortizacionesAplicadasPorDeuda: new Map([
        ["d1", [{ deuda_id: "d1", fecha: "2025-06-01", importe: 20000, tipoReduccion: "reducir_plazo" as const }]],
      ]),
      esCategoriaInversion: () => false,
    });

    expect(conExtra[0].deudaPendiente).toBeLessThan(sinExtra[0].deudaPendiente);
  });
});
