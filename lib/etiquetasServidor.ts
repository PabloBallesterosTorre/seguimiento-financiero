import { etiquetasPorPatron, type Etiqueta } from "@/lib/etiquetas";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Pone las etiquetas con patrón a los movimientos indicados. Es idempotente: si el
// movimiento ya tenía esa etiqueta (puesta a mano o por una pasada anterior), se deja como
// estaba. Devuelve cuántas etiquetas nuevas ha puesto.
//
// Solo se llama con movimientos recién creados o con los que el usuario pide expresamente
// ("aplicar a los existentes"). Nunca se repasa todo el histórico en cada importación: si el
// usuario quitó a mano una etiqueta que había puesto la regla, volver a ponérsela sería
// llevarle la contraria.
export async function etiquetarPorReglas(
  supabase: SupabaseServerClient,
  usuarioId: string,
  movimientos: { id: string; descripcion: string }[],
  soloEtiqueta?: string
): Promise<number> {
  if (movimientos.length === 0) return 0;

  let consulta = supabase.from("etiquetas").select("id, nombre, patron").not("patron", "is", null);
  if (soloEtiqueta) consulta = consulta.eq("id", soloEtiqueta);
  const { data: etiquetas } = await consulta;
  if (!etiquetas || etiquetas.length === 0) return 0;

  const filas = movimientos.flatMap((m) =>
    etiquetasPorPatron(m.descripcion, etiquetas as Etiqueta[]).map((etiqueta_id) => ({
      movimiento_id: m.id,
      etiqueta_id,
      usuario_id: usuarioId,
      origen: "regla",
    }))
  );
  if (filas.length === 0) return 0;

  const { data } = await supabase
    .from("movimiento_etiquetas")
    .upsert(filas, { onConflict: "movimiento_id,etiqueta_id", ignoreDuplicates: true })
    .select("movimiento_id")
    .throwOnError();

  return data?.length ?? 0;
}
