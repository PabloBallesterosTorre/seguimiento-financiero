// El mes financiero: el mes no va del 1 al 31, sino de nómina a nómina.
//
// El problema, con datos reales: la nómina con la que se vive septiembre se cobra el 28
// de agosto. Contando por mes natural, septiembre se queda sin sueldo y agosto tiene dos,
// y la respuesta a "¿he ahorrado este mes?" sale del revés. En el histórico del usuario,
// julio pasa de −2.131,73 € a +799,78 € y septiembre de −305,77 € a +744,35 € solo por
// mover la frontera: cambia el SIGNO, no el matiz.
//
// La fecha de cobro no es fija (28, 29, 30, y a veces el banco adelanta si cae en fin de
// semana), así que un día de corte fijo tampoco vale. La frontera se ANCLA en la propia
// nómina: el mes financiero M empieza el día en que se cobró la última nómina antes del 1
// de M. Si ese mes no hay ninguna —el mes en curso hasta que llega, o un periodo sin
// nómina— se cae al día de corte configurado, que es solo la red de seguridad.
//
// Solo se aceptan como ancla las nóminas de los últimos días del mes (ver MARGEN_DIAS).
// Es lo que impide que la paga extra estropee la frontera: en junio de 2026 hay dos
// nóminas, la extra el día 15 y la ordinaria el 29. La del 15 queda fuera de la ventana
// y no mueve nada; la extra sigue contando como ingreso del mes en el que se cobró.
//
// Mientras se ESPERA la nómina el mes no cambia. El día de corte es un respaldo para los
// meses en los que nunca hubo nómina, no un calendario: el 26 de octubre de 2026, con la
// nómina por llegar el 29, el respaldo del día 25 daba noviembre por empezado, y la
// pantalla enseñaba un mes de dos días sin ingresos. Con `hoy` en las opciones, si el
// respaldo ya pasó pero la nómina no ha entrado, el mes en curso sigue abierto hasta hoy.

export type OpcionesMesFinanciero = {
  // Con `activo: false` todo se comporta como antes: meses naturales del 1 al 31. Es el
  // valor por defecto, para que nadie se encuentre los meses movidos sin pedirlo.
  activo: boolean;
  // Día de respaldo (1-28) cuando no hay ninguna nómina que anclar.
  diaCorte: number;
  // Fechas ISO (YYYY-MM-DD) de las nóminas cobradas, en cualquier orden.
  anclas: readonly string[];
  // Hoy (YYYY-MM-DD). Opcional para que las funciones sigan siendo puras en los tests;
  // sin él, el mes sin nómina empieza siempre en el día de corte.
  hoy?: string;
};

export const OPCIONES_MES_NATURAL: OpcionesMesFinanciero = { activo: false, diaCorte: 25, anclas: [] };

// Cuántos días antes del día de corte se empieza a aceptar una nómina como frontera. Con
// el corte por defecto en 25, la ventana abre el día 20: recoge cualquier cobro del 20 en
// adelante y deja fuera las pagas extra de mediados de mes.
const MARGEN_DIAS = 5;

