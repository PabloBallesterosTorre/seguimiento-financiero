import { describe, expect, it } from "vitest";
import {
  netoPorCategoria,
  separarGastosEIngresos,
  SIN_CATEGORIA,
  agruparPorCategoriaPadreYMes,
  mediaPorCategoriaEnRango,
  previstoVsRealPorCategoria,
  ahorroDelMes,
  filtrarMovimientosPorCuentasSeleccionadas,
  resolverCuentasSeleccionadas,
  type MovimientoParaInforme,
} from "./informes";
import { mesDe } from "./mesFinanciero";

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

describe("netoPorCategoria", () => {
  const idem = (id: string) => id;

  it("netea los reembolsos contra el gasto en vez de contarlos como ingreso", () => {
    // El caso real: se paga la cena y los amigos devuelven por Bizum.
    const filas = netoPorCategoria(
      [
        { categoria_id: "restaurantes", tipo: "gasto", importe: -140, fecha: "2026-08-03" },
        { categoria_id: "restaurantes", tipo: "gasto", importe: -60, fecha: "2026-08-05" },
        { categoria_id: "restaurantes", tipo: "ingreso", importe: 70, fecha: "2026-08-06" },
      ],
      idem
    );

    expect(filas).toHaveLength(1);
    expect(filas[0].salidas).toBe(200);
    expect(filas[0].entradas).toBe(70);
    expect(filas[0].neto).toBe(130);
    expect(filas[0].movimientosContrarios).toBe(1);
  });

  it("agrupa las subcategorías en su padre", () => {
    const aPadre = (id: string) => (id === "restaurantes" ? "ocio" : id);
    const filas = netoPorCategoria(
      [
        { categoria_id: "restaurantes", tipo: "gasto", importe: -50, fecha: "2026-08-01" },
        { categoria_id: "ocio", tipo: "gasto", importe: -30, fecha: "2026-08-02" },
      ],
      aPadre
    );

    expect(filas).toHaveLength(1);
    expect(filas[0].categoriaId).toBe("ocio");
    expect(filas[0].neto).toBe(80);
  });

  it("agrupa los movimientos sin categoría en vez de tirarlos", () => {
    // Si desaparecieran, las dos mitades no cuadrarían con el flujo mensual y no habría
    // forma de saber por qué faltan.
    const filas = netoPorCategoria(
      [
        { categoria_id: null, tipo: "gasto", importe: -50, fecha: "2026-08-01" },
        { categoria_id: null, tipo: "ingreso", importe: 1050.13, fecha: "2026-08-02" },
      ],
      idem
    );

    expect(filas).toHaveLength(1);
    expect(filas[0].categoriaId).toBe(SIN_CATEGORIA);
    expect(filas[0].neto).toBeCloseTo(-1000.13, 2);
  });
});

describe("separarGastosEIngresos", () => {
  it("cada categoría cae en un solo lado, según su neto", () => {
    const { gastos, ingresos } = separarGastosEIngresos([
      { categoriaId: "restaurantes", salidas: 2371.6, entradas: 1016.64, neto: 1354.96, movimientosContrarios: 23 },
      { categoriaId: "nomina", salidas: 0, entradas: 2168.36, neto: -2168.36, movimientosContrarios: 0 },
    ]);

    expect(gastos.map((g) => g.categoriaId)).toEqual(["restaurantes"]);
    expect(ingresos.map((i) => i.categoriaId)).toEqual(["nomina"]);
    // Los ingresos se devuelven en positivo, para pintarlos sin pelearse con el signo.
    expect(ingresos[0].neto).toBeCloseTo(2168.36, 2);
  });

  it("descarta las categorías que se anulan solas", () => {
    const { gastos, ingresos } = separarGastosEIngresos([
      { categoriaId: "traspaso-mal-puesto", salidas: 500, entradas: 500, neto: 0, movimientosContrarios: 1 },
    ]);
    expect(gastos).toHaveLength(0);
    expect(ingresos).toHaveLength(0);
  });

  it("ordena de mayor a menor", () => {
    const { gastos } = separarGastosEIngresos([
      { categoriaId: "pequeno", salidas: 10, entradas: 0, neto: 10, movimientosContrarios: 0 },
      { categoriaId: "grande", salidas: 900, entradas: 0, neto: 900, movimientosContrarios: 0 },
    ]);
    expect(gastos.map((g) => g.categoriaId)).toEqual(["grande", "pequeno"]);
  });
});

// ---------------------------------------------------------------------------
// Tanda 12: agrupación por mes financiero
// ---------------------------------------------------------------------------

describe("agruparPorCategoriaPadreYMes con mes financiero", () => {
  const mismaCategoria = (id: string) => id;

  // El caso real: la nómina del 28 de agosto es el ingreso con el que se vive septiembre.
  const movimientos = [
    { categoria_id: "nomina", tipo: "ingreso", importe: 2139.89, fecha: "2026-08-28" },
    { categoria_id: "nomina", tipo: "ingreso", importe: 2175.27, fecha: "2026-07-30" },
  ];

  it("por mes natural, agosto cobra dos veces y septiembre ninguna", () => {
    const porMes = agruparPorCategoriaPadreYMes(movimientos, "ingreso", mismaCategoria).get("nomina")!;
    expect(porMes.get("2026-08")).toBeCloseTo(2139.89, 2);
    expect(porMes.get("2026-09")).toBeUndefined();
  });

  it("con el mes financiero, cada nómina cae en el mes que financia", () => {
    const opciones = { activo: true, diaCorte: 25, anclas: ["2026-07-30", "2026-08-28"] };
    const porMes = agruparPorCategoriaPadreYMes(
      movimientos,
      "ingreso",
      mismaCategoria,
      (f) => mesDe(f, opciones)
    ).get("nomina")!;

    expect(porMes.get("2026-09")).toBeCloseTo(2139.89, 2);
    expect(porMes.get("2026-08")).toBeCloseTo(2175.27, 2);
  });
});
