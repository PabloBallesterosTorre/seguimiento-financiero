import { describe, expect, it } from "vitest";
import { desfaseSaldo, diagnosticarSaldos, hayDesfase, saldoEsperado } from "./saldos";

describe("saldoEsperado", () => {
  it("suma los movimientos al saldo inicial", () => {
    expect(saldoEsperado(100, [{ importe: 50 }, { importe: -20 }])).toBe(130);
  });

  it("devuelve el saldo inicial cuando la cuenta no tiene movimientos", () => {
    expect(saldoEsperado(762.28, [])).toBe(762.28);
  });

  it("redondea al céntimo el error de coma flotante de sumar muchos importes", () => {
    const movimientos = Array.from({ length: 3 }, () => ({ importe: 0.1 }));
    expect(saldoEsperado(0, movimientos)).toBe(0.3);
  });
});

describe("desfaseSaldo", () => {
  it("es cero cuando el saldo guardado cuadra con los movimientos", () => {
    expect(desfaseSaldo(130, 100, [{ importe: 50 }, { importe: -20 }])).toBe(0);
  });

  it("es positivo cuando la cuenta muestra más dinero del que justifican sus movimientos", () => {
    expect(desfaseSaldo(150, 100, [{ importe: 30 }])).toBe(20);
  });

  // El caso real que motivó esta migración: Trade Republic mostraba 12.326,86 € con
  // 12.450,19 € en movimientos y una cuenta abierta a cero.
  it("es negativo cuando la cuenta muestra menos dinero del que justifican sus movimientos", () => {
    expect(desfaseSaldo(12326.86, 0, [{ importe: 12450.19 }])).toBe(-123.33);
  });
});

describe("hayDesfase", () => {
  it("no considera desfase una diferencia por debajo del céntimo", () => {
    expect(hayDesfase(0.3, 0, [{ importe: 0.1 }, { importe: 0.1 }, { importe: 0.1 }])).toBe(false);
  });

  it("considera desfase una diferencia de un céntimo", () => {
    expect(hayDesfase(100.01, 0, [{ importe: 100 }])).toBe(true);
  });
});

describe("diagnosticarSaldos", () => {
  const cuentas = [
    { id: "ok", saldo_actual: 130, saldo_inicial: 100 },
    { id: "descuadrada", saldo_actual: 500, saldo_inicial: 0 },
    { id: "sin-movimientos", saldo_actual: 250, saldo_inicial: 250 },
  ];
  const movimientos = [
    { cuenta_id: "ok", importe: 50 },
    { cuenta_id: "ok", importe: -20 },
    { cuenta_id: "descuadrada", importe: 400 },
  ];

  it("solo devuelve las cuentas descuadradas", () => {
    const diagnostico = diagnosticarSaldos(cuentas, movimientos);
    expect([...diagnostico.keys()]).toEqual(["descuadrada"]);
  });

  it("indica el desfase y el saldo que debería tener", () => {
    const diagnostico = diagnosticarSaldos(cuentas, movimientos);
    expect(diagnostico.get("descuadrada")).toEqual({
      cuentaId: "descuadrada",
      desfase: 100,
      saldoEsperado: 400,
    });
  });

  // Una cuenta recién creada no tiene movimientos todavía: su saldo inicial ES su
  // saldo, y no debe salir marcada como descuadrada.
  it("no marca como descuadrada una cuenta sin movimientos cuyo saldo es el inicial", () => {
    expect(diagnosticarSaldos(cuentas, movimientos).has("sin-movimientos")).toBe(false);
  });
});
