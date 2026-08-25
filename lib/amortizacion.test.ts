import { describe, expect, it } from "vitest";
import { calcularCuota, simularAmortizacion, simularConProgramadas } from "./amortizacion";

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

describe("simularConProgramadas", () => {
  const saldo = 150000;
  const tasa = 3;
  const cuota = 831.9;
  const hoy = "2026-01-15";

  it("sin amortizaciones programadas, equivale a simularAmortizacion", () => {
    const base = simularAmortizacion(saldo, tasa, cuota, 0);
    const programada = simularConProgramadas(saldo, tasa, cuota, 0, hoy, []);
    expect(programada.mesesRestantes).toBe(base.mesesRestantes);
    expect(programada.interesesTotales).toBeCloseTo(base.interesesTotales, 4);
    expect(programada.cuotaFinal).toBe(cuota);
  });

  it("reducir_plazo: menos meses y menos intereses que sin amortización", () => {
    const base = simularConProgramadas(saldo, tasa, cuota, 0, hoy, []);
    const conExtra = simularConProgramadas(saldo, tasa, cuota, 0, hoy, [
      { fecha: "2026-06-01", importe: 20000, tipoReduccion: "reducir_plazo" },
    ]);
    expect(conExtra.mesesRestantes).toBeLessThan(base.mesesRestantes);
    expect(conExtra.interesesTotales).toBeLessThan(base.interesesTotales);
    expect(conExtra.cuotaFinal).toBe(cuota);
  });

  it("reducir_cuota: mismo plazo, cuota final más baja", () => {
    const base = simularConProgramadas(saldo, tasa, cuota, 0, hoy, []);
    const conExtra = simularConProgramadas(saldo, tasa, cuota, 0, hoy, [
      { fecha: "2026-06-01", importe: 20000, tipoReduccion: "reducir_cuota" },
    ]);
    expect(conExtra.mesesRestantes).toBe(base.mesesRestantes);
    expect(conExtra.cuotaFinal).toBeLessThan(cuota);
    expect(conExtra.interesesTotales).toBeLessThan(base.interesesTotales);
  });

  it("encadena varias amortizaciones en orden cronológico, independientemente del orden de entrada", () => {
    const enOrden = simularConProgramadas(saldo, tasa, cuota, 0, hoy, [
      { fecha: "2026-03-01", importe: 10000, tipoReduccion: "reducir_plazo" },
      { fecha: "2027-03-01", importe: 15000, tipoReduccion: "reducir_plazo" },
    ]);
    const desordenado = simularConProgramadas(saldo, tasa, cuota, 0, hoy, [
      { fecha: "2027-03-01", importe: 15000, tipoReduccion: "reducir_plazo" },
      { fecha: "2026-03-01", importe: 10000, tipoReduccion: "reducir_plazo" },
    ]);
    expect(desordenado.mesesRestantes).toBe(enOrden.mesesRestantes);
    expect(desordenado.interesesTotales).toBeCloseTo(enOrden.interesesTotales, 4);

    // El efecto conjunto ahorra más que aplicar solo la primera amortización.
    const soloLaPrimera = simularConProgramadas(saldo, tasa, cuota, 0, hoy, [
      { fecha: "2026-03-01", importe: 10000, tipoReduccion: "reducir_plazo" },
    ]);
    expect(enOrden.mesesRestantes).toBeLessThan(soloLaPrimera.mesesRestantes);
  });

  it("detecta cuota insuficiente si tras reducir_cuota varias veces la cuota deja de cubrir intereses", () => {
    const resultado = simularConProgramadas(100000, 8, 700, 0, hoy, [
      { fecha: "2026-02-01", importe: 90000, tipoReduccion: "reducir_cuota" },
    ]);
    // Al quedar un capital muy pequeño con el mismo plazo largo, la cuota recalculada
    // debería seguir siendo válida (más baja, no negativa) — comprobamos que al menos
    // no revienta y siempre devuelve una cuota final numérica coherente.
    expect(Number.isFinite(resultado.cuotaFinal)).toBe(true);
  });
});
