import { describe, expect, it } from "vitest";
import { detectarDelimitador, detectarFilaCabecera, parseCSV } from "./csv";

describe("parseCSV", () => {
  it("separa por el delimitador indicado y recorta espacios", () => {
    const filas = parseCSV("a,b,c\n1,2,3", ",");
    expect(filas).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("respeta comas dentro de campos entre comillas", () => {
    const filas = parseCSV('fecha,concepto,importe\n2024-01-01,"NOMINA, EMPRESA SL",2100.00', ",");
    expect(filas[1]).toEqual(["2024-01-01", "NOMINA, EMPRESA SL", "2100.00"]);
  });

  it("descomprime comillas escapadas dobles", () => {
    const filas = parseCSV('col\n"dice ""hola"""', ",");
    expect(filas[1]).toEqual(['dice "hola"']);
  });

  it("descarta filas completamente vacías", () => {
    const filas = parseCSV("a,b\n\n1,2\n\n", ",");
    expect(filas).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("detectarDelimitador", () => {
  it("detecta coma", () => {
    expect(detectarDelimitador("fecha,concepto,importe")).toBe(",");
  });

  it("detecta punto y coma", () => {
    expect(detectarDelimitador("Fecha;Concepto;Importe;Saldo")).toBe(";");
  });
});

describe("detectarFilaCabecera", () => {
  it("devuelve 1 cuando la cabecera es la primera fila (sin filas de metadatos)", () => {
    const filas = [
      ["Fecha", "Concepto", "Importe"],
      ["2024-01-01", "Mercadona", "-45.20"],
      ["2024-01-02", "Nomina", "2100.00"],
    ];
    expect(detectarFilaCabecera(filas)).toBe(1);
  });

  it("salta filas de metadatos de texto antes de la cabecera real", () => {
    const filas = [
      ["Consulta Movimientos de la Cuenta:", "", "", "", "", "", "20859968******333263", ""],
      ["Fecha de generación del informe en Banca Digital: 25/08/2026 10:59:12", "", "", "", "", "", "", ""],
      ["Nº Orden", "Fecha Operacion", "Fecha Valor", "Concepto", "Descripción", "Referencia", "Importe", "Saldo"],
      ["1", "25/08/2026", "25/08/2026", "RECIBO", "BBVA", "123", "-76,25", "215,34"],
      ["2", "17/08/2026", "17/08/2026", "TARJETA VISA", "TULOTERO", "456", "-100,00", "338,59"],
    ];
    expect(detectarFilaCabecera(filas)).toBe(3);
  });

  it("no se despista con columnas opcionales vacías en las filas de datos", () => {
    // Regresión: contar solo celdas no vacías falla aquí porque las filas de datos
    // tienen un número de campos rellenos muy variable según el tipo de movimiento.
    const filas = [
      [
        "datetime",
        "date",
        "account_type",
        "category",
        "type",
        "amount",
        "fee",
        "description",
      ],
      ["2024-02-16T11:00:36Z", "2024-02-16", "DEFAULT", "CASH", "CUSTOMER_INPAYMENT", "500.00", "", "Apple Pay Top up"],
      ["2024-05-15T16:40:48Z", "2024-05-15", "DEFAULT", "CASH", "CARD_ORDERING_FEE", "0.00", "-5.00", "Trade Republic Card"],
    ];
    expect(detectarFilaCabecera(filas)).toBe(1);
  });
});
