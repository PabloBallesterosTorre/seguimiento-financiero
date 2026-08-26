import { describe, expect, it } from "vitest";
import {
  agruparPorCategoriaPadreYMes,
  mediaPorCategoriaEnRango,
  previstoVsRealPorCategoria,
  ahorroDelMes,
  type MovimientoParaInforme,
} from "./informes";

const categoriaEfectiva = (id: string) => (id === "restaurantes" || id === "cine" ? "ocio" : id);

describe("agruparPorCategoriaPadreYMes", () => {
  it("agrega subcategorías bajo su categoría padre, por mes", () => {
    const movimientos: MovimientoParaInforme[] = [
      { categoria_id: "restaurantes", tipo: "gasto", importe: -40, fecha: "2026-01-15" },
      { categoria_id: "cine", tipo: "gasto", importe: -20, fecha: "2026-01-20" },
      { categoria_id: "restaurantes", tipo: "gasto", importe: -30, fecha: "2026-02-10" },
    ];

    const resultado = agruparPorCategoriaPadreYMes(movimientos, "gasto", categoriaEfectiva);

    expect(resultado.get("ocio")?.get("2026-01")).toBe(60);
    expect(resultado.get("ocio")?.get("2026-02")).toBe(30);
  });

  it("ignora movimientos sin categoría y del tipo contrario", () => {
    const movimientos: MovimientoParaInforme[] = [
      { categoria_id: null, tipo: "gasto", importe: -10, fecha: "2026-01-01" },
      { categoria_id: "ocio", tipo: "ingreso", importe: 10, fecha: "2026-01-01" },
    ];
    expect(agruparPorCategoriaPadreYMes(movimientos, "gasto", categoriaEfectiva).size).toBe(0);
  });
});

describe("mediaPorCategoriaEnRango", () => {
  it("divide el total entre los meses del rango, no entre los meses con datos", () => {
    const porCategoriaYMes = new Map([["ocio", new Map([["2026-01", 90]])]]);
    const resultado = mediaPorCategoriaEnRango(porCategoriaYMes, 3);
    expect(resultado).toEqual([{ categoriaId: "ocio", total: 90, media: 30 }]);
  });

  it("ordena de mayor a menor media", () => {
    const porCategoriaYMes = new Map([
      ["a", new Map([["2026-01", 30]])],
      ["b", new Map([["2026-01", 90]])],
    ]);
    const resultado = mediaPorCategoriaEnRango(porCategoriaYMes, 1);
    expect(resultado.map((r) => r.categoriaId)).toEqual(["b", "a"]);
  });
});

describe("previstoVsRealPorCategoria", () => {
  it("incluye categorías que solo tienen previsto o solo tienen real", () => {
    const previsto = new Map([["hipoteca", 800]]);
    const real = new Map([["ocio", 150]]);
    const resultado = previstoVsRealPorCategoria(previsto, real);

    expect(resultado).toHaveLength(2);
    expect(resultado.find((r) => r.categoriaId === "hipoteca")).toEqual({ categoriaId: "hipoteca", previsto: 800, real: 0 });
    expect(resultado.find((r) => r.categoriaId === "ocio")).toEqual({ categoriaId: "ocio", previsto: 0, real: 150 });
  });
});

describe("ahorroDelMes", () => {
  // aportacionInversionDelMes se pasa siempre en positivo (cuánto se aportó ese mes);
  // flujoNeto ya la incluye restada como si fuera un gasto más.
  it("si la inversión cuenta como ahorro, se suma de vuelta la aportación", () => {
    // flujoNeto = 200 (1000 ingreso, -700 gasto, -100 aportación inversión ya restada)
    expect(ahorroDelMes(200, 100, true)).toBe(300);
  });

  it("si la inversión no cuenta como ahorro, el ahorro es directamente el flujo neto", () => {
    expect(ahorroDelMes(200, 100, false)).toBe(200);
  });
});
