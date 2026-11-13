// Tanda 15: etiquetas en movimientos.
//
// La categoría dice qué es un gasto; la etiqueta, para qué fue (un viaje, una reforma, el
// coche). Ver la migración 0036 para el modelo de datos.

export type Etiqueta = { id: string; nombre: string; patron: string | null };

// Minúsculas, sin acentos y con los espacios colapsados. Los extractos escriben el mismo
// comercio de mil maneras ("RENFE VIAJEROS", "Renfe  Viajeros", "renfe-viajeros"): sin
// esto, un patrón "renfe viajeros" fallaría por un acento o un espacio doble.
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s\-_]+/g, " ")
    .trim();
}

// Un patrón demasiado corto ("a", "es") coincidiría con casi todo y etiquetaría medio
// extracto de golpe. Tres letras ya identifican cosas como "ikea" o "bbva", y por debajo no
// hay casos útiles.
export const LONGITUD_MINIMA_PATRON = 3;

export function patronValido(patron: string | null | undefined): string | null {
  if (!patron) return null;
  const limpio = normalizarTexto(patron);
  return limpio.length >= LONGITUD_MINIMA_PATRON ? limpio : null;
}

// Las etiquetas cuyo patrón aparece en el concepto del movimiento.
export function etiquetasPorPatron(descripcion: string, etiquetas: Etiqueta[]): string[] {
  const texto = normalizarTexto(descripcion);
  return etiquetas
    .filter((e) => {
      const patron = patronValido(e.patron);
      return patron !== null && texto.includes(patron);
    })
    .map((e) => e.id);
}

// Lo que suma cada etiqueta en un conjunto de movimientos. Los traspasos no cuentan: mueven
// dinero entre cuentas propias y no son ni gasto ni ingreso, igual que en el resto de
// informes. Un movimiento con dos etiquetas suma en las dos — es lo esperado ("el hotel fue
// del viaje y también del trabajo"), y por eso los totales por etiqueta no se suman entre sí.
export type MovimientoEtiquetado = { importe: number; tipo: string; fecha: string; etiquetaIds: string[] };

export type ResumenEtiqueta = {
  etiquetaId: string;
  movimientos: number;
  gastos: number;
  ingresos: number;
  neto: number;
  primeraFecha: string | null;
  ultimaFecha: string | null;
};

export function resumenPorEtiqueta(movimientos: MovimientoEtiquetado[], etiquetaIds: string[]): ResumenEtiqueta[] {
  const resumen = new Map<string, ResumenEtiqueta>(
    etiquetaIds.map((id) => [
      id,
      { etiquetaId: id, movimientos: 0, gastos: 0, ingresos: 0, neto: 0, primeraFecha: null, ultimaFecha: null },
    ])
  );

  for (const m of movimientos) {
    if (m.tipo === "traspaso") continue;
    for (const id of m.etiquetaIds) {
      const r = resumen.get(id);
      if (!r) continue;
      r.movimientos += 1;
      if (m.importe < 0) r.gastos += -m.importe;
      else r.ingresos += m.importe;
      r.neto += m.importe;
      if (r.primeraFecha === null || m.fecha < r.primeraFecha) r.primeraFecha = m.fecha;
      if (r.ultimaFecha === null || m.fecha > r.ultimaFecha) r.ultimaFecha = m.fecha;
    }
  }

  // Redondeo a céntimos al final, no en cada suma: los importes vienen como numeric de dos
  // decimales y sumar en coma flotante deja colas tipo 0,30000000000000004.
  const redondear = (v: number) => Math.round(v * 100) / 100;
  return [...resumen.values()]
    .map((r) => ({ ...r, gastos: redondear(r.gastos), ingresos: redondear(r.ingresos), neto: redondear(r.neto) }))
    .sort((a, b) => b.gastos - a.gastos || b.movimientos - a.movimientos);
}
