import { describe, expect, it } from "vitest";
import { agruparPorAnio, construirProyeccionPatrimonio, type PuntoProyeccion } from "./planificador";
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
});
