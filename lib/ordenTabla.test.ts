import { describe, expect, it } from "vitest";
import { ordenarFilas } from "./ordenTabla";

type Fila = { id: string; nombre: string; importe: number | null };

const filas: Fila[] = [
  { id: "a", nombre: "Beta", importe: 30 },
  { id: "b", nombre: "Alfa", importe: 10 },
  { id: "c", nombre: "Gamma", importe: null },
];

const accesores = {
  nombre: (f: Fila) => f.nombre,
  importe: (f: Fila) => f.importe,
};

describe("ordenarFilas", () => {
  it("sin orden elegido, devuelve las filas en su orden original", () => {
    expect(ordenarFilas(filas, null, accesores)).toEqual(filas);
  });

  it("ordena ascendente por una columna de texto", () => {
    const resultado = ordenarFilas(filas, { columna: "nombre", direccion: "asc" }, accesores);
    expect(resultado.map((f) => f.id)).toEqual(["b", "a", "c"]);
  });

  it("ordena descendente por una columna de texto", () => {
    const resultado = ordenarFilas(filas, { columna: "nombre", direccion: "desc" }, accesores);
    expect(resultado.map((f) => f.id)).toEqual(["c", "a", "b"]);
  });

  it("ordena numéricamente, no como texto (10 antes que 30)", () => {
    const resultado = ordenarFilas(filas, { columna: "importe", direccion: "asc" }, accesores);
    expect(resultado.map((f) => f.id)).toEqual(["b", "a", "c"]);
  });

  it("los valores null van siempre al final, en cualquier dirección", () => {
    const asc = ordenarFilas(filas, { columna: "importe", direccion: "asc" }, accesores);
    const desc = ordenarFilas(filas, { columna: "importe", direccion: "desc" }, accesores);
    expect(asc.at(-1)?.id).toBe("c");
    expect(desc.at(-1)?.id).toBe("c");
  });

  it("una columna desconocida no reordena nada", () => {
    expect(ordenarFilas(filas, { columna: "no-existe", direccion: "asc" }, accesores)).toEqual(filas);
  });

  it("no muta el array original", () => {
    const copia = [...filas];
    ordenarFilas(filas, { columna: "nombre", direccion: "asc" }, accesores);
    expect(filas).toEqual(copia);
  });
});
