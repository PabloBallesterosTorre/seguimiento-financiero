import { describe, expect, it } from "vitest";
import { normalizarDescripcion, sugerirCategoria } from "./categorizacion";

describe("normalizarDescripcion", () => {
  it("recorta espacios y pasa a minúsculas", () => {
    expect(normalizarDescripcion("  Mercadona  ")).toBe("mercadona");
  });
});

describe("sugerirCategoria", () => {
  const reglas = [
    { patron_descripcion: "mercadona", categoria_id: "alimentacion", veces_usada: 3 },
    { patron_descripcion: "alquiler piso", categoria_id: "vivienda", veces_usada: 5 },
    { patron_descripcion: "nomina", categoria_id: "ingresos", veces_usada: 1 },
  ];

  it("sugiere por coincidencia exacta", () => {
    expect(sugerirCategoria("Mercadona", reglas)).toBe("alimentacion");
  });

  it("sugiere cuando el patrón está contenido en la descripción (más específica)", () => {
    expect(sugerirCategoria("Mercadona 1234 Madrid", reglas)).toBe("alimentacion");
  });

  it("sugiere cuando la descripción está contenida en un patrón más largo", () => {
    expect(sugerirCategoria("alquiler", reglas)).toBe("vivienda");
  });

  it("devuelve null si no hay ninguna coincidencia", () => {
    expect(sugerirCategoria("Netflix", reglas)).toBeNull();
  });

  it("devuelve null para descripción vacía", () => {
    expect(sugerirCategoria("   ", reglas)).toBeNull();
  });

  it("con varias coincidencias, prioriza el patrón más largo (más específico)", () => {
    const reglasConSolape = [
      { patron_descripcion: "cabify", categoria_id: "transporte-generico", veces_usada: 10 },
      { patron_descripcion: "cabify es 26310zj1vkgw", categoria_id: "transporte-especifico", veces_usada: 1 },
    ];
    expect(sugerirCategoria("Cabify ES 26310zj1vkgw", reglasConSolape)).toBe("transporte-especifico");
  });

  it("en empate de longitud, prioriza la regla más usada", () => {
    const reglasEmpate = [
      { patron_descripcion: "uber eats", categoria_id: "comida-a", veces_usada: 1 },
      { patron_descripcion: "uber trip", categoria_id: "comida-b", veces_usada: 9 },
    ];
    // "uber eats" y "uber trip" tienen la misma longitud; solo "uber eats" coincide aquí,
    // así que forzamos el empate real con dos reglas de igual longitud que ambas coincidan.
    const reglasEmpateReal = [
      { patron_descripcion: "uber", categoria_id: "poco-usada", veces_usada: 1 },
      { patron_descripcion: "uber", categoria_id: "muy-usada", veces_usada: 9 },
    ];
    expect(sugerirCategoria("Uber", reglasEmpateReal)).toBe("muy-usada");
    expect(sugerirCategoria("Uber Eats", reglasEmpate)).toBe("comida-a");
  });

  it("reconoce el mismo tipo de movimiento cuando solo cambia una fecha embebida en la descripción", () => {
    const reglasConFecha = [
      {
        patron_descripcion: "interés neto pagado a cuenta remunerada del aug 23, 2026",
        categoria_id: "ahorro-inversion",
        veces_usada: 1,
      },
    ];
    expect(
      sugerirCategoria("Interés neto pagado a Cuenta Remunerada del Aug 24, 2026", reglasConFecha)
    ).toBe("ahorro-inversion");
    expect(
      sugerirCategoria("Interés neto pagado a Cuenta Remunerada del Sep 1, 2026", reglasConFecha)
    ).toBe("ahorro-inversion");
  });

  it("no aplica el fallback por fecha si la parte estable tras limpiar es demasiado corta", () => {
    const reglasCortas = [{ patron_descripcion: "pago 15 marzo", categoria_id: "otros", veces_usada: 1 }];
    // Sin solape exacto con el patrón, y tras quitar mes/dígitos queda solo "pago" (4
    // caracteres) en ambos lados — demasiado corto y genérico para usarse como fallback.
    expect(sugerirCategoria("Pago 20 abril", reglasCortas)).toBeNull();
  });
});
