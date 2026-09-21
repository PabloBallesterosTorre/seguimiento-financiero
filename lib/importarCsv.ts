export type FormatoFecha = "DMY" | "YMD" | "MDY";

// Meses en español e inglés, por su prefijo de tres letras, que es lo único que comparten
// todas las variantes que emiten los bancos ("sep", "sept", "septiembre", "September").
// Enero/January y junio/July no colisionan entre idiomas salvo "jun"/"jul", que significan
// lo mismo en ambos, así que un único mapa sirve para los dos.
const MESES_POR_PREFIJO: Record<string, number> = {
  ene: 1, jan: 1,
  feb: 2,
  mar: 3,
  abr: 4, apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8, aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dic: 12, dec: 12,
};

// Fecha con el mes escrito en letra: "1 sept 2026", "17 de septiembre de 2026",
// "3 March 2026". Devuelve ISO o null si no tiene esa forma.
function parseFechaConMesEnTexto(valor: string): string | null {
  const limpio = valor
    .trim()
    .toLowerCase()
    .replace(/\bde\b/g, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const partes = limpio.match(/^(\d{1,2}) ([a-záéíóúñ]+) (\d{4})$/);
  if (!partes) return null;

  const mes = MESES_POR_PREFIJO[partes[2].slice(0, 3)];
  if (!mes) return null;

  const dia = Number(partes[1]);
  if (dia < 1 || dia > 31) return null;

  return `${partes[3]}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

// Convierte una fecha en el formato indicado a texto ISO (AAAA-MM-DD), o null si no es válida.
// Admite también una fecha-hora completa (ej. "2024-02-16T11:00:36.142Z" o
// "2026-07-16 15:22:37"): se queda solo con la parte de fecha, antes de la "T" o
// del primer espacio.
export function parseFechaImportada(valor: string, formato: FormatoFecha): string | null {
  // Fecha con el mes escrito ("1 sept 2026", "17 September 2026"). La usan los extractos
  // de cuenta remunerada de Revolut, y no encaja en ningún formato numérico porque no
  // lleva separadores. Se resuelve antes que nada y sin mirar `formato`: con el mes en
  // letra el orden de los campos es inequívoco, así que no hay nada que elegir.
  const conMesEnTexto = parseFechaConMesEnTexto(valor);
  if (conMesEnTexto) return conMesEnTexto;

  const soloFecha = valor.trim().split(/[T ]/)[0];
  const limpio = soloFecha.trim();
  if (!limpio) return null;

  const partes = limpio.split(/[/\-.]/).map((p) => p.trim());
  if (partes.length !== 3) return null;

  let dia: string;
  let mes: string;
  let anio: string;

  if (formato === "YMD") {
    [anio, mes, dia] = partes;
  } else if (formato === "MDY") {
    [mes, dia, anio] = partes;
  } else {
    [dia, mes, anio] = partes;
  }

  if (anio.length === 2) anio = `20${anio}`;
  if (!/^\d{1,4}$/.test(anio) || !/^\d{1,2}$/.test(dia) || !/^\d{1,2}$/.test(mes)) return null;

  const d = dia.padStart(2, "0");
  const m = mes.padStart(2, "0");
  const a = anio.padStart(4, "0");

  if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return null;

  const fechaISO = `${a}-${m}-${d}`;
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return null;

  return fechaISO;
}

// Convierte un importe en texto (con separador decimal coma o punto, símbolo de moneda
// opcional, separador de miles opcional) a número. Devuelve null si no es un número válido.
export function parseImporteImportado(valor: string, separadorDecimal: "," | "."): number | null {
  let limpio = valor.trim().replace(/[€$\s]/g, "");
  if (!limpio) return null;

  if (separadorDecimal === ",") {
    limpio = limpio.replace(/\./g, "").replace(",", ".");
  } else {
    limpio = limpio.replace(/,/g, "");
  }

  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return null;

  const numero = Number(limpio);
  return Number.isNaN(numero) ? null : numero;
}

// Suma al importe base la comisión y la retención fiscal de la fila, si el archivo las
// trae en columnas separadas (ej. Trade Republic, Revolut). Ambas ya vienen en negativo
// en esos extractos cuando reducen el importe, así que se suman directamente, nunca se
// restan. Si una columna no existe o viene vacía/no numérica en la fila, no afecta al
// resultado — así el comportamiento es idéntico al actual cuando no hay fee/tax.
export function combinarImporteConComisionYRetencion(
  importeBase: number,
  comisionTexto: string | undefined,
  retencionTexto: string | undefined,
  separadorDecimal: "," | "."
): number {
  let total = importeBase;
  if (comisionTexto) {
    const comision = parseImporteImportado(comisionTexto, separadorDecimal);
    if (comision !== null) total += comision;
  }
  if (retencionTexto) {
    const retencion = parseImporteImportado(retencionTexto, separadorDecimal);
    if (retencion !== null) total += retencion;
  }
  return total;
}

// La comisión de la fila como un coste positivo, para guardarla aparte en la operación de
// inversión. Es el mismo dato que `combinarImporteConComisionYRetencion` mete dentro del
// importe — ahí porque el coste real de una compra incluye lo que cobra el bróker, y aquí
// además por separado, para poder responder a "¿cuánto llevo pagado en comisiones?".
//
// Solo la comisión, no la retención fiscal: una retención no es un coste de operar, es un
// impuesto adelantado. Sigue contando dentro del importe, pero no suma aquí.
export function comisionDeLaFila(comisionTexto: string | undefined, separadorDecimal: "," | "."): number {
  if (!comisionTexto) return 0;
  const comision = parseImporteImportado(comisionTexto, separadorDecimal);
  return comision === null ? 0 : Math.abs(comision);
}

// Día siguiente a una fecha ISO (AAAA-MM-DD). Se calcula en UTC a propósito: la
// versión anterior hacía `new Date("2026-09-09T00:00:00")`, que se interpreta en hora
// LOCAL, y devolvía el resultado con `toISOString()`, que convierte a UTC. En
// cualquier huso con desfase positivo (Europe/Madrid es +1/+2) esa conversión
// retrocedía unas horas y el "día siguiente" acababa cayendo otra vez en el mismo día,
// así que la fecha de corte por defecto de la importación se quedaba en la fecha del
// último movimiento en vez de la posterior.
export function diaSiguienteISO(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + 1)).toISOString().slice(0, 10);
}

// Detecta con confianza solo el caso inequívoco: fecha ISO (AAAA-MM-DD…), reconocible
// porque el primer segmento tiene 4 dígitos. Para el resto (DD/MM vs MM/DD) no hay
// forma fiable de adivinar sin más contexto, así que se deja el valor actual.
export function detectarFormatoFecha(muestra: string): FormatoFecha | null {
  const soloFecha = muestra.trim().split(/[T ]/)[0];
  const partes = soloFecha.split(/[/\-.]/);
  if (partes.length !== 3) return null;
  if (partes[0].length === 4) return "YMD";
  return null;
}

// Adivina el separador decimal más probable a partir de una muestra de valores en
// crudo: si aparece alguna coma se asume coma decimal, si no y aparece algún punto
// se asume punto decimal.
export function detectarSeparadorDecimal(muestras: string[]): "," | "." {
  const limpias = muestras.map((v) => v.trim()).filter((v) => v.length > 0);
  if (limpias.some((v) => v.includes(","))) return ",";
  if (limpias.some((v) => v.includes("."))) return ".";
  return ".";
}

// Palabras con las que los bancos titulan la columna que describe el movimiento.
const PALABRAS_DESCRIPCION = ["concepto", "descrip", "detalle", "movimiento"];
// De esas, las que titulan la columna específica (el comercio o el emisor del recibo)
// frente a la genérica (el tipo de operación).
const PALABRAS_DESCRIPCION_ESPECIFICA = ["descrip", "detalle"];

// Algunos extractos reparten la descripción en DOS columnas: una con el tipo de
// operación y otra con quién cobra. Ibercaja es el caso claro —`Concepto` dice
// "TARJETA VISA" o "RECIBO", y `Descripción` dice "MOVILIDAD MMD" o "UPGYMS
// IBERIA S.L."—, y como la importación solo leía una, se quedaba con la genérica y
// tiraba justo el dato que identifica el gasto: 32 movimientos acabaron siendo
// indistinguibles entre sí y sin categorizar posible. Revolut y Trade Republic traen
// una sola columna y ahí `extra` sale vacío.
export function adivinarColumnasDescripcion(cabeceras: string[]): {
  principal: string;
  extra: string;
} {
  const coincide = (cabecera: string, palabras: string[]) => {
    const texto = cabecera.toLowerCase();
    return palabras.includes(texto) || palabras.some((p) => texto.includes(p));
  };

  const principal = cabeceras.find((c) => coincide(c, PALABRAS_DESCRIPCION)) ?? "";
  const extra =
    cabeceras.find((c) => c !== principal && coincide(c, PALABRAS_DESCRIPCION_ESPECIFICA)) ?? "";

  return { principal, extra };
}

// Junta las dos columnas conservando ambas partes: el tipo de operación sigue siendo
// visible y el comercio pasa a formar parte de la descripción, que es lo que el motor
// de categorización necesita para aprender una regla que sirva de algo.
export function combinarDescripcion(principal: string, extra: string): string {
  const a = principal.trim();
  const b = extra.trim();
  if (!b) return a;
  if (!a) return b;
  if (a.toLowerCase() === b.toLowerCase()) return a;
  // Cuando una ya contiene a la otra, repetirla solo alarga la descripción.
  if (a.toLowerCase().includes(b.toLowerCase())) return a;
  if (b.toLowerCase().includes(a.toLowerCase())) return b;
  return `${a} — ${b}`;
}
