import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = ReturnType<typeof createClient>;

export type Direccion = "asc" | "desc";
export type OrdenTabla = { columna: string; direccion: Direccion } | null;
export type AccesorOrden<T> = (fila: T) => string | number | null;

// Ordena una lista de filas según la columna/dirección elegidas por el usuario,
// usando el accesor registrado para esa columna. Sin orden elegido (o columna
// desconocida), devuelve las filas tal cual llegaron (el orden por defecto de cada
// pantalla). Los valores null van siempre al final, sea cual sea la dirección.
export function ordenarFilas<T>(
  filas: T[],
  orden: OrdenTabla,
  accesores: Record<string, AccesorOrden<T>>
): T[] {
  if (!orden) return filas;
  const accesor = accesores[orden.columna];
  if (!accesor) return filas;

  const signo = orden.direccion === "asc" ? 1 : -1;

  return [...filas].sort((a, b) => {
    const va = accesor(a);
    const vb = accesor(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === "number" && typeof vb === "number") return signo * (va - vb);
    return signo * String(va).localeCompare(String(vb), "es");
  });
}

// Orden por defecto del módulo de previsión (tanda 5, mejora 7): ingresos antes que
// gastos (y traspasos al final), manteniendo el orden relativo que ya traían las
// filas dentro de cada grupo (sort estable) como criterio secundario. Se usa solo
// cuando el usuario no ha elegido un orden de columna manual — ese, si existe,
// siempre prevalece sobre este agrupado por defecto.
export function agruparIngresosPrimero<T>(filas: T[], tipoDe: (fila: T) => string): T[] {
  const prioridad: Record<string, number> = { ingreso: 0, gasto: 1, traspaso: 2 };
  return [...filas].sort((a, b) => (prioridad[tipoDe(a)] ?? 3) - (prioridad[tipoDe(b)] ?? 3));
}

// Orden guardado por el usuario para una tabla concreta (null si nunca ha elegido
// uno para esa tabla, en cuyo caso la pantalla usa su orden por defecto).
export async function obtenerOrdenTabla(
  supabase: SupabaseServerClient,
  usuarioId: string,
  tabla: string
): Promise<OrdenTabla> {
  const { data } = await supabase
    .from("preferencias_tabla")
    .select("columna, direccion")
    .eq("usuario_id", usuarioId)
    .eq("tabla", tabla)
    .maybeSingle();

  if (!data) return null;
  return { columna: data.columna, direccion: data.direccion as Direccion };
}
