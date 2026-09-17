import { describe, expect, it } from "vitest";
import {
  construirEvolucionInversion,
  proyectarValorInversion,
  rentabilidadPonderada,
  calcularPosicion,
  tirAnualizada,
  flujosParaTIR,
  construirSerieCartera,
  mesesEntre,
} from "./inversiones";

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

describe("calcularPosicion", () => {
  const compra = (fecha: string, importe: number, participaciones: number) => ({
    fecha,
    tipo: "compra" as const,
    importe,
    participaciones,
    precio: importe / participaciones,
  });

  it("acumula participaciones, aportado y precio medio de compra", () => {
    const p = calcularPosicion([compra("2026-01-01", 100, 10), compra("2026-02-01", 100, 5)], 250);
    expect(p.participaciones).toBe(15);
    expect(p.aportadoNeto).toBe(200);
    expect(p.precioMedioCompra).toBeCloseTo(200 / 15, 6); // 13,33 €, no la media de 10 y 20
    expect(p.ganancia).toBe(50);
    expect(p.aportadoBruto).toBe(200);
    expect(p.rentabilidadSimple).toBeCloseTo(25, 6);
  });

  it("una posición vendida entera no da -100%: el porcentaje se mide sobre todo lo metido", () => {
    // Se compran 100 €, se venden por 93 €: se perdieron 7 € de 100, o sea un -7%.
    // Con el aportado neto (100 - 93 = 7) como denominador salía -100%, que sugiere
    // haberlo perdido todo.
    const p = calcularPosicion(
      [
        compra("2026-01-01", 100, 10),
        { fecha: "2026-06-01", tipo: "venta", importe: -93, participaciones: -10, precio: 9.3 },
      ],
      0
    );
    expect(p.participaciones).toBe(0);
    expect(p.aportadoNeto).toBe(7);
    expect(p.aportadoBruto).toBe(100);
    expect(p.ganancia).toBe(-7);
    expect(p.rentabilidadSimple).toBeCloseTo(-7, 6);
  });

  it("una venta reduce participaciones y aportado neto, y la ganancia incluye lo realizado", () => {
    const p = calcularPosicion(
      [
        compra("2026-01-01", 100, 10),
        { fecha: "2026-06-01", tipo: "venta", importe: -80, participaciones: -5, precio: 16 },
      ],
      80
    );
    expect(p.participaciones).toBe(5);
    expect(p.aportadoNeto).toBe(20);
    // 100 metidos, 80 recuperados, 80 todavía dentro: 60 de ganancia total.
    expect(p.ganancia).toBe(60);
    // El precio medio mira solo las compras: la venta no lo abarata.
    expect(p.precioMedioCompra).toBeCloseTo(10, 6);
  });

  it("sin aportación no hay porcentaje que calcular", () => {
    expect(calcularPosicion([], 0).rentabilidadSimple).toBeNull();
    expect(calcularPosicion([], 0).precioMedioCompra).toBeNull();
  });
});

