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

// Etiquetas genéricas con las que los bancos describen cualquier movimiento de un tipo.
// No identifican un comercio ni un concepto: el mismo texto vale para la compra del súper,
// el gimnasio o el seguro, así que aprender una categoría de ellas es aprender ruido.
const DESCRIPCIONES_GENERICAS = [
  "tarjeta visa",
  "recibo",
  "transferencia otra entidad",
  "operacion en cajero automatico",
  "operación en cajero automático",
  "ibercaja pay",
  "compra",
  "pago",
  "traspaso",
];

// ¿Merece esta descripción convertirse en una regla de categorización?
//
// El motor aprende de cada categorización manual, y eso llenó la tabla de 285 reglas de las
// que 219 se habían usado UNA vez: nacían de descripciones irrepetibles (con el IBAN de la
// contraparte, el número de operación o un UUID dentro), así que no podían volver a
// coincidir con nada. Y las pocas que sí se repetían eran las peores: `tarjeta visa` acabó
// significando "Transporte" cuando en realidad Ibercaja llama así a cualquier pago con
// tarjeta, y le habría puesto esa categoría a 25 movimientos de entre 0,55 € y 163,26 €.
//
// Se descarta una descripción cuando:
//  - lleva un número largo, un IBAN o un UUID: es irrepetible, la regla nacería muerta;
//  - es una etiqueta genérica del banco: la regla sería ruido activo;
//  - describe un movimiento entre cuentas o un envío a una persona: el mismo remitente
//    manda dinero por motivos distintos cada vez (una cena, un vuelo, la compra), así que
//    la categoría es del movimiento concreto, nunca del remitente;
//  - es demasiado corta para identificar nada.
export function mereceRegla(descripcion: string): boolean {
  const texto = normalizarDescripcion(descripcion);
  if (texto.length < 4) return false;
  if (DESCRIPCIONES_GENERICAS.includes(texto)) return false;

  // Números largos (referencias, números de operación), IBAN y UUID.
  if (/\d{6,}/.test(texto)) return false;
  if (/\b[a-z]{2}\d{2}[a-z0-9]{10,}\b/.test(texto)) return false;
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/.test(texto)) return false;

  // Códigos de referencia que mezclan letras y números dentro de la misma palabra
  // ("PLAYTOMIC.IO 069DF6E5", "Cabify ES 26374s01vkAR"). El umbral de 8 caracteres es
  // deliberado: por debajo caerían nombres de comercio legítimos como `bet365` o `o2`.
  if (/\b(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]{8,}\b/.test(texto)) return false;

  // Movimientos entre cuentas o con personas.
  if (/\btransfer\b|\btransferencia\b|\bbizum\b|\brecarga\b|\btraspaso\b/.test(texto)) return false;

  return true;
}

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
