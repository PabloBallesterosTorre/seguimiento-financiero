import { inmueblePorCategoria } from "@/lib/inmuebles";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Vincula a su inmueble los movimientos indicados cuando su categoría ya se ha aprendido
// (ver `inmueblePorCategoria`). Solo toca los que no tienen inmueble: nunca deshace un
// vínculo puesto o quitado a mano. Devuelve cuántos ha vinculado.
//
// Los propios movimientos que llegan se excluyen de las estadísticas: importar un año de
// recibos de comunidad sin vincular no debe "desaprender" la categoría.
export async function vincularInmueblesPorCategoria(
  supabase: SupabaseServerClient,
  movimientos: { id: string; categoria_id: string | null; inmueble_id?: string | null }[]
): Promise<number> {
  const pendientes = movimientos.filter((m) => m.categoria_id && !m.inmueble_id);
  if (pendientes.length === 0) return 0;

  const categorias = Array.from(new Set(pendientes.map((m) => m.categoria_id as string)));
  const ids = new Set(pendientes.map((m) => m.id));
  const { data: historico } = await supabase
    .from("movimientos")
    .select("id, categoria_id, inmueble_id")
    .in("categoria_id", categorias)
    .neq("tipo", "traspaso")
    .throwOnError();

  const aprendido = inmueblePorCategoria((historico ?? []).filter((h) => !ids.has(h.id)));
  if (aprendido.size === 0) return 0;

  // `vinculados` cuenta los candidatos; el update ignora los traspasos, así que es un máximo.
  let vinculados = 0;
  const porInmueble = new Map<string, string[]>();
  for (const m of pendientes) {
    const inmueble = aprendido.get(m.categoria_id as string);
    if (!inmueble) continue;
    porInmueble.set(inmueble, [...(porInmueble.get(inmueble) ?? []), m.id]);
  }
  for (const [inmueble, idsMov] of porInmueble) {
    await supabase
      .from("movimientos")
      .update({ inmueble_id: inmueble })
      .in("id", idsMov)
      .is("inmueble_id", null)
      // Un traspaso mueve dinero entre cuentas propias: no es ni renta ni gasto del piso,
      // aunque lleve la categoría (en la tabla tampoco se ofrece vincularlo).
      .neq("tipo", "traspaso")
      .throwOnError();
    vinculados += idsMov.length;
  }
  return vinculados;
}