describe("tirAnualizada", () => {
  it("una única aportación que crece un 10% en un año da un 10% anual", () => {
    const tir = tirAnualizada([
      { fecha: "2026-01-01", importe: -1000 },
      { fecha: "2027-01-01", importe: 1100 },
    ]);
    expect(tir).toBeCloseTo(10, 1);
  });

  it("duplicar en dos años es ~41,4% anual, no un 50%", () => {
    const tir = tirAnualizada([
      { fecha: "2026-01-01", importe: -1000 },
      { fecha: "2028-01-01", importe: 2000 },
    ]);
    expect(tir).toBeCloseTo(41.4, 0);
  });

  it("con aportaciones periódicas es muy superior a la rentabilidad simple", () => {
    // 12 aportaciones mensuales de 100 € y un valor final de 1.260 €: la rentabilidad
    // simple es del 5%, pero el dinero medio solo lleva medio año dentro.
    const flujos = Array.from({ length: 12 }, (_, i) => ({
      fecha: `2026-${String(i + 1).padStart(2, "0")}-01`,
      importe: -100,
    }));
    flujos.push({ fecha: "2027-01-01", importe: 1260 });

    const simple = ((1260 - 1200) / 1200) * 100;
    const tir = tirAnualizada(flujos)!;

    expect(simple).toBeCloseTo(5, 6);
    expect(tir).toBeGreaterThan(9);
    expect(tir).toBeLessThan(11);
  });

  it("una pérdida da una TIR negativa", () => {
    const tir = tirAnualizada([
      { fecha: "2026-01-01", importe: -1000 },
      { fecha: "2027-01-01", importe: 800 },
    ]);
    expect(tir).toBeCloseTo(-20, 1);
  });

  it("devuelve null cuando no hay solución con sentido", () => {
    expect(tirAnualizada([])).toBeNull();
    expect(tirAnualizada([{ fecha: "2026-01-01", importe: -1000 }])).toBeNull();
    // Solo flujos del mismo signo: ninguna tasa anula el valor presente.
    expect(
      tirAnualizada([
        { fecha: "2026-01-01", importe: -1000 },
        { fecha: "2027-01-01", importe: -1000 },
      ])
    ).toBeNull();
    // Todo el mismo día: no hay plazo sobre el que anualizar.
    expect(
      tirAnualizada([
        { fecha: "2026-01-01", importe: -1000 },
        { fecha: "2026-01-01", importe: 1100 },
      ])
    ).toBeNull();
  });
});

describe("flujosParaTIR", () => {
  it("invierte el signo de las operaciones y añade el valor de mercado como flujo final", () => {
    const flujos = flujosParaTIR(
      [{ fecha: "2026-01-01", tipo: "compra", importe: 500, participaciones: 5, precio: 100 }],
      600,
      "2027-01-01"
    );
    expect(flujos).toEqual([
      { fecha: "2026-01-01", importe: -500 },
      { fecha: "2027-01-01", importe: 600 },
    ]);
  });

  it("con valor de mercado cero no añade flujo final", () => {
    const flujos = flujosParaTIR([{ fecha: "2026-01-01", tipo: "compra", importe: 500, participaciones: 5, precio: 100 }], 0, "2027-01-01");
    expect(flujos).toHaveLength(1);
  });
});

describe("construirSerieCartera", () => {
  it("arrastra la última valoración conocida de cada inversión y acumula lo aportado", () => {
    const serie = construirSerieCartera(
      [
        { inversionId: "a", fecha: "2026-01-15", valor: 100 },
        { inversionId: "b", fecha: "2026-02-10", valor: 50 },
        { inversionId: "a", fecha: "2026-03-20", valor: 130 },
      ],
      [
        { fecha: "2026-01-15", importe: 100 },
        { fecha: "2026-02-10", importe: 50 },
      ],
      ["2026-01", "2026-02", "2026-03"]
    );

    expect(serie[0]).toEqual({ mes: "2026-01", valor: 100, aportado: 100 });
    // En febrero "a" no se ha revalorizado: se arrastra su último valor conocido.
    expect(serie[1]).toEqual({ mes: "2026-02", valor: 150, aportado: 150 });
    expect(serie[2]).toEqual({ mes: "2026-03", valor: 180, aportado: 150 });
  });

  it("un mes anterior a la primera valoración no suma nada", () => {
    const serie = construirSerieCartera(
      [{ inversionId: "a", fecha: "2026-03-01", valor: 100 }],
      [{ fecha: "2026-03-01", importe: 100 }],
      ["2026-01", "2026-03"]
    );
    expect(serie[0]).toEqual({ mes: "2026-01", valor: 0, aportado: 0 });
  });
});

describe("mesesEntre", () => {
  it("cubre de un mes a otro, ambos incluidos, cruzando el cambio de año", () => {
    expect(mesesEntre("2026-11-15", "2027-02-03")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("mismo mes devuelve un único elemento", () => {
    expect(mesesEntre("2026-05-01", "2026-05-31")).toEqual(["2026-05"]);
  });

  it("si la fecha final es anterior a la inicial, devuelve una lista vacía", () => {
    expect(mesesEntre("2026-05-01", "2026-04-01")).toEqual([]);
  });
});
