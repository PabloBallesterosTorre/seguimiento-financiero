export type FormatoFecha = "DMY" | "YMD" | "MDY";

// Convierte una fecha en el formato indicado a texto ISO (AAAA-MM-DD), o null si no es válida.
// Admite también una fecha-hora ISO completa (ej. "2024-02-16T11:00:36.142Z"): se queda
// solo con la parte de fecha.
export function parseFechaImportada(valor: string, formato: FormatoFecha): string | null {
  const soloFecha = valor.trim().split("T")[0];
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

// Detecta con confianza solo el caso inequívoco: fecha ISO (AAAA-MM-DD…), reconocible
// porque el primer segmento tiene 4 dígitos. Para el resto (DD/MM vs MM/DD) no hay
// forma fiable de adivinar sin más contexto, así que se deja el valor actual.
export function detectarFormatoFecha(muestra: string): FormatoFecha | null {
  const soloFecha = muestra.trim().split("T")[0];
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
