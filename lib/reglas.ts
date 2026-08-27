import { normalizarDescripcion } from "@/lib/categorizacion";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Refuerza (o crea) la regla de categorización aprendida para una descripción.
export async function reforzarRegla(
  supabase: SupabaseServerClient,
  usuarioId: string,
  descripcion: string,
  categoriaId: string
) {
  const patron = normalizarDescripcion(descripcion);
  if (!patron) return;

  const { data: reglaExistente } = await supabase
    .from("reglas_categorizacion")
    .select("id, veces_usada")
    .eq("usuario_id", usuarioId)
    .eq("patron_descripcion", patron)
    .maybeSingle();

  if (reglaExistente) {
    await supabase
      .from("reglas_categorizacion")
      .update({
        categoria_id: categoriaId,
        veces_usada: reglaExistente.veces_usada + 1,
        ultima_fecha_uso: new Date().toISOString(),
      })
      .eq("id", reglaExistente.id);
  } else {
    await supabase.from("reglas_categorizacion").insert({
      usuario_id: usuarioId,
      patron_descripcion: patron,
      categoria_id: categoriaId,
    });
  }
}
