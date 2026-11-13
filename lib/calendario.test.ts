import { describe, expect, it } from "vitest";
import { construirCalendario, mesVecino } from "./calendario";
import type { MovimientoPrevisto } from "./prevision";

const previsto = (o: Partial<MovimientoPrevisto>): MovimientoPrevisto => ({
  id: "p",
  descripcion: "Hipoteca",
  categoria_id: null,
  cuenta_id: null,
  tipo: "gasto",
  importe_estimado: 500,
  importe_min: null,
  importe_max: null,
  tipo_recurrencia: "recurrente",
  periodicidad: "mensual",
  fecha: null,
  fecha_inicio: "2026-01-20",
  fecha_fin: null,
  estado: "activo",
  origen_calculo: "fijo",
  ...o,
});

describe("mesVecino", () => {
  it("cruza el cambio de año", () => {
    expect(mesVecino("2026-01", -1)).toBe("2025-12");
    expect(mesVecino("2026-12", 1)).toBe("2027-01");
  });
});

describe("construirCalendario", () => {
  it("empieza en lunes y completa semanas enteras", () => {
    // Noviembre de 2026 empieza en domingo: la primera semana trae 6 días de octubre.
    const { semanas } = construirCalendario("2026-11", [], [], [], "2026-11-13");
    expect(semanas[0][0].fecha).toBe("2026-10-26");
    expect(semanas[0][6]).toMatchObject({ fecha: "2026-11-01", delMes: true });
    expect(semanas.every((s) => s.length === 7)).toBe(true);
    expect(semanas.at(-1)!.at(-1)!.fecha).toBe("2026-12-06");
  });

  it("pone cada movimiento en su día y suma el mes sin traspasos", () => {
    const { semanas, resumen } = construirCalendario(
      "2026-11",
      [
        { id: "a", fecha: "2026-11-03", descripcion: "Mercadona", importe: -40, tipo: "gasto" },
        { id: "b", fecha: "2026-11-03", descripcion: "Nómina", importe: 2000, tipo: "ingreso" },
        { id: "c", fecha: "2026-11-04", descripcion: "A la común", importe: -300, tipo: "traspaso" },
        { id: "d", fecha: "2026-10-30", descripcion: "Otro mes", importe: -1, tipo: "gasto" },
      ],
      [],
      [],
      "2026-11-13"
    );
    const dia3 = semanas.flat().find((d) => d.fecha === "2026-11-03")!;
    expect(dia3.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(dia3.neto).toBe(1960);
    expect(resumen).toEqual({ entradas: 2000, salidas: 40, neto: 1960, previstoNeto: 0 });
    expect(semanas.flat().find((d) => d.fecha === "2026-10-30")!.items).toEqual([]);
  });

  it("pinta los previstos pendientes de hoy en adelante y oculta los ya conciliados", () => {
    const p1 = previsto({ id: "hipoteca" });
    const p2 = previsto({ id: "seguro", descripcion: "Seguro", fecha_inicio: "2026-01-05" });
    const p3 = previsto({ id: "ocio", es_presupuesto: true });
    const { semanas, resumen } = construirCalendario(
      "2026-11",
      [],
      [p1, p2, p3],
      [{ previsto_id: "hipoteca", periodo: "2026-11-20" }],
      "2026-11-13"
    );
    const conPrevistos = semanas.flat().filter((d) => d.items.length > 0);
    // Hipoteca: conciliada. Seguro: el día 5 ya pasó. Ocio: presupuesto, sin día.
    expect(conPrevistos).toEqual([]);
    expect(resumen.previstoNeto).toBe(0);

    const sinConciliar = construirCalendario("2026-11", [], [p1], [], "2026-11-13");
    const dia20 = sinConciliar.semanas.flat().find((d) => d.fecha === "2026-11-20")!;
    expect(dia20.items).toEqual([
      { id: "hipoteca:0", descripcion: "Hipoteca", importe: -500, tipo: "gasto", previsto: true },
    ]);
    expect(dia20.neto).toBe(0);
    expect(sinConciliar.resumen.previstoNeto).toBe(-500);
  });
});
