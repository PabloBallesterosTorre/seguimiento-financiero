import { describe, it, expect } from "vitest";
import {
  inicioMesFinanciero,
  finMesFinanciero,
  mesDe,
  caeEnMes,
  descripcionMes,
  OPCIONES_MES_NATURAL,
  type OpcionesMesFinanciero,
} from "./mesFinanciero";

// Las nóminas reales del usuario. Incluyen a propósito la paga extra del 15 de junio,
// que es el caso que rompería un "coge la nómina del mes" ingenuo.
const NOMINAS = ["2026-05-28", "2026-06-15", "2026-06-29", "2026-07-30", "2026-08-28"];
const OPC: OpcionesMesFinanciero = { activo: true, diaCorte: 25, anclas: NOMINAS };

describe("inicioMesFinanciero", () => {
  it("ancla cada mes en la nómina con la que se vive", () => {
    expect(inicioMesFinanciero(2026, 6, OPC)).toBe("2026-05-28");
    expect(inicioMesFinanciero(2026, 7, OPC)).toBe("2026-06-29");
    expect(inicioMesFinanciero(2026, 8, OPC)).toBe("2026-07-30");
    expect(inicioMesFinanciero(2026, 9, OPC)).toBe("2026-08-28");
  });

  it("ignora la paga extra de mediados de mes", () => {
    // Si el 15 de junio contara, julio empezaría el 15 de junio y se comería medio mes.
    expect(inicioMesFinanciero(2026, 7, OPC)).not.toBe("2026-06-15");
  });

  it("cae al día de corte cuando todavía no hay nómina", () => {
    // Octubre: la nómina de finales de septiembre aún no ha entrado.
    expect(inicioMesFinanciero(2026, 10, OPC)).toBe("2026-09-25");
  });

  it("respeta el día de corte configurado en el respaldo", () => {
    expect(inicioMesFinanciero(2026, 10, { ...OPC, diaCorte: 20 })).toBe("2026-09-20");
  });

  it("recorta el día de corte a los días que tiene el mes", () => {
    expect(inicioMesFinanciero(2026, 3, { activo: true, diaCorte: 30, anclas: [] })).toBe("2026-02-28");
  });

  it("cruza el cambio de año", () => {
    const opc = { activo: true, diaCorte: 25, anclas: ["2025-12-30"] };
    expect(inicioMesFinanciero(2026, 1, opc)).toBe("2025-12-30");
  });

  it("desactivado, el mes empieza el día 1", () => {
    expect(inicioMesFinanciero(2026, 9, OPCIONES_MES_NATURAL)).toBe("2026-09-01");
  });
});

describe("finMesFinanciero", () => {
  it("termina la víspera del inicio del mes siguiente", () => {
    expect(finMesFinanciero(2026, 8, OPC)).toBe("2026-08-27");
    expect(finMesFinanciero(2026, 7, OPC)).toBe("2026-07-29");
  });

  it("no deja huecos ni solapes entre meses consecutivos", () => {
    for (const [y, m] of [[2026, 6], [2026, 7], [2026, 8], [2026, 9]] as [number, number][]) {
      const fin = new Date(`${finMesFinanciero(y, m, OPC)}T00:00:00Z`);
      fin.setUTCDate(fin.getUTCDate() + 1);
      const siguiente = m === 12 ? [y + 1, 1] : [y, m + 1];
      expect(fin.toISOString().slice(0, 10)).toBe(inicioMesFinanciero(siguiente[0], siguiente[1], OPC));
    }
  });

  it("desactivado, termina el último día natural", () => {
    expect(finMesFinanciero(2026, 2, OPCIONES_MES_NATURAL)).toBe("2026-02-28");
    expect(finMesFinanciero(2024, 2, OPCIONES_MES_NATURAL)).toBe("2024-02-29");
  });
});

describe("mesDe", () => {
  it("la nómina del 28 de agosto es el ingreso de septiembre", () => {
    expect(mesDe("2026-08-28", OPC)).toBe("2026-09");
  });

  it("un gasto de mediados de agosto sigue siendo de agosto", () => {
    expect(mesDe("2026-08-15", OPC)).toBe("2026-08");
  });

  it("el último día del mes natural puede pertenecer al siguiente", () => {
    // La frontera de agosto está el día 30 de julio, así que el 31 ya es agosto.
    expect(mesDe("2026-07-31", OPC)).toBe("2026-08");
    expect(mesDe("2026-07-29", OPC)).toBe("2026-07");
  });

  it("la paga extra cuenta en el mes en que se cobró", () => {
    expect(mesDe("2026-06-15", OPC)).toBe("2026-06");
  });

  it("desactivado, devuelve el mes natural", () => {
    expect(mesDe("2026-08-28", OPCIONES_MES_NATURAL)).toBe("2026-08");
  });

  it("cada fecha cae en uno y solo un mes", () => {
    const d = new Date(Date.UTC(2026, 4, 1));
    const vistos = new Map<string, number>();
    while (d < new Date(Date.UTC(2026, 9, 1))) {
      const fecha = d.toISOString().slice(0, 10);
      const mes = mesDe(fecha, OPC);
      expect(caeEnMes(fecha, Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), OPC)).toBe(true);
      vistos.set(mes, (vistos.get(mes) ?? 0) + 1);
      d.setUTCDate(d.getUTCDate() + 1);
    }
    // Los meses completos del recorrido tienen los días que les tocan; el primero y el
    // último quedan cortados por los extremos del bucle y no se comprueban.
    for (const mes of ["2026-06", "2026-07", "2026-08", "2026-09"]) {
      expect(vistos.get(mes)).toBeGreaterThan(25);
      expect(vistos.get(mes)).toBeLessThan(35);
    }
  });
});

describe("descripcionMes", () => {
  it("explica el desfase en palabras", () => {
    expect(descripcionMes(2026, 8, OPC)).toBe("del 30 de julio al 27 de agosto");
  });

  it("el mes en curso se cierra en el día de corte mientras no llegue su nómina", () => {
    // Septiembre acaba cuando entre la nómina de finales de septiembre. Hasta entonces
    // la frontera es el respaldo, y la descripción lo refleja en vez de inventarse una.
    expect(descripcionMes(2026, 9, OPC)).toBe("del 28 de agosto al 24 de septiembre");
  });
});
