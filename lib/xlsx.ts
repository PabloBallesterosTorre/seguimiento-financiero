import * as XLSX from "xlsx";

// Convierte la primera hoja de un .xlsx a la misma forma de tabla (string[][])
// que usa el parser de CSV, para que el resto del importador no tenga que saber
// si el archivo original era CSV o Excel.
export function parseXLSX(buffer: ArrayBuffer): string[][] {
  const libro = XLSX.read(buffer, { type: "array" });
  const nombreHoja = libro.SheetNames[0];
  if (!nombreHoja) return [];

  const hoja = libro.Sheets[nombreHoja];
  const filas: unknown[][] = XLSX.utils.sheet_to_json(hoja, {
    header: 1,
    raw: false,
    defval: "",
  });

  return filas
    .map((f) => f.map((v) => String(v ?? "").trim()))
    .filter((f) => f.some((v) => v !== ""));
}
