import { describe, expect, it } from "vitest";
import {
  categoriaEfectivaId,
  construirDiagnosticoPrevision,
  importeEfectivoPrevisto,
  importeEstimado,
  previstoAplicaEnMes,
  type CategoriaInfo,
  type MovimientoPrevisto,
} from "./prevision";

function previsto(overrides: Partial<MovimientoPrevisto> = {}): MovimientoPrevisto {
  return {
    id: "p1",
    descripcion: "Test",
    categoria_id: null,
    cuenta_id: null,
    tipo: "gasto",
    importe_estimado: 100,
    importe_min: null,
    importe_max: null,
    tipo_recurrencia: "recurrente",
    periodicidad: "mensual",
    fecha: null,
    fecha_inicio: "2026-01-01",
    fecha_fin: null,
    estado: "activo",
    movimiento_real_id: null,
    origen_calculo: "fijo",
    ...overrides,
  };
}

describe("importeEstimado", () => {
  it("usa el importe fijo si no hay rango", () => {
    expect(importeEstimado({ importe_estimado: 50, importe_min: null, importe_max: null })).toBe(50);
  });

  it("usa el punto medio del rango si hay min y max", () => {
    expect(importeEstimado({ importe_estimado: 0, importe_min: 30, importe_max: 70 })).toBe(50);
  });
});

describe("importeEfectivoPrevisto", () => {
  it("un previsto fijo usa siempre su importe guardado, aunque haya una media disponible", () => {
    const p = previsto({ origen_calculo: "fijo", categoria_id: "ocio", tipo: "gasto", importe_estimado: 40 });
    const medias = new Map([["gasto:ocio", 999]]);
    expect(importeEfectivoPrevisto(p, medias)).toBe(40);
  });

  it("un previsto de nivel 2 usa la media recalculada en vez del importe congelado", () => {
    const p = previsto({ origen_calculo: "media_categoria", categoria_id: "ocio", tipo: "gasto", importe_estimado: 40 });
    const medias = new Map([["gasto:ocio", 65]]);
    expect(importeEfectivoPrevisto(p, medias)).toBe(65);
  });

  it("un previsto de nivel 2 sin media disponible cae al importe guardado como respaldo", () => {
    const p = previsto({ origen_calculo: "media_categoria", categoria_id: "ocio", tipo: "gasto", importe_estimado: 40 });
    expect(importeEfectivoPrevisto(p, new Map())).toBe(40);
  });
});

describe("previstoAplicaEnMes", () => {
  it("no aplica si está pausado", () => {
    expect(previstoAplicaEnMes(previsto({ estado: "pausado" }), 2026, 3)).toBe(false);
  });

  it("única vez: aplica solo en el mes exacto de su fecha", () => {
    const p = previsto({ tipo_recurrencia: "unica_vez", fecha: "2026-06-15" });
    expect(previstoAplicaEnMes(p, 2026, 6)).toBe(true);
    expect(previstoAplicaEnMes(p, 2026, 7)).toBe(false);
  });

  it("recurrente mensual: aplica todos los meses desde fecha_inicio", () => {
    const p = previsto({ periodicidad: "mensual", fecha_inicio: "2026-03-01" });
    expect(previstoAplicaEnMes(p, 2026, 2)).toBe(false);
    expect(previstoAplicaEnMes(p, 2026, 3)).toBe(true);
    expect(previstoAplicaEnMes(p, 2027, 1)).toBe(true);
  });

  it("recurrente mensual: deja de aplicar después de fecha_fin", () => {
    const p = previsto({ periodicidad: "mensual", fecha_inicio: "2026-01-01", fecha_fin: "2026-06-30" });
    expect(previstoAplicaEnMes(p, 2026, 6)).toBe(true);
    expect(previstoAplicaEnMes(p, 2026, 7)).toBe(false);
  });

  it("recurrente anual: solo aplica en el mes de fecha_inicio, cada año", () => {
    const p = previsto({ periodicidad: "anual", fecha_inicio: "2026-06-10" });
    expect(previstoAplicaEnMes(p, 2026, 6)).toBe(true);
    expect(previstoAplicaEnMes(p, 2027, 6)).toBe(true);
    expect(previstoAplicaEnMes(p, 2026, 7)).toBe(false);
  });
});

describe("categoriaEfectivaId (fix bug 'Sin Categoría' en previsiones)", () => {
  it("usa la categoría propia si no está conciliada con ningún movimiento real", () => {
    const p = previsto({ categoria_id: "cat-previsto", movimiento_real_id: null });
    expect(categoriaEfectivaId(p, new Map())).toBe("cat-previsto");
  });

  it("usa la categoría del movimiento real conciliado, no la de la previsión", () => {
    const p = previsto({ categoria_id: null, movimiento_real_id: "mov-1" });
    const mapa = new Map([["mov-1", "cat-del-movimiento-real"]]);
    expect(categoriaEfectivaId(p, mapa)).toBe("cat-del-movimiento-real");
  });

  it("la categoría del movimiento real prevalece incluso si la previsión también tenía una", () => {
    const p = previsto({ categoria_id: "cat-vieja-de-la-prevision", movimiento_real_id: "mov-1" });
    const mapa = new Map([["mov-1", "cat-nueva-del-real"]]);
    expect(categoriaEfectivaId(p, mapa)).toBe("cat-nueva-del-real");
  });

  it("si el movimiento real vinculado no tiene categoría, cae a 'sin categoría' (null)", () => {
    const p = previsto({ categoria_id: "cat-vieja", movimiento_real_id: "mov-1" });
    const mapa = new Map<string, string | null>([["mov-1", null]]);
    expect(categoriaEfectivaId(p, mapa)).toBeNull();
  });
});

