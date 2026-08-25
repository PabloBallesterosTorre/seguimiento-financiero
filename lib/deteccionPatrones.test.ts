import { describe, expect, it } from "vitest";
import { detectarMediaPorCategoria, detectarPatronesPorDescripcion, type MovimientoHistorico } from "./deteccionPatrones";

function mov(overrides: Partial<MovimientoHistorico>): MovimientoHistorico {
  return {
    descripcion: "Test",
    categoria_id: null,
    tipo: "gasto",
    importe: -10,
    fecha: "2026-01-01",
    ...overrides,
  };
}

describe("detectarPatronesPorDescripcion", () => {
  it("detecta un patrón mensual con al menos 3 repeticiones ~30 días", () => {
    const movimientos = [1, 2, 3, 4, 5, 6].map((mes) =>
      mov({
        descripcion: "Nomina Empresa",
        categoria_id: "nomina",
        tipo: "ingreso",
        importe: 2100,
        fecha: `2026-${String(mes).padStart(2, "0")}-25`,
      })
    );

    const candidatos = detectarPatronesPorDescripcion(movimientos);
    const candidato = candidatos.find((c) => c.clave === "ingreso:nomina empresa");

    expect(candidato).toBeDefined();
    expect(candidato?.periodicidad).toBe("mensual");
    expect(candidato?.ocurrencias).toBe(6);
    expect(candidato?.categoria_id).toBe("nomina");
    expect(candidato?.importe_estimado).toBeCloseTo(2100, 0);
  });

  it("detecta un patrón anual/estacional con al menos 2 repeticiones ~365 días", () => {
    const movimientos = [
      mov({ descripcion: "Seguro coche", categoria_id: "seguro", importe: -450, fecha: "2024-06-10" }),
      mov({ descripcion: "Seguro coche", categoria_id: "seguro", importe: -460, fecha: "2025-06-12" }),
      mov({ descripcion: "Seguro coche", categoria_id: "seguro", importe: -470, fecha: "2026-06-11" }),
    ];

    const candidatos = detectarPatronesPorDescripcion(movimientos);
    const candidato = candidatos.find((c) => c.clave === "gasto:seguro coche");

    expect(candidato).toBeDefined();
    expect(candidato?.periodicidad).toBe("anual");
    expect(candidato?.proximaFecha).toBe("2027-06-12");
  });

  it("no propone patrón para descripciones irregulares (gasto variable tipo Ocio)", () => {
    const movimientos = ["Cine", "Restaurante", "Bar amigos", "Concierto", "Escape room"].map((desc, i) =>
      mov({ descripcion: desc, categoria_id: "ocio", fecha: `2026-0${i + 1}-15` })
    );

    const candidatos = detectarPatronesPorDescripcion(movimientos);
    expect(candidatos).toHaveLength(0);
  });

  it("no propone nada con menos de 2 ocurrencias", () => {
    const candidatos = detectarPatronesPorDescripcion([mov({ descripcion: "Único" })]);
    expect(candidatos).toHaveLength(0);
  });
});

describe("detectarMediaPorCategoria", () => {
  it("calcula la media mensual de una categoría variable no cubierta por patrones fuertes", () => {
    const movimientos = ["Cine", "Restaurante", "Bar amigos", "Concierto", "Escape room"].map((desc, i) =>
      mov({ descripcion: desc, categoria_id: "ocio", importe: -(30 + i * 10), fecha: `2026-0${i + 1}-15` })
    );

    const candidatos = detectarMediaPorCategoria(movimientos, new Set());
    const candidato = candidatos.find((c) => c.categoria_id === "ocio");

    expect(candidato).toBeDefined();
    expect(candidato?.mesesConDatos).toBe(5);
    expect(candidato?.importe_estimado).toBeCloseTo(50, 0);
  });

  it("excluye movimientos ya cubiertos por un patrón de nivel 1 (evita doble sugerencia)", () => {
    const movimientos = [
      mov({ descripcion: "Nomina Empresa", categoria_id: "nomina", tipo: "ingreso", importe: 2100, fecha: "2026-01-25" }),
      mov({ descripcion: "Cine", categoria_id: "ocio", fecha: "2026-01-15" }),
    ];

    const cubiertas = new Set(["ingreso:nomina empresa"]);
    const candidatos = detectarMediaPorCategoria(movimientos, cubiertas);

    expect(candidatos.some((c) => c.categoria_id === "nomina")).toBe(false);
  });

  it("no propone nada con menos de 2 meses de histórico", () => {
    const candidatos = detectarMediaPorCategoria([mov({ categoria_id: "ocio" })], new Set());
    expect(candidatos).toHaveLength(0);
  });
});
