import { describe, it, expect } from "vitest";
import { revisarDeuda, type DeudaParaRevisar } from "./revisionDeudas";

// La hipoteca que nadie pagaba: el caso real que motivó estas comprobaciones.
const fantasma: DeudaParaRevisar = {
  id: "vivienda",
  nombre: "Hipoteca vivienda habitual",
  capital_inicial: 150000,
  capital_pendiente: 150000,
  cuota: 650,
  fecha_inicio: "2023-01-01",
  categoria_id: "cat-vivienda",
};

// La hipoteca real: cuota que cuadra al céntimo y capital que ha bajado.
const sana: DeudaParaRevisar = {
  id: "pablo",
  nombre: "Hipoteca Pablo",
  capital_inicial: 237000,
  capital_pendiente: 143503.44,
  cuota: 591.83,
  fecha_inicio: "2024-11-24",
  categoria_id: "cat-pablo",
};

describe("revisarDeuda", () => {
  it("detecta una deuda sin un solo pago registrado", () => {
    const avisos = revisarDeuda(fantasma, [], "2026-09-18");
    expect(avisos).toHaveLength(1);
    expect(avisos[0].gravedad).toBe("grave");
    expect(avisos[0].detalle).toContain("no debería estar registrada");
  });

  it("no revienta con una deuda sin categoría y lo explica", () => {
    const avisos = revisarDeuda({ ...fantasma, categoria_id: null }, [], "2026-09-18");
    expect(avisos[0].detalle).toContain("No tiene categoría asignada");
  });

  it("no avisa de una deuda recién dada de alta", () => {
    // El primer recibo puede no haber llegado todavía: avisar aquí sería ruido.
    expect(revisarDeuda({ ...fantasma, fecha_inicio: "2026-09-01" }, [], "2026-09-18")).toHaveLength(0);
  });

  it("no dice nada de una deuda sana", () => {
    expect(revisarDeuda(sana, [591.83, 591.83], "2026-09-18")).toHaveLength(0);
  });

  it("avisa si el capital pendiente nunca ha bajado", () => {
    const avisos = revisarDeuda({ ...sana, capital_pendiente: 237000 }, [591.83, 591.83], "2026-09-18");
    expect(avisos.some((a) => a.titulo.includes("capital pendiente"))).toBe(true);
  });

  it("avisa si lo que se paga no coincide con la cuota", () => {
    // Una revisión de tipo variable: la cuota sube y la ficha se queda vieja.
    const avisos = revisarDeuda(sana, [640.12, 640.12, 640.12], "2026-09-18");
    expect(avisos.some((a) => a.titulo.includes("no coincide"))).toBe(true);
  });

  it("una amortización extra suelta no dispara el aviso de cuota", () => {
    // Se compara con la mediana justo para esto: un pago atípico no mueve la referencia.
    const avisos = revisarDeuda(sana, [591.83, 591.83, 20000, 591.83], "2026-09-18");
    expect(avisos.some((a) => a.titulo.includes("no coincide"))).toBe(false);
  });

  it("tolera redondeos pequeños", () => {
    expect(revisarDeuda(sana, [592.5, 592.5], "2026-09-18")).toHaveLength(0);
  });
});