describe("construirDiagnosticoPrevision", () => {
  const meses = [
    { year: 2026, month: 1 },
    { year: 2026, month: 2 },
  ];
  const categorias: CategoriaInfo[] = [
    { id: "ocio", nombre: "Ocio", categoria_padre_id: null },
    { id: "restaurantes", nombre: "Restaurantes", categoria_padre_id: "ocio" },
    { id: "cine", nombre: "Cine", categoria_padre_id: "ocio" },
    { id: "hipoteca", nombre: "Pago Hipoteca", categoria_padre_id: null },
  ];

  it("agrega el importe de las subcategorías en la fila de su categoría padre", () => {
    const previstos = [
      previsto({ categoria_id: "restaurantes", importe_estimado: 100, fecha_inicio: "2026-01-01" }),
      previsto({ categoria_id: "cine", importe_estimado: 30, fecha_inicio: "2026-01-01" }),
    ];

    const filas = construirDiagnosticoPrevision(previstos, meses, categorias);
    const ocio = filas.find((f) => f.categoriaId === "ocio");

    expect(ocio?.importesPorMes[0]).toBeCloseTo(-130, 2);
    expect(ocio?.subfilas.map((s) => s.categoriaId).sort()).toEqual(["cine", "restaurantes"]);
  });

  it("un previsto de nivel 2 usa la media recalculada y marca la celda como media (mediaPorMes)", () => {
    const previstos = [
      previsto({ categoria_id: "ocio", tipo: "gasto", importe_estimado: 40, origen_calculo: "media_categoria", fecha_inicio: "2026-01-01" }),
    ];
    const mediaPorCategoria = new Map([["gasto:ocio", 75]]);

    const filas = construirDiagnosticoPrevision(previstos, meses, categorias, new Map(), mediaPorCategoria);
    const ocio = filas.find((f) => f.categoriaId === "ocio");

    expect(ocio?.importesPorMes[0]).toBeCloseTo(-75, 2);
    expect(ocio?.mediaPorMes[0]).toBe(true);
  });

  it("un previsto fijo no marca la celda como media", () => {
    const previstos = [previsto({ categoria_id: "hipoteca", importe_estimado: 600, fecha_inicio: "2026-01-01" })];
    const filas = construirDiagnosticoPrevision(previstos, meses, categorias);
    const hipoteca = filas.find((f) => f.categoriaId === "hipoteca");

    expect(hipoteca?.mediaPorMes[0]).toBe(false);
  });

  it("no mezcla categorías padre distintas entre sí", () => {
    const previstos = [
      previsto({ categoria_id: "restaurantes", importe_estimado: 100, fecha_inicio: "2026-01-01" }),
      previsto({ categoria_id: "hipoteca", importe_estimado: 600, fecha_inicio: "2026-01-01" }),
    ];

    const filas = construirDiagnosticoPrevision(previstos, meses, categorias);

    expect(filas.find((f) => f.categoriaId === "ocio")?.importesPorMes[0]).toBeCloseTo(-100, 2);
    expect(filas.find((f) => f.categoriaId === "hipoteca")?.importesPorMes[0]).toBeCloseTo(-600, 2);
  });

  it("deja la celda en 0 para un mes en el que la previsión no aplica (fuera de rango)", () => {
    const previstos = [
      previsto({
        categoria_id: "hipoteca",
        importe_estimado: 600,
        tipo_recurrencia: "unica_vez",
        fecha: "2026-01-15",
        fecha_inicio: null,
      }),
    ];

    const filas = construirDiagnosticoPrevision(previstos, meses, categorias);
    const hipoteca = filas.find((f) => f.categoriaId === "hipoteca");

    expect(hipoteca?.importesPorMes).toEqual([-600, 0]);
  });

  it("incluye una fila de intereses previstos como categoría propia", () => {
    const intereses = new Map([["2026-1", 12.5]]);
    const filas = construirDiagnosticoPrevision([], meses, categorias, intereses);

    const filaIntereses = filas.find((f) => f.nombre === "Intereses (cuentas remuneradas)");
    expect(filaIntereses?.importesPorMes).toEqual([12.5, 0]);
  });

  it("agrupa los previstos sin categoría en su propia fila", () => {
    const previstos = [previsto({ categoria_id: null, importe_estimado: 50, fecha_inicio: "2026-01-01" })];
    const filas = construirDiagnosticoPrevision(previstos, meses, categorias);

    const sinCategoria = filas.find((f) => f.nombre === "Sin categoría");
    expect(sinCategoria?.importesPorMes[0]).toBeCloseTo(-50, 2);
  });
});
