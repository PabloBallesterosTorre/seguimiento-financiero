import { describe, expect, it } from "vitest";
import {
  apuntesPendientesDelMes,
  porcentajes,
  repartir,
  resolverBloques,
  sumarRepartos,
  type CategoriaConBloque,
} from "./regla503020";
import type { MovimientoPrevisto } from "./prevision";

const categorias: CategoriaConBloque[] = [
  { id: "nomina", categoria_padre_id: null, es_categoria_inversion: false, bloque: "ingreso" },
  { id: "vivienda", categoria_padre_id: null, es_categoria_inversion: false, bloque: "necesario" },
  { id: "hipoteca", categoria_padre_id: "vivienda", es_categoria_inversion: false, bloque: null },
  { id: "ocio", categoria_padre_id: null, es_categoria_inversion: false, bloque: "capricho" },
  { id: "restaurantes", categoria_padre_id: "ocio", es_categoria_inversion: false, bloque: null },
  { id: "compras", categoria_padre_id: null, es_categoria_inversion: false, bloque: "capricho" },
  { id: "alimentacion", categoria_padre_id: "compras", es_categoria_inversion: false, bloque: "necesario" },
  { id: "fondos", categoria_padre_id: null, es_categoria_inversion: true, bloque: null },
  { id: "efectivo", categoria_padre_id: null, es_categoria_inversion: false, bloque: null },
];
const bloqueDe = resolverBloques(categorias);

describe("resolverBloques", () => {
  it("una subcategoría sin bloque hereda el de su padre", () => {
    expect(bloqueDe("hipoteca")).toBe("necesario");
    expect(bloqueDe("restaurantes")).toBe("capricho");
  });

  it("el bloque propio de una subcategoría manda sobre el del padre", () => {
    expect(bloqueDe("alimentacion")).toBe("necesario");
  });

  it("las categorías de inversión cuentan como ahorro", () => {
    expect(bloqueDe("fondos")).toBe("ahorro");
  });

  it("sin bloque ni padre con bloque, o sin categoría, queda sin clasificar", () => {
    expect(bloqueDe("efectivo")).toBeNull();
    expect(bloqueDe(null)).toBeNull();
    expect(bloqueDe("no-existe")).toBeNull();
  });
});

describe("repartir", () => {
  it("reparte un mes normal y el ahorro es lo que sobra, inversión incluida", () => {
    const r = repartir(
      [
        { categoria_id: "nomina", importe: 2000 },
        { categoria_id: "hipoteca", importe: -900 },
        { categoria_id: "restaurantes", importe: -400 },
        { categoria_id: "fondos", importe: -300 },
      ],
      bloqueDe
    );
    expect(r).toEqual({ ingresos: 2000, necesario: 900, capricho: 400, inversion: 300, sinClasificar: 0, ahorro: 700 });
  });

  it("netea dentro del bloque: el Bizum de un amigo resta de Caprichos, no suma a ingresos", () => {
    const r = repartir(
      [
        { categoria_id: "nomina", importe: 2000 },
        { categoria_id: "restaurantes", importe: -120 },
        { categoria_id: "restaurantes", importe: 40 },
      ],
      bloqueDe
    );
    expect(r.ingresos).toBe(2000);
    expect(r.capricho).toBe(80);
  });

  it("lo que no tiene bloque sale aparte y también resta del ahorro", () => {
    const r = repartir(
      [
        { categoria_id: "nomina", importe: 1000 },
        { categoria_id: "efectivo", importe: -100 },
        { categoria_id: null, importe: -50 },
      ],
      bloqueDe
    );
    expect(r.sinClasificar).toBe(150);
    expect(r.ahorro).toBe(850);
  });

  it("suma ingresos extra que no vienen de ninguna categoría (intereses previstos)", () => {
    expect(repartir([], bloqueDe, 20).ingresos).toBe(20);
  });
});

describe("porcentajes", () => {
  it("expresa cada bloque sobre los ingresos", () => {
    const r = repartir(
      [
        { categoria_id: "nomina", importe: 1000 },
        { categoria_id: "hipoteca", importe: -500 },
        { categoria_id: "ocio", importe: -300 },
      ],
      bloqueDe
    );
    expect(porcentajes(r)).toEqual({ necesario: 0.5, capricho: 0.3, ahorro: 0.2, sinClasificar: 0 });
  });

  it("sin ingresos no hay reparto", () => {
    expect(porcentajes(repartir([{ categoria_id: "ocio", importe: -10 }], bloqueDe))).toBeNull();
  });
});

describe("apuntesPendientesDelMes y sumarRepartos", () => {
  const previsto = (p: Partial<MovimientoPrevisto>): MovimientoPrevisto =>
    ({
      id: "p",
      categoria_id: null,
      cuenta_id: null,
      tipo: "gasto",
      importe_estimado: 0,
      importe_min: null,
      importe_max: null,
      tipo_recurrencia: "recurrente",
      periodicidad: "mensual",
      fecha: null,
      fecha_inicio: "2026-01-01",
      fecha_fin: null,
      estado: "activo",
      origen_calculo: "fijo",
      ...p,
    }) as MovimientoPrevisto;

  it("convierte los previstos pendientes en apuntes con signo y se salta los traspasos", () => {
    const apuntes = apuntesPendientesDelMes(
      [
        previsto({ id: "n", tipo: "ingreso", categoria_id: "nomina", importe_estimado: 2000 }),
        previsto({ id: "h", categoria_id: "hipoteca", importe_estimado: 900 }),
        previsto({ id: "t", tipo: "traspaso", categoria_id: null, importe_estimado: 500 }),
      ],
      2026,
      11
    );
    expect(apuntes).toEqual([
      { categoria_id: "nomina", importe: 2000 },
      { categoria_id: "hipoteca", importe: -900 },
    ]);
  });

  it("un previsto ya conciliado en el mes no vuelve a contar", () => {
    const apuntes = apuntesPendientesDelMes(
      [previsto({ id: "h", categoria_id: "hipoteca", importe_estimado: 900 })],
      2026,
      11,
      { conciliacionesPorMes: new Map([["h:2026-11", 1]]) }
    );
    expect(apuntes).toEqual([]);
  });

  it("la previsión al cierre es lo real más lo pendiente", () => {
    const real = repartir([{ categoria_id: "nomina", importe: 2000 }, { categoria_id: "ocio", importe: -100 }], bloqueDe);
    const pendiente = repartir([{ categoria_id: "hipoteca", importe: -900 }], bloqueDe);
    expect(sumarRepartos(real, pendiente)).toEqual({
      ingresos: 2000,
      necesario: 900,
      capricho: 100,
      inversion: 0,
      sinClasificar: 0,
      ahorro: 1000,
    });
  });
});
