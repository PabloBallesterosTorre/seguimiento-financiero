import { describe, expect, it } from "vitest";
import {
  costeTuParte,
  estadoHipoteca,
  inmueblePorCategoria,
  mesesHasta,
  rendimientoInmueble,
  revalorizacion,
  valorInmueblesEnMes,
  valorTuParte,
} from "./inmuebles";

const piso = { valor_actual: 250000, porcentaje_propiedad: 50, precio_compra: 180000, gastos_compra: 20000 };

describe("valor y revalorización", () => {
  it("el valor de tu parte aplica el porcentaje de propiedad", () => {
    expect(valorTuParte(piso)).toBe(125000);
    expect(valorTuParte({ valor_actual: null, porcentaje_propiedad: 100 })).toBe(0);
  });

  it("el coste incluye los gastos de compra", () => {
    expect(costeTuParte(piso)).toBe(100000);
    expect(costeTuParte({ ...piso, precio_compra: null })).toBeNull();
  });

  it("la revalorización se mide contra el coste de tu parte", () => {
    expect(revalorizacion(piso)).toEqual({ abs: 25000, pct: 25 });
    expect(revalorizacion({ ...piso, valor_actual: null })).toBeNull();
  });
});

describe("estadoHipoteca", () => {
  const deuda = {
    capital_inicial: 160000,
    capital_pendiente: 120000,
    cuota: 600,
    tipo_interes: 3,
    fecha_fin: "2050-06-24",
    valor_residual: null,
  };

  it("reparte la próxima cuota entre interés y capital", () => {
    const e = estadoHipoteca(deuda, "2026-11-13");
    expect(e.interesCuota).toBe(300);
    expect(e.capitalCuota).toBe(300);
    expect(e.pctDevuelto).toBe(25);
    expect(e.mesesRestantes).toBe(283);
  });

  it("sin tipo de interés toda la cuota es capital", () => {
    const e = estadoHipoteca({ ...deuda, tipo_interes: null, fecha_fin: null }, "2026-11-13");
    expect(e.interesCuota).toBe(0);
    expect(e.capitalCuota).toBe(600);
    expect(e.mesesRestantes).toBeNull();
  });
});

describe("mesesHasta", () => {
  it("cruza el cambio de año", () => {
    expect(mesesHasta("2026-02-10", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("rendimientoInmueble", () => {
  const hipoteca = estadoHipoteca(
    { capital_inicial: 160000, capital_pendiente: 120000, cuota: 600, tipo_interes: 3, fecha_fin: null, valor_residual: null },
    "2026-11-13"
  );

  it("separa rentas, gastos y cuotas y saca flujo y rentabilidades", () => {
    const movs = [
      { fecha: "2026-10-05", importe: 1000, esCuotaHipoteca: false },
      { fecha: "2026-11-05", importe: 1000, esCuotaHipoteca: false },
      { fecha: "2026-10-02", importe: -100, esCuotaHipoteca: false },
      { fecha: "2026-11-02", importe: -100, esCuotaHipoteca: false },
      { fecha: "2026-10-30", importe: -600, esCuotaHipoteca: true },
      { fecha: "2026-11-01", importe: -600, esCuotaHipoteca: true },
      // Fuera de la ventana de 12 meses: no cuenta.
      { fecha: "2025-10-30", importe: 5000, esCuotaHipoteca: false },
    ];
    const r = rendimientoInmueble(movs, 120000, hipoteca, "2026-11-13");
    expect(r.mesesConDatos).toBe(2);
    expect(r.ingresos).toBe(2000);
    expect(r.gastos).toBe(200);
    expect(r.cuotas).toBe(1200);
    expect(r.interesesEstimados).toBe(600);
    expect(r.flujoMensual).toBe(300);
    // 2000 € en 2 meses → 12000 €/año sobre 120000 € = 10 %.
    expect(r.rentabilidadBruta).toBeCloseTo(10);
    // (2000 − 200 − 600) / 2 × 12 = 7200 €/año → 6 %.
    expect(r.rentabilidadNeta).toBeCloseTo(6);
    expect(r.meses).toHaveLength(12);
    expect(r.meses.at(-1)).toEqual({ mes: "2026-11", ingresos: 1000, gastos: 100, cuotas: 600, neto: 300 });
  });

  it("sin movimientos ni valor no inventa rentabilidades", () => {
    const r = rendimientoInmueble([], 0, null, "2026-11-13");
    expect(r.mesesConDatos).toBe(0);
    expect(r.flujoMensual).toBe(0);
    expect(r.rentabilidadBruta).toBeNull();
    expect(r.rentabilidadNeta).toBeNull();
  });
});

describe("inmueblePorCategoria", () => {
  it("aprende una categoría propia de un inmueble", () => {
    const m = inmueblePorCategoria([
      { categoria_id: "comunidad", inmueble_id: "piso" },
      { categoria_id: "comunidad", inmueble_id: "piso" },
      { categoria_id: "comunidad", inmueble_id: null },
    ]);
    expect(m.get("comunidad")).toBe("piso");
  });

  it("no aprende con un solo vínculo, con mayoría sin vincular ni con dos inmuebles", () => {
    const m = inmueblePorCategoria([
      { categoria_id: "ibi", inmueble_id: "piso" },
      { categoria_id: "suministros", inmueble_id: "piso" },
      { categoria_id: "suministros", inmueble_id: "piso" },
      { categoria_id: "suministros", inmueble_id: null },
      { categoria_id: "suministros", inmueble_id: null },
      { categoria_id: "suministros", inmueble_id: null },
      { categoria_id: "seguro", inmueble_id: "piso" },
      { categoria_id: "seguro", inmueble_id: "otro" },
      { categoria_id: null, inmueble_id: "piso" },
    ]);
    expect(m.size).toBe(0);
  });
});

describe("valorInmueblesEnMes", () => {
  it("cuenta cada inmueble desde su mes de compra", () => {
    const inmuebles = [
      { valor_actual: 200000, porcentaje_propiedad: 100, fecha_compra: "2024-11-24" },
      { valor_actual: 100000, porcentaje_propiedad: 50, fecha_compra: null },
    ];
    expect(valorInmueblesEnMes(inmuebles, 2024, 10)).toBe(50000);
    expect(valorInmueblesEnMes(inmuebles, 2024, 11)).toBe(250000);
  });
});
