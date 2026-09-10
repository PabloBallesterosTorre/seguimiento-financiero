import { describe, expect, it } from "vitest";
import {
  agruparPorCategoriaPadreYMes,
  mediaPorCategoriaEnRango,
  previstoVsRealPorCategoria,
  ahorroDelMes,
  filtrarMovimientosPorCuentasSeleccionadas,
  resolverCuentasSeleccionadas,
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

describe("filtrarMovimientosPorCuentasSeleccionadas", () => {
  it("traspaso con ambas cuentas seleccionadas: neto cero, no cuenta como gasto ni ingreso", () => {
    const movimientos = [
      { cuenta_id: "A", tipo: "traspaso", importe: -100, traspaso_grupo_id: "g1" },
      { cuenta_id: "B", tipo: "traspaso", importe: 100, traspaso_grupo_id: "g1" },
    ];
    const resultado = filtrarMovimientosPorCuentasSeleccionadas(movimientos, new Set(["A", "B"]));
    expect(resultado).toEqual([]);
  });

  it("traspaso con solo la cuenta origen seleccionada: cuenta como gasto real", () => {
    const movimientos = [
      { cuenta_id: "A", tipo: "traspaso", importe: -100, traspaso_grupo_id: "g1" },
      { cuenta_id: "B", tipo: "traspaso", importe: 100, traspaso_grupo_id: "g1" },
    ];
    const resultado = filtrarMovimientosPorCuentasSeleccionadas(movimientos, new Set(["A"]));
    expect(resultado).toEqual([{ cuenta_id: "A", tipo: "gasto", importe: -100, traspaso_grupo_id: "g1" }]);
  });

  it("traspaso con solo la cuenta destino seleccionada: cuenta como ingreso real", () => {
    const movimientos = [
      { cuenta_id: "A", tipo: "traspaso", importe: -100, traspaso_grupo_id: "g1" },
      { cuenta_id: "B", tipo: "traspaso", importe: 100, traspaso_grupo_id: "g1" },
    ];
    const resultado = filtrarMovimientosPorCuentasSeleccionadas(movimientos, new Set(["B"]));
    expect(resultado).toEqual([{ cuenta_id: "B", tipo: "ingreso", importe: 100, traspaso_grupo_id: "g1" }]);
  });

  it("movimientos normales de ingreso/gasto sin traspaso: sin cambios, solo se filtra por cuenta", () => {
    const movimientos = [
      { cuenta_id: "A", tipo: "ingreso", importe: 1000, traspaso_grupo_id: null },
      { cuenta_id: "A", tipo: "gasto", importe: -50, traspaso_grupo_id: null },
      { cuenta_id: "B", tipo: "gasto", importe: -30, traspaso_grupo_id: null },
    ];
    const resultado = filtrarMovimientosPorCuentasSeleccionadas(movimientos, new Set(["A"]));
    expect(resultado).toEqual([
      { cuenta_id: "A", tipo: "ingreso", importe: 1000, traspaso_grupo_id: null },
      { cuenta_id: "A", tipo: "gasto", importe: -50, traspaso_grupo_id: null },
    ]);
  });

  it("traspaso sin pareja localizada en los datos: se trata como real, no como neto cero", () => {
    const movimientos = [{ cuenta_id: "A", tipo: "traspaso", importe: 200, traspaso_grupo_id: "g-huerfano" }];
    const resultado = filtrarMovimientosPorCuentasSeleccionadas(movimientos, new Set(["A"]));
    expect(resultado).toEqual([{ cuenta_id: "A", tipo: "ingreso", importe: 200, traspaso_grupo_id: "g-huerfano" }]);
  });
});

describe("resolverCuentasSeleccionadas", () => {
  it("sin parámetro en la URL, usa las excluidas guardadas sobre las cuentas activas", () => {
    const resultado = resolverCuentasSeleccionadas(["A", "B", "C"], undefined, ["B"]);
    expect(resultado).toEqual(new Set(["A", "C"]));
  });

  it("con parámetro en la URL, este manda sobre la preferencia guardada", () => {
    const resultado = resolverCuentasSeleccionadas(["A", "B", "C"], "A,C", ["A"]);
    expect(resultado).toEqual(new Set(["A", "C"]));
  });

  it("sin excluidas guardadas y sin parámetro en la URL, todas las activas quedan seleccionadas", () => {
    const resultado = resolverCuentasSeleccionadas(["A", "B"], undefined, []);
    expect(resultado).toEqual(new Set(["A", "B"]));
  });

  it("una cuenta ya no activa que quedó en las excluidas guardadas no rompe nada", () => {
    const resultado = resolverCuentasSeleccionadas(["A"], undefined, ["B-ya-no-existe"]);
    expect(resultado).toEqual(new Set(["A"]));
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
