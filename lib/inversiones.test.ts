import { describe, expect, it } from "vitest";
import { construirEvolucionInversion, proyectarValorInversion, rentabilidadPonderada } from "./inversiones";

describe("construirEvolucionInversion", () => {
  it("sin valoraciones devuelve una serie vacía", () => {
    expect(construirEvolucionInversion([], 6, "2026-01-01")).toEqual([]);
  });

  it("un único punto real se extrapola hasta hoy con la rentabilidad asumida", () => {
    const puntos = construirEvolucionInversion([{ fecha: "2026-01-01", valor: 10000 }], 12, "2027-01-01");
    expect(puntos[0]).toEqual({ fecha: "2026-01-01", valor: 10000, esReal: true });
    const ultimo = puntos[puntos.length - 1];
    expect(ultimo.fecha).toBe("2027-01-01");
    expect(ultimo.esReal).toBe(false);
    expect(ultimo.valor).toBeCloseTo(11200, 0); // ~12% en un año a rentabilidad compuesta anual del 12%
  });

  it("sin rentabilidad asumida, se mantiene plano tras el último punto real", () => {
    const puntos = construirEvolucionInversion([{ fecha: "2026-01-01", valor: 10000 }], null, "2026-06-01");
    const ultimo = puntos[puntos.length - 1];
    expect(ultimo.valor).toBeCloseTo(10000, 2);
  });

  it("entre dos puntos reales interpola sin salto y conecta exactamente el segundo dato real", () => {
    const puntos = construirEvolucionInversion(
      [
        { fecha: "2026-01-01", valor: 10000 },
        { fecha: "2026-04-01", valor: 11000 },
      ],
      6,
      "2026-04-01"
    );
    expect(puntos[0]).toEqual({ fecha: "2026-01-01", valor: 10000, esReal: true });
    const puntoFinal = puntos[puntos.length - 1];
    expect(puntoFinal).toEqual({ fecha: "2026-04-01", valor: 11000, esReal: true });
    // Los puntos intermedios están entre los dos valores reales y marcados como estimación.
    for (const p of puntos.slice(1, -1)) {
      expect(p.esReal).toBe(false);
      expect(p.valor).toBeGreaterThan(10000);
      expect(p.valor).toBeLessThan(11000);
    }
  });

  it("los puntos reales se ordenan aunque lleguen desordenados", () => {
    const puntos = construirEvolucionInversion(
      [
        { fecha: "2026-04-01", valor: 11000 },
        { fecha: "2026-01-01", valor: 10000 },
      ],
      null,
      "2026-04-01"
    );
    expect(puntos[0].fecha).toBe("2026-01-01");
  });
});

describe("proyectarValorInversion", () => {
  it("sin rentabilidad asumida, solo acumula aportaciones (0% de crecimiento)", () => {
    const serie = proyectarValorInversion({ valorInicial: 1000, rentabilidadAnualAsumida: null, aportacionMensual: 100, meses: 3 });
    expect(serie).toEqual([1100, 1200, 1300]);
  });

  it("compone la rentabilidad mensual equivalente sobre el saldo antes de sumar la aportación del mes", () => {
    const serie = proyectarValorInversion({ valorInicial: 1000, rentabilidadAnualAsumida: 12, aportacionMensual: 0, meses: 12 });
    // 12% anual compuesto mensualmente durante 12 meses ≈ 12% total.
    expect(serie[11]).toBeCloseTo(1120, 0);
  });
});

describe("rentabilidadPonderada", () => {
  it("pondera por valor actual, tratando null como 0%", () => {
    const r = rentabilidadPonderada([
      { valor_actual: 3000, rentabilidad_anual_asumida: 10 },
      { valor_actual: 1000, rentabilidad_anual_asumida: null },
    ]);
    // (3000*10 + 1000*0) / 4000 = 7.5
    expect(r).toBeCloseTo(7.5, 5);
  });

  it("sin inversiones o con valor total 0, devuelve null", () => {
    expect(rentabilidadPonderada([])).toBeNull();
    expect(rentabilidadPonderada([{ valor_actual: 0, rentabilidad_anual_asumida: 5 }])).toBeNull();
  });
});
