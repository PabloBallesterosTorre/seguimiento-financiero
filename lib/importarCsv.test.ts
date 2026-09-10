import { describe, expect, it } from "vitest";
import {
  calcularSaldoTrasImportar,
  combinarImporteConComisionYRetencion,
  detectarFormatoFecha,
  detectarSeparadorDecimal,
  parseFechaImportada,
  parseImporteImportado,
} from "./importarCsv";

describe("parseFechaImportada", () => {
  it("parsea DD/MM/AAAA", () => {
    expect(parseFechaImportada("25/08/2026", "DMY")).toBe("2026-08-25");
  });

  it("parsea AAAA-MM-DD", () => {
    expect(parseFechaImportada("2026-08-25", "YMD")).toBe("2026-08-25");
  });

  it("parsea MM/DD/AAAA", () => {
    expect(parseFechaImportada("08/25/2026", "MDY")).toBe("2026-08-25");
  });

  it("admite fecha-hora ISO con 'T', quedándose solo con la fecha", () => {
    expect(parseFechaImportada("2024-02-16T11:00:36.142310Z", "YMD")).toBe("2024-02-16");
  });

  it("admite fecha-hora separada por espacio (regresión Revolut)", () => {
    expect(parseFechaImportada("2026-07-16 15:22:37", "YMD")).toBe("2026-07-16");
  });

  it("expande año de 2 dígitos a 20XX", () => {
    expect(parseFechaImportada("25/08/26", "DMY")).toBe("2026-08-25");
  });

  it("devuelve null si no tiene 3 partes", () => {
    expect(parseFechaImportada("25-08", "DMY")).toBeNull();
  });

  it("devuelve null con mes o día fuera de rango", () => {
    expect(parseFechaImportada("32/13/2026", "DMY")).toBeNull();
  });

  it("devuelve null para cadena vacía", () => {
    expect(parseFechaImportada("", "DMY")).toBeNull();
  });
});

describe("parseImporteImportado", () => {
  it("con separador coma: punto es miles, coma es decimal", () => {
    expect(parseImporteImportado("-231,75", ",")).toBeCloseTo(-231.75, 2);
    expect(parseImporteImportado("1.234,56", ",")).toBeCloseTo(1234.56, 2);
  });

  it("con separador punto: coma es miles, punto es decimal", () => {
    expect(parseImporteImportado("-231.75", ".")).toBeCloseTo(-231.75, 2);
    expect(parseImporteImportado("1,234.56", ".")).toBeCloseTo(1234.56, 2);
  });

  it("regresión: separador mal puesto multiplica por 100 un importe simple con punto decimal", () => {
    // Esto documenta el bug real que corrompió un import: "-1800.00" con separador
    // coma (incorrecto para este formato) da -180000 en vez de -1800.
    expect(parseImporteImportado("-1800.00", ",")).toBe(-180000);
    expect(parseImporteImportado("-1800.00", ".")).toBe(-1800);
  });

  it("ignora símbolo de moneda y espacios", () => {
    expect(parseImporteImportado(" 45,20 € ", ",")).toBeCloseTo(45.2, 2);
  });

  it("devuelve null para texto no numérico", () => {
    expect(parseImporteImportado("abc", ".")).toBeNull();
  });

  it("devuelve null para cadena vacía", () => {
    expect(parseImporteImportado("", ".")).toBeNull();
  });
});

describe("detectarFormatoFecha", () => {
  it("detecta AAAA-MM-DD por el primer segmento de 4 dígitos", () => {
    expect(detectarFormatoFecha("2026-07-16 15:22:37")).toBe("YMD");
    expect(detectarFormatoFecha("2024-02-16T11:00:36.142310Z")).toBe("YMD");
  });

  it("no arriesga un veredicto para DD/MM vs MM/DD (ambiguo)", () => {
    expect(detectarFormatoFecha("25/08/2026")).toBeNull();
  });
});

describe("detectarSeparadorDecimal", () => {
  it("elige coma si aparece alguna coma en la muestra", () => {
    expect(detectarSeparadorDecimal(["-45,20", "103,00"])).toBe(",");
  });

  it("elige punto si solo aparecen puntos", () => {
    expect(detectarSeparadorDecimal(["-1800.00", "1858.49"])).toBe(".");
  });

  it("por defecto punto si no hay ninguna pista", () => {
    expect(detectarSeparadorDecimal(["100", "200"])).toBe(".");
  });
});

describe("combinarImporteConComisionYRetencion", () => {
  it("suma fee y tax (ya negativos) al importe base", () => {
    expect(combinarImporteConComisionYRetencion(100, "-1,50", "-2,30", ",")).toBeCloseTo(96.2, 2);
  });

  it("solo con fee: se suma y no hace falta tax", () => {
    expect(combinarImporteConComisionYRetencion(100, "-1,50", undefined, ",")).toBeCloseTo(98.5, 2);
  });

  it("solo con tax: se suma y no hace falta fee", () => {
    expect(combinarImporteConComisionYRetencion(100, undefined, "-2,30", ",")).toBeCloseTo(97.7, 2);
  });

  it("sin ninguna columna: el importe queda igual que ahora", () => {
    expect(combinarImporteConComisionYRetencion(100, undefined, undefined, ",")).toBe(100);
  });

  it("fee y tax vacíos en la fila: el importe queda igual (mismo archivo con otras filas que sí los traen)", () => {
    expect(combinarImporteConComisionYRetencion(100, "", "", ",")).toBe(100);
  });

  it("respeta el separador decimal de punto", () => {
    expect(combinarImporteConComisionYRetencion(100, "-1.50", "-2.30", ".")).toBeCloseTo(96.2, 2);
  });
});

describe("calcularSaldoTrasImportar", () => {
  it("suma el neto del lote (ingresos positivos, gastos negativos) al saldo actual", () => {
    const filas = [{ importe: 1000 }, { importe: -200 }, { importe: -100 }];
    expect(calcularSaldoTrasImportar(700, filas)).toBeCloseTo(1400, 2);
  });

  it("con un lote vacío, devuelve el saldo actual sin cambios", () => {
    expect(calcularSaldoTrasImportar(500, [])).toBe(500);
  });

  it("no depende del orden de las filas, solo del total neto", () => {
    const filasA = [{ importe: 300 }, { importe: -50 }];
    const filasB = [{ importe: -50 }, { importe: 300 }];
    expect(calcularSaldoTrasImportar(0, filasA)).toBe(calcularSaldoTrasImportar(0, filasB));
  });

  it("admite saldo actual negativo (cuenta en descubierto)", () => {
    expect(calcularSaldoTrasImportar(-100, [{ importe: 50 }])).toBeCloseTo(-50, 2);
  });
});
