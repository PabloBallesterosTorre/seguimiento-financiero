import { describe, expect, it } from "vitest";
import { calcularCuota, simularAmortizacion, simularAmortizacionExtra } from "./amortizacion";

describe("calcularCuota + simularAmortizacion (hipoteca estándar)", () => {
  it("amortiza exactamente a 0 en el número de meses pactado (150k, 3%, 20 años)", () => {
    const cuota = calcularCuota(150000, 3, 240, 0);
    expect(cuota).toBeCloseTo(831.9, 1);

    const sim = simularAmortizacion(150000, 3, cuota, 0);
    expect(sim.mesesRestantes).toBe(240);
    expect(sim.filas.at(-1)?.saldo).toBeCloseTo(0, 4);
    expect(sim.cuotaNoCubreIntereses).toBe(false);
  });
});

describe("simularAmortizacion con valor residual (financiación tipo coche)", () => {
  it("amortiza hasta el valor residual, no hasta 0", () => {
    const cuota = calcularCuota(20000, 6, 60, 5000);
    const sim = simularAmortizacion(20000, 6, cuota, 5000);
    expect(sim.mesesRestantes).toBe(60);
    expect(sim.filas.at(-1)?.saldo).toBeCloseTo(5000, 4);
  });
});

describe("simularAmortizacion detecta cuota insuficiente", () => {
  it("marca cuotaNoCubreIntereses cuando la cuota no cubre ni el interés", () => {
    const sim = simularAmortizacion(150000, 5, 100, 0);
    expect(sim.cuotaNoCubreIntereses).toBe(true);
    expect(sim.filas.length).toBe(0);
  });
});

describe("simularAmortizacionExtra", () => {
  const base = { saldoActual: 150000, tasaAnual: 3, cuotaActual: 831.9, valorResidual: 0 };

  it("reducir_plazo: mismo importe de cuota, menos meses y menos intereses totales", () => {
    const resultado = simularAmortizacionExtra({
      ...base,
      importeExtra: 20000,
      recurrencia: "puntual",
      tipoReduccion: "reducir_plazo",
    });
    expect(resultado.despues.mesesRestantes).toBeLessThan(resultado.antes.mesesRestantes);
    expect(resultado.ahorroIntereses).toBeGreaterThan(0);
    expect(resultado.cuotaNueva).toBeNull();
  });

  it("reducir_cuota: mismo plazo aproximado, cuota más baja y menos intereses totales", () => {
    const resultado = simularAmortizacionExtra({
      ...base,
      importeExtra: 20000,
      recurrencia: "puntual",
      tipoReduccion: "reducir_cuota",
    });
    expect(resultado.cuotaNueva).not.toBeNull();
    expect(resultado.cuotaNueva as number).toBeLessThan(base.cuotaActual);
    expect(resultado.ahorroIntereses).toBeGreaterThan(0);
    // El plazo se mantiene igual (por diseño: se recalcula la cuota para los mismos meses restantes).
    expect(resultado.despues.mesesRestantes).toBe(resultado.antes.mesesRestantes);
  });

  it("recurrente mensual siempre reduce plazo, nunca cuota", () => {
    const resultado = simularAmortizacionExtra({
      ...base,
      importeExtra: 100,
      recurrencia: "mensual",
      tipoReduccion: "reducir_cuota", // se ignora para recurrentes
    });
    expect(resultado.cuotaNueva).toBeNull();
    expect(resultado.despues.mesesRestantes).toBeLessThan(resultado.antes.mesesRestantes);
  });
});
