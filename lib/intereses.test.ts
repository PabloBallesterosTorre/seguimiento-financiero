import { describe, expect, it } from "vitest";
import { calcularInteresesPrevistos } from "./intereses";
import type { MovimientoPrevisto } from "./prevision";

function previsto(overrides: Partial<MovimientoPrevisto>): MovimientoPrevisto {
  return {
    id: "p1",
    descripcion: "Test",
    categoria_id: null,
    tipo: "gasto",
    importe_estimado: 0,
    importe_min: null,
    importe_max: null,
    tipo_recurrencia: "recurrente",
    periodicidad: "mensual",
    fecha: null,
    fecha_inicio: "2026-01-01",
    fecha_fin: null,
    estado: "activo",
    movimiento_real_id: null,
    cuenta_id: null,
    ...overrides,
  } as MovimientoPrevisto;
}

describe("calcularInteresesPrevistos", () => {
  it("calcula el interés mensual simple sobre el saldo actual sin otros movimientos", () => {
    const cuentas = [{ id: "c1", saldo_actual: 12000, tipo_interes: 3 }]; // 3% anual = 0.25%/mes
    const meses = [
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ];
    const resultado = calcularInteresesPrevistos(cuentas, [], meses);

    // Mes 1: 12000 * 0.0025 = 30
    expect(resultado.get("2026-1")).toBeCloseTo(30, 2);
    // Mes 2: saldo compuesto = 12000 + 30 = 12030 -> interés = 30.075
    expect(resultado.get("2026-2")).toBeCloseTo(30.075, 2);
  });

  it("suma el interés de varias cuentas remuneradas en el mismo mes", () => {
    const cuentas = [
      { id: "c1", saldo_actual: 10000, tipo_interes: 12 }, // 1%/mes = 100
      { id: "c2", saldo_actual: 5000, tipo_interes: 12 }, // 1%/mes = 50
    ];
    const resultado = calcularInteresesPrevistos(cuentas, [], [{ year: 2026, month: 1 }]);
    expect(resultado.get("2026-1")).toBeCloseTo(150, 2);
  });

  it("el saldo proyectado incorpora otros movimientos previstos asignados a esa cuenta", () => {
    const cuentas = [{ id: "c1", saldo_actual: 10000, tipo_interes: 12 }]; // 1%/mes
    const previstos = [
      previsto({ cuenta_id: "c1", tipo: "ingreso", importe_estimado: 1000, fecha_inicio: "2026-01-01" }),
    ];
    const meses = [
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ];
    const resultado = calcularInteresesPrevistos(cuentas, previstos, meses);

    // Mes 1: interés = 10000 * 0.01 = 100 (el ingreso de ese mes aún no genera interés hasta el mes siguiente)
    expect(resultado.get("2026-1")).toBeCloseTo(100, 2);
    // Saldo tras mes 1 = 10000 + 100 (interés) + 1000 (ingreso previsto) = 11100
    // Mes 2: interés = 11100 * 0.01 = 111
    expect(resultado.get("2026-2")).toBeCloseTo(111, 2);
  });

  it("ignora traspasos previstos en el cálculo del saldo (no son ingreso/gasto real de la cuenta)", () => {
    const cuentas = [{ id: "c1", saldo_actual: 10000, tipo_interes: 12 }];
    const previstos = [
      previsto({ cuenta_id: "c1", tipo: "traspaso", importe_estimado: 5000, fecha_inicio: "2026-01-01" }),
    ];
    const resultado = calcularInteresesPrevistos(cuentas, previstos, [{ year: 2026, month: 1 }]);
    expect(resultado.get("2026-1")).toBeCloseTo(100, 2);
  });

  it("sin cuentas remuneradas, no genera ninguna entrada", () => {
    const resultado = calcularInteresesPrevistos([], [], [{ year: 2026, month: 1 }]);
    expect(resultado.size).toBe(0);
  });
});
