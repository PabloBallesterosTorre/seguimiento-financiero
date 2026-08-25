import { describe, expect, it } from "vitest";
import { formatMoneda } from "./formato";

describe("formatMoneda", () => {
  it("formatea en EUR por defecto", () => {
    expect(formatMoneda(1234.5)).toContain("€");
    expect(formatMoneda(1234.5)).toContain("1234,50");
  });

  it("cambia el símbolo si se pasa otra moneda", () => {
    expect(formatMoneda(10, "USD")).toContain("$");
    // El símbolo exacto de algunas monedas depende de los datos ICU del motor JS
    // (no todos incluyen el juego completo); comprobamos que al menos identifica
    // la moneda de alguna forma (símbolo o código), sin atarnos a un runtime concreto.
    const gbp = formatMoneda(10, "GBP");
    expect(gbp === formatMoneda(10, "EUR") ? false : /£|GBP/.test(gbp)).toBe(true);
  });

  it("respeta el signo negativo", () => {
    expect(formatMoneda(-50, "EUR")).toContain("-");
  });
});
