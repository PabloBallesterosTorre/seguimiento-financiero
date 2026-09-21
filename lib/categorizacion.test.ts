import { describe, expect, it } from "vitest";
import { mereceRegla, normalizarDescripcion, sugerirCategoria } from "./categorizacion";

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

describe("mereceRegla", () => {
  it("acepta un comercio identificable", () => {
    expect(mereceRegla("MERCADONA VIRGEN CARMEN")).toBe(true);
    expect(mereceRegla("Leroy Merlin")).toBe(true);
    expect(mereceRegla("O2 Fibra - Telefonica De Espana Sau")).toBe(true);
  });

  // El caso que llenó la tabla de reglas muertas: 219 de 285 se habían usado una sola vez
  // porque nacían de descripciones que no pueden repetirse.
  it("rechaza descripciones irrepetibles", () => {
    expect(mereceRegla("PLAYTOMIC.IO 069DF6E5")).toBe(false);
    expect(mereceRegla("Incoming transfer from ANA MARIN CUEVAS (ES8521001065451300503587)")).toBe(false);
    expect(mereceRegla("Saveback cash reward a46d2801-e2c7-428a-a33b-c35b516be19b")).toBe(false);
  });

  // Ibercaja llama "TARJETA VISA" a cualquier pago con tarjeta: el motor había aprendido
  // que significaba Transporte y se lo habría puesto a 25 movimientos de 0,55 € a 163,26 €.
  it("rechaza las etiquetas genéricas del banco", () => {
    expect(mereceRegla("TARJETA VISA")).toBe(false);
    expect(mereceRegla("RECIBO")).toBe(false);
    expect(mereceRegla("TRANSFERENCIA OTRA ENTIDAD")).toBe(false);
  });

  // La misma persona manda dinero por motivos distintos cada vez, así que la categoría es
  // del movimiento, nunca del remitente.
  it("rechaza traspasos y envíos a personas", () => {
    expect(mereceRegla("Bizum payment to: Marta G.G.")).toBe(false);
    expect(mereceRegla("Transferencia a PABLO BALLESTEROS TORRE")).toBe(false);
    expect(mereceRegla("Una recarga de Apple Pay con *1100")).toBe(false);
  });

  it("rechaza lo demasiado corto para identificar nada", () => {
    expect(mereceRegla("ab")).toBe(false);
    expect(mereceRegla("")).toBe(false);
  });
});

describe("mereceRegla y los códigos de referencia", () => {
  // El umbral de 8 caracteres separa una referencia de reserva de un nombre de comercio.
  it("rechaza la referencia pero conserva el comercio", () => {
    expect(mereceRegla("PLAYTOMIC.IO 069DF6E5")).toBe(false);
    expect(mereceRegla("Cabify ES 26374s01vkAR")).toBe(false);
    expect(mereceRegla("WWW.AMAZON* NM6JS1854")).toBe(false);
    expect(mereceRegla("bet365")).toBe(true);
    expect(mereceRegla("O2 Fibra - Telefonica De Espana Sau")).toBe(true);
  });

  // Un número de local corto sí identifica al comercio y debe conservarse.
  it("conserva los números de local", () => {
    expect(mereceRegla("LOTERIAS SANTA SUSANA 41")).toBe(true);
    expect(mereceRegla("EXPENDIDURIA 1 ALGETE")).toBe(true);
  });
});
