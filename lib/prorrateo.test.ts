import { describe, expect, it } from "vitest";
import { prorratear, sumarMeses } from "./prorrateo";

describe("sumarMeses", () => {
  it("recorta el día en los meses cortos y cruza el cambio de año", () => {
    expect(sumarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(sumarMeses("2028-01-31", 1)).toBe("2028-02-29");
    expect(sumarMeses("2026-11-15", 3)).toBe("2027-02-15");
  });
});

describe("prorratear", () => {
  it("parte el importe en N meses y la suma es exacta a céntimos", () => {
    const partes = prorratear([{ fecha: "2026-01-10", importe: -100, tipo: "gasto", prorrateo_meses: 3 }]);
    expect(partes.map((p) => p.fecha)).toEqual(["2026-01-10", "2026-02-10", "2026-03-10"]);
    expect(partes.map((p) => p.importe)).toEqual([-33.34, -33.33, -33.33]);
    expect(partes.reduce((s, p) => s + Math.round(p.importe * 100), 0)).toBe(-10000);
  });

  it("deja igual lo que no se prorratea: sin meses, un mes o traspasos", () => {
    const movs = [
      { fecha: "2026-01-10", importe: -50, tipo: "gasto", prorrateo_meses: null },
      { fecha: "2026-01-10", importe: -50, tipo: "gasto", prorrateo_meses: 1 },
      { fecha: "2026-01-10", importe: -50, tipo: "traspaso", prorrateo_meses: 12 },
    ];
    expect(prorratear(movs)).toEqual(movs);
  });

  it("acepta importes como texto, que es como llegan los numeric de Postgres", () => {
    const partes = prorratear([{ fecha: "2026-01-01", importe: "600.00", tipo: "gasto", prorrateo_meses: 12 }]);
    expect(partes).toHaveLength(12);
    expect(partes.every((p) => Number(p.importe) === 50)).toBe(true);
  });
});