function clave(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function iso(year: number, month: number, day: number): string {
  return `${clave(year, month)}-${String(day).padStart(2, "0")}`;
}

function anterior(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function siguiente(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function ultimoDia(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function diaSiguiente(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ¿Está el mes (year, month) todavía sin empezar porque su nómina no ha entrado? Solo
// puede pasar entre el día de corte y el día 1 natural: antes del corte no hay nada que
// esperar, y a partir del día 1 un cobro ya no se acepta como ancla de este mes.
function esperandoNominaDe(
  respaldo: string,
  hasta: string,
  opciones: OpcionesMesFinanciero
): boolean {
  return opciones.hoy !== undefined && respaldo <= opciones.hoy && opciones.hoy < hasta;
}

/**
 * Primer día (inclusive) del mes financiero que lleva la etiqueta (year, month).
 *
 * Cae siempre dentro del mes natural anterior: el mes financiero "septiembre de 2026"
 * empieza el 28 de agosto, que es cuando entró el dinero con el que se vive septiembre.
 */
export function inicioMesFinanciero(year: number, month: number, opciones: OpcionesMesFinanciero): string {
  if (!opciones.activo) return iso(year, month, 1);

  const prev = anterior(year, month);
  const corte = Math.min(Math.max(opciones.diaCorte, 1), ultimoDia(prev.year, prev.month));
  const respaldo = iso(prev.year, prev.month, corte);

  const desde = iso(prev.year, prev.month, Math.max(corte - MARGEN_DIAS, 1));
  const hasta = iso(year, month, 1);

  let mejor: string | null = null;
  for (const ancla of opciones.anclas) {
    if (ancla >= desde && ancla < hasta && (mejor === null || ancla > mejor)) mejor = ancla;
  }

  if (mejor) return mejor;
  // Sin nómina todavía y con el respaldo ya pasado: el mes empezará cuando entre. Hasta
  // entonces se sitúa su inicio mañana, de modo que hoy siga perteneciendo al anterior.
  if (esperandoNominaDe(respaldo, hasta, opciones)) return diaSiguiente(opciones.hoy!);
  return respaldo;
}

/**
 * ¿Sigue abierto el mes (year, month) a la espera de la nómina que lo cierra? Sirve para
 * describirlo como "hasta que entre la nómina" en vez de con una fecha de fin que solo es
 * la de hoy.
 */
export function esperandoNomina(year: number, month: number, opciones: OpcionesMesFinanciero): boolean {
  if (!opciones.activo) return false;
  const sig = siguiente(year, month);
  const prev = { year, month };
  const corte = Math.min(Math.max(opciones.diaCorte, 1), ultimoDia(prev.year, prev.month));
  const respaldo = iso(prev.year, prev.month, corte);
  const desde = iso(prev.year, prev.month, Math.max(corte - MARGEN_DIAS, 1));
  const hasta = iso(sig.year, sig.month, 1);
  const hayAncla = opciones.anclas.some((a) => a >= desde && a < hasta);
  return !hayAncla && esperandoNominaDe(respaldo, hasta, opciones);
}

/** Último día (inclusive) del mes financiero (year, month). */
export function finMesFinanciero(year: number, month: number, opciones: OpcionesMesFinanciero): string {
  if (!opciones.activo) return iso(year, month, ultimoDia(year, month));

  const sig = siguiente(year, month);
  const inicioSiguiente = inicioMesFinanciero(sig.year, sig.month, opciones);
  const d = new Date(`${inicioSiguiente}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * A qué mes financiero ("YYYY-MM") pertenece una fecha. Sustituye a `fecha.slice(0, 7)`
 * allá donde se agrupan movimientos reales por mes.
 *
 * El inicio de un mes financiero siempre cae dentro del mes natural anterior, así que una
 * fecha solo puede pertenecer a su propio mes natural o al siguiente: basta comprobar si
 * ya ha entrado en el siguiente.
 */
export function mesDe(fecha: string, opciones: OpcionesMesFinanciero): string {
  const year = Number(fecha.slice(0, 4));
  const month = Number(fecha.slice(5, 7));
  if (!opciones.activo) return clave(year, month);

  const sig = siguiente(year, month);
  if (fecha >= inicioMesFinanciero(sig.year, sig.month, opciones)) return clave(sig.year, sig.month);
  return clave(year, month);
}

/** ¿Cae la fecha dentro del mes financiero (year, month)? */
export function caeEnMes(fecha: string, year: number, month: number, opciones: OpcionesMesFinanciero): boolean {
  return mesDe(fecha, opciones) === clave(year, month);
}

/**
 * Cómo describir el desfase al usuario ("del 28 de agosto al 27 de septiembre"), para que
 * un mes que no empieza el día 1 no parezca un error de la aplicación.
 */
export function descripcionMes(year: number, month: number, opciones: OpcionesMesFinanciero): string {
  const inicio = inicioMesFinanciero(year, month, opciones);
  const fin = finMesFinanciero(year, month, opciones);
  const fmt = (f: string) =>
    new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" }).format(
      new Date(`${f}T00:00:00Z`)
    );
  if (esperandoNomina(year, month, opciones)) return `del ${fmt(inicio)} hasta que entre la próxima nómina`;
  return `del ${fmt(inicio)} al ${fmt(fin)}`;
}
