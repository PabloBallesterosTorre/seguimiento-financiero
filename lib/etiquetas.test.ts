import { describe, expect, it } from "vitest";
import { etiquetasPorPatron, normalizarTexto, patronValido, resumenPorEtiqueta } from "./etiquetas";

describe("normalizarTexto", () => {
  it("quita acentos, pasa a minúsculas y colapsa espacios y guiones", () => {
    expect(normalizarTexto("  RENFE-Viajeros   Mádrid ")).toBe("renfe viajeros madrid");
  });
});

describe("patronValido", () => {
  it("rechaza patrones vacíos o de menos de tres letras", () => {
    expect(patronValido(null)).toBeNull();
    expect(patronValido("  ")).toBeNull();
    expect(patronValido("es")).toBeNull();
  });
  it("devuelve el patrón normalizado", () => {
    expect(patronValido(" Ikea ")).toBe("ikea");
  });
});

describe("etiquetasPorPatron", () => {
  const etiquetas = [
    { id: "japon", nombre: "Viaje a Japón", patron: "japan airlines" },
    { id: "casa", nombre: "Reforma", patron: "leroy merlin" },
    { id: "coche", nombre: "Coche", patron: null },
    { id: "corta", nombre: "Corta", patron: "a" },
  ];

  it("devuelve las etiquetas cuyo patrón aparece, sin importar mayúsculas, acentos ni guiones", () => {
    expect(etiquetasPorPatron("COMPRA JAPAN-AIRLINES TOKIO", etiquetas)).toEqual(["japon"]);
    expect(etiquetasPorPatron("Leroy Merlín Alcobendas", etiquetas)).toEqual(["casa"]);
  });

  it("ignora las etiquetas sin patrón o con un patrón demasiado corto", () => {
    expect(etiquetasPorPatron("Gasolinera de la autovía", etiquetas)).toEqual([]);
  });
});

describe("resumenPorEtiqueta", () => {
  it("suma gastos e ingresos por etiqueta, ignora traspasos y cuenta un movimiento en todas sus etiquetas", () => {
    const r = resumenPorEtiqueta(
      [
        { importe: -300.1, tipo: "gasto", fecha: "2026-10-02", etiquetaIds: ["japon"] },
        { importe: -0.2, tipo: "gasto", fecha: "2026-10-05", etiquetaIds: ["japon", "trabajo"] },
        { importe: 150, tipo: "ingreso", fecha: "2026-10-09", etiquetaIds: ["japon"] },
        { importe: -500, tipo: "traspaso", fecha: "2026-10-03", etiquetaIds: ["japon"] },
        { importe: -10, tipo: "gasto", fecha: "2026-10-04", etiquetaIds: ["desconocida"] },
      ],
      ["japon", "trabajo", "vacia"]
    );
    expect(r[0]).toEqual({
      etiquetaId: "japon",
      movimientos: 3,
      gastos: 300.3,
      ingresos: 150,
      neto: -150.3,
      primeraFecha: "2026-10-02",
      ultimaFecha: "2026-10-09",
    });
    expect(r.find((x) => x.etiquetaId === "trabajo")).toMatchObject({ movimientos: 1, gastos: 0.2 });
    expect(r.find((x) => x.etiquetaId === "vacia")).toMatchObject({ movimientos: 0, primeraFecha: null });
  });
});
