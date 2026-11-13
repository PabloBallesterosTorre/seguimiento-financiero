import { describe, expect, it } from "vitest";
import {
  agruparPorCartera,
  flujoCapitalPorMes,
  ganadoresYPerdedores,
  precioActual,
  rentasPorMes,
  resumenDividendos,
  ultimosMeses,
  type OperacionConRetencion,
} from "./inversiones";

const div = (fecha: string, neto: number, retencion = 0): OperacionConRetencion => ({
  fecha,
  tipo: "dividendo",
  importe: -neto,
  participaciones: null,
  precio: null,
  retencion,
});

describe("resumenDividendos", () => {
  it("suma neto, retención y bruto de los últimos 12 meses y calcula el yield sobre el bruto", () => {
    const r = resumenDividendos(
      [div("2025-11-13", 99), div("2026-03-01", 81, 19), div("2026-09-01", 81, 19)],
      2000,
      "2026-11-13"
    );
    // El cobro de hace exactamente un año queda fuera.
    expect(r.neto12m).toBe(162);
    expect(r.retencion12m).toBe(38);
    expect(r.bruto12m).toBe(200);
    expect(r.yieldPct).toBe(10);
    expect(r.netoTotal).toBe(261);
  });

  it("prevé los próximos 12 meses repitiendo los cobros del último año", () => {
    const r = resumenDividendos([div("2026-03-01", 50), div("2026-09-01", 60)], 1000, "2026-11-13");
    expect(r.previstos).toEqual([
      { fecha: "2027-03-01", neto: 50 },
      { fecha: "2027-09-01", neto: 60 },
    ]);
    expect(r.previsto12m).toBe(110);
  });

  it("un 29 de febrero se prevé el 28 en un año no bisiesto", () => {
    const r = resumenDividendos([div("2028-02-29", 10)], 100, "2028-06-01");
    expect(r.previstos).toEqual([{ fecha: "2029-02-28", neto: 10 }]);
  });

  it("sin dividendos no hay yield", () => {
    const r = resumenDividendos([], 1000, "2026-11-13");
    expect(r.yieldPct).toBeNull();
    expect(r.previstos).toEqual([]);
  });

  it("una posición sin valor no tiene yield aunque cobrara", () => {
    expect(resumenDividendos([div("2026-05-01", 10)], 0, "2026-11-13").yieldPct).toBeNull();
  });
});

describe("rentasPorMes", () => {
  it("agrupa los dividendos por mes y rellena con cero los meses sin cobro", () => {
    const ops = [div("2026-09-01", 10), div("2026-09-20", 5), div("2026-11-02", 7)];
    expect(rentasPorMes(ops, ["2026-09", "2026-10", "2026-11"])).toEqual([
      { mes: "2026-09", importe: 15 },
      { mes: "2026-10", importe: 0 },
      { mes: "2026-11", importe: 7 },
    ]);
  });
});

describe("flujoCapitalPorMes", () => {
  it("cuenta compras y aportaciones como aportado y ventas y retiradas como retirado; ignora dividendos y ajustes", () => {
    const ops: OperacionConRetencion[] = [
      { fecha: "2026-10-03", tipo: "compra", importe: 250, participaciones: 2, precio: 125 },
      { fecha: "2026-10-10", tipo: "aportacion", importe: 50, participaciones: null, precio: null },
      { fecha: "2026-10-20", tipo: "venta", importe: -100, participaciones: -1, precio: 100 },
      { fecha: "2026-10-21", tipo: "ajuste", importe: 30, participaciones: 1, precio: null },
      div("2026-10-25", 12),
    ];
    expect(flujoCapitalPorMes(ops, ["2026-10", "2026-11"])).toEqual([
      { mes: "2026-10", aportado: 300, retirado: 100, neto: 200 },
      { mes: "2026-11", aportado: 0, retirado: 0, neto: 0 },
    ]);
  });
});

describe("ultimosMeses", () => {
  it("devuelve los n meses que terminan en el de hoy, cruzando el cambio de año", () => {
    expect(ultimosMeses("2026-02-15", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("agruparPorCartera", () => {
  it("suma por cuenta, calcula el % sobre lo aportado bruto y ordena por valor", () => {
    const r = agruparPorCartera([
      { cuentaId: "tr", valor: 1100, aportadoBruto: 1000, ganancia: 100 },
      { cuentaId: "tr", valor: 900, aportadoBruto: 1000, ganancia: -100 },
      { cuentaId: "ibkr", valor: 3000, aportadoBruto: 2000, ganancia: 1000 },
      { cuentaId: null, valor: 50, aportadoBruto: 0, ganancia: 50 },
    ]);
    expect(r.map((g) => g.cuentaId)).toEqual(["ibkr", "tr", null]);
    expect(r[0]).toMatchObject({ posiciones: 1, valor: 3000, rentabilidadPct: 50 });
    expect(r[1]).toMatchObject({ posiciones: 2, valor: 2000, ganancia: 0, rentabilidadPct: 0 });
    expect(r[2].rentabilidadPct).toBeNull();
  });
});

describe("ganadoresYPerdedores", () => {
  it("separa por signo, ordena por magnitud y recorta a n; las posiciones a cero no salen", () => {
    const pos = [
      { id: "a", ganancia: 10 },
      { id: "b", ganancia: 300 },
      { id: "c", ganancia: -50 },
      { id: "d", ganancia: 0 },
      { id: "e", ganancia: -400 },
      { id: "f", ganancia: 20 },
    ];
    const r = ganadoresYPerdedores(pos, 2);
    expect(r.ganadores.map((p) => p.id)).toEqual(["b", "f"]);
    expect(r.perdedores.map((p) => p.id)).toEqual(["e", "c"]);
  });
});

describe("precioActual", () => {
  it("divide el valor entre las participaciones", () => {
    expect(precioActual(5589, 90)).toBeCloseTo(62.1);
  });
  it("es null en posiciones sin participaciones o cerradas", () => {
    expect(precioActual(1000, 0)).toBeNull();
  });
});
