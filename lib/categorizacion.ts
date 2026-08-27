export type ReglaCategorizacion = {
  patron_descripcion: string;
  categoria_id: string;
  veces_usada: number;
};

export function normalizarDescripcion(texto: string) {
  return texto.trim().toLowerCase();
}

const MESES_PARA_LIMPIAR = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre",
  "january", "february", "march", "april", "june", "july", "august",
  "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
];

const LONGITUD_MINIMA_COINCIDENCIA_DEBIL = 8;

// Quita de una descripción ya normalizada los fragmentos típicamente variables entre
// repeticiones del mismo tipo de movimiento (números y nombres de mes, ej. la fecha
// embebida en "Interés neto pagado a Cuenta Remunerada del Aug 23, 2026"), dejando solo
// la parte estable de la descripción para poder compararla como fallback cuando no hay
// coincidencia exacta.
function descripcionSinVariables(texto: string): string {
  let resultado = texto;
  for (const mes of MESES_PARA_LIMPIAR) {
    resultado = resultado.replace(new RegExp(`\\b${mes}\\b`, "g"), " ");
  }
  resultado = resultado.replace(/\d+/g, " ");
  resultado = resultado.replace(/[.,]/g, " ");
  return resultado.replace(/\s+/g, " ").trim();
}

// Sugiere la categoría de una regla cuyo patrón está contenido en la descripción
// (o viceversa), quedándose con la coincidencia más específica (patrón más largo)
// y, en caso de empate, la más usada. Si no hay ninguna coincidencia exacta, se
// intenta una segunda pasada ignorando números y nombres de mes (fechas u otros datos
// variables embebidos en la descripción), para reconocer repeticiones del mismo
// movimiento aunque el banco incluya un dato distinto cada vez (típico en intereses
// diarios). Esta segunda pasada exige un mínimo de longitud en la parte estable para
// evitar falsos positivos con restos demasiado cortos o genéricos.
export function sugerirCategoria(
  descripcion: string,
  reglas: ReglaCategorizacion[]
): string | null {
  const texto = normalizarDescripcion(descripcion);
  if (!texto) return null;

  let mejor: ReglaCategorizacion | null = null;

  for (const regla of reglas) {
    const patron = regla.patron_descripcion;
    if (!patron) continue;
    const coincide = texto.includes(patron) || patron.includes(texto);
    if (!coincide) continue;

    if (
      !mejor ||
      patron.length > mejor.patron_descripcion.length ||
      (patron.length === mejor.patron_descripcion.length && regla.veces_usada > mejor.veces_usada)
    ) {
      mejor = regla;
    }
  }

  if (mejor) return mejor.categoria_id;

  const textoSinVariables = descripcionSinVariables(texto);
  if (textoSinVariables.length < LONGITUD_MINIMA_COINCIDENCIA_DEBIL) return null;

  let mejorDebil: ReglaCategorizacion | null = null;
  for (const regla of reglas) {
    const patron = regla.patron_descripcion;
    if (!patron) continue;
    const patronSinVariables = descripcionSinVariables(patron);
    if (patronSinVariables.length < LONGITUD_MINIMA_COINCIDENCIA_DEBIL) continue;
    const coincide =
      textoSinVariables.includes(patronSinVariables) || patronSinVariables.includes(textoSinVariables);
    if (!coincide) continue;

    if (
      !mejorDebil ||
      patronSinVariables.length > descripcionSinVariables(mejorDebil.patron_descripcion).length ||
      (patronSinVariables.length === descripcionSinVariables(mejorDebil.patron_descripcion).length &&
        regla.veces_usada > mejorDebil.veces_usada)
    ) {
      mejorDebil = regla;
    }
  }

  return mejorDebil?.categoria_id ?? null;
}
