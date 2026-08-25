import { describe, expect, it } from "vitest";
import { encontrarCandidatosTraspaso, type MovimientoParaEmparejar } from "./traspasos";

function mov(overrides: Partial<MovimientoParaEmparejar> = {}): MovimientoParaEmparejar {
  return {
    id: "m1",
    cuenta_id: "cuenta-a",
    fecha: "2026-06-10",
    importe: -100,
    tipo: "gasto",
    descripcion: "Transferencia",
    cuentas: { nombre: "Cuenta A", banco_nombre: "Banco A" },
    ...overrides,
  };
}

describe("encontrarCandidatosTraspaso", () => {
  it("encuentra un movimiento de signo opuesto en otra cuenta con el mismo importe y fecha cercana", () => {
    const actual = mov({ id: "origen", cuenta_id: "cuenta-a", importe: -100, fecha: "2026-06-10" });
    const contraparte = mov({ id: "destino", cuenta_id: "cuenta-b", importe: 100, fecha: "2026-06-11" });

    const candidatos = encontrarCandidatosTraspaso(actual, [actual, contraparte]);
    expect(candidatos.map((c) => c.id)).toEqual(["destino"]);
  });

  it("no propone movimientos de la misma cuenta", () => {
    const actual = mov({ id: "origen", cuenta_id: "cuenta-a", importe: -100 });
    const mismaCuenta = mov({ id: "otro", cuenta_id: "cuenta-a", importe: 100 });

    expect(encontrarCandidatosTraspaso(actual, [actual, mismaCuenta])).toEqual([]);
  });

  it("no propone movimientos con el mismo signo", () => {
    const actual = mov({ id: "origen", cuenta_id: "cuenta-a", importe: -100 });
    const mismoSigno = mov({ id: "otro", cuenta_id: "cuenta-b", importe: -100 });

    expect(encontrarCandidatosTraspaso(actual, [actual, mismoSigno])).toEqual([]);
  });

  it("no propone movimientos con importe distinto", () => {
    const actual = mov({ id: "origen", cuenta_id: "cuenta-a", importe: -100 });
    const importeDistinto = mov({ id: "otro", cuenta_id: "cuenta-b", importe: 50 });

    expect(encontrarCandidatosTraspaso(actual, [actual, importeDistinto])).toEqual([]);
  });

  it("no propone movimientos fuera de la ventana de fechas", () => {
    const actual = mov({ id: "origen", cuenta_id: "cuenta-a", importe: -100, fecha: "2026-06-10" });
    const lejano = mov({ id: "otro", cuenta_id: "cuenta-b", importe: 100, fecha: "2026-07-01" });

    expect(encontrarCandidatosTraspaso(actual, [actual, lejano])).toEqual([]);
  });

  it("no propone movimientos que ya son traspaso", () => {
    const actual = mov({ id: "origen", cuenta_id: "cuenta-a", importe: -100 });
    const yaTraspaso = mov({ id: "otro", cuenta_id: "cuenta-b", importe: 100, tipo: "traspaso" });

    expect(encontrarCandidatosTraspaso(actual, [actual, yaTraspaso])).toEqual([]);
  });
});
