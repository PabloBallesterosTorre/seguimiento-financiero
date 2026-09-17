import { describe, expect, it } from "vitest";
import { formatMoneda, formatMonedaTabla, formatPorcentaje, formatPrecio } from "./formato";

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

describe("formatMonedaTabla", () => {
  it("agrupa los millares aunque el español no lo haga con cuatro cifras", () => {
    expect(formatMonedaTabla(4372.08)).toContain("4.372,08");
    expect(formatMonedaTabla(143831.58)).toContain("143.831,58");
  });
});

describe("formatPorcentaje", () => {
  it("usa coma decimal y espacio antes del signo", () => {
    expect(formatPorcentaje(1.8)).toBe("1,80 %");
  });

  it("antepone el + solo cuando se pide", () => {
    expect(formatPorcentaje(1.8, { signo: "siempre" })).toBe("+1,80 %");
    expect(formatPorcentaje(-0.5, { signo: "siempre" })).toBe("-0,50 %");
    // El cero no lleva signo aunque se pidan siempre: "+0,00 %" sugiere una subida que no existe.
    expect(formatPorcentaje(0, { signo: "siempre" })).toBe("0,00 %");
  });

  it("respeta los decimales pedidos", () => {
    expect(formatPorcentaje(1.849, { decimales: 1 })).toBe("1,8 %");
    expect(formatPorcentaje(2.2, { decimales: 0 })).toBe("2 %");
  });
});

describe("formatPrecio", () => {
  it("da más decimales cuanto menor es el precio", () => {
    expect(formatPrecio(80.36)).toContain("80,36");
    expect(formatPrecio(0.0748)).toContain("0,0748");
    // Por debajo del céntimo hacen falta seis, que es como se guardan en el libro.
    expect(formatPrecio(0.000123)).toContain("0,000123");
  });

  it("distingue dos precios que con dos decimales se verían iguales", () => {
    expect(formatPrecio(0.0748)).not.toBe(formatPrecio(0.0712));
  });

  it("agrupa los millares en precios altos", () => {
    expect(formatPrecio(1234.5)).toContain("1.234,50");
  });
});
