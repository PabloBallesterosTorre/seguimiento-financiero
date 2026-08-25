import { describe, expect, it } from "vitest";
import { categoriaEfectivaId, importeEstimado, previstoAplicaEnMes, type MovimientoPrevisto } from "./prevision";

function previsto(overrides: Partial<MovimientoPrevisto> = {}): MovimientoPrevisto {
  return {
    id: "p1",
    descripcion: "Test",
    categoria_id: null,
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
