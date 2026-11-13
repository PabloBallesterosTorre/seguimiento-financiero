import { describe, expect, it } from "vitest";
import { fechasPrevistoEnMes, type MovimientoPrevisto } from "./prevision";

const base: MovimientoPrevisto = {
  id: "p",
  descripcion: "x",
  categoria_id: null,
  cuenta_id: null,
  tipo: "gasto",
  importe_estimado: 10,
  importe_min: null,
  importe_max: null,
  tipo_recurrencia: "recurrente",
  periodicidad: "mensual",
  fecha: null,
  fecha_inicio: "2026-01-31",
  fecha_fin: null,
  estado: "activo",
  origen_calculo: "fijo",
};

describe("fechasPrevistoEnMes", () => {
  it("mensual: el mismo día, recortado al final de los meses cortos", () => {
    expect(fechasPrevistoEnMes(base, 2026, 3)).toEqual(["2026-03-31"]);
    expect(fechasPrevistoEnMes(base, 2026, 6)).toEqual(["2026-06-30"]);
    expect(fechasPrevistoEnMes(base, 2026, 2)).toEqual(["2026-02-28"]);
  });

  it("no da fechas antes del inicio, después del fin ni si está pausado", () => {
    expect(fechasPrevistoEnMes(base, 2025, 12)).toEqual([]);
    expect(fechasPrevistoEnMes({ ...base, fecha_fin: "2026-04-30" }, 2026, 5)).toEqual([]);
    expect(fechasPrevistoEnMes({ ...base, estado: "pausado" }, 2026, 3)).toEqual([]);
  });

  it("trimestral: solo en los meses que tocan", () => {
    const p = { ...base, periodicidad: "trimestral" as const, fecha_inicio: "2026-01-15" };
    expect(fechasPrevistoEnMes(p, 2026, 4)).toEqual(["2026-04-15"]);
    expect(fechasPrevistoEnMes(p, 2026, 5)).toEqual([]);
  });

  it("semanal: cada 7 días desde el inicio", () => {
    const p = { ...base, periodicidad: "semanal" as const, fecha_inicio: "2026-10-27" };
    expect(fechasPrevistoEnMes(p, 2026, 11)).toEqual(["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
  });

  it("única vez: su fecha, solo en su mes", () => {
    const p = { ...base, tipo_recurrencia: "unica_vez" as const, periodicidad: null, fecha: "2026-11-17", fecha_inicio: null };
    expect(fechasPrevistoEnMes(p, 2026, 11)).toEqual(["2026-11-17"]);
    expect(fechasPrevistoEnMes(p, 2026, 12)).toEqual([]);
  });
});
