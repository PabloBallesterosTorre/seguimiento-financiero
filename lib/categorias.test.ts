import { describe, expect, it } from "vitest";
import { ordenarCategoriasJerarquia } from "./categorias";

describe("ordenarCategoriasJerarquia", () => {
  it("ordena cada categoría padre seguida de sus subcategorías indentadas", () => {
    const categorias = [
      { id: "sub-super", nombre: "Supermercado", categoria_padre_id: "alimentacion" },
      { id: "alimentacion", nombre: "Alimentación", categoria_padre_id: null },
      { id: "vivienda", nombre: "Vivienda", categoria_padre_id: null },
      { id: "sub-rest", nombre: "Restaurantes", categoria_padre_id: "alimentacion" },
    ];

    const resultado = ordenarCategoriasJerarquia(categorias);

    expect(resultado.map((c) => c.id)).toEqual(["alimentacion", "sub-super", "sub-rest", "vivienda"]);
    expect(resultado.find((c) => c.id === "sub-super")?.label).toBe("— Supermercado");
    expect(resultado.find((c) => c.id === "alimentacion")?.label).toBe("Alimentación");
  });

  it("categorías sin subcategorías no generan huecos", () => {
    const categorias = [{ id: "ocio", nombre: "Ocio", categoria_padre_id: null }];
    expect(ordenarCategoriasJerarquia(categorias)).toEqual([{ id: "ocio", nombre: "Ocio", label: "Ocio" }]);
  });
});
