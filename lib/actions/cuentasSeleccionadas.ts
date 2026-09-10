"use server";

import { createClient } from "@/lib/supabase/server";

// Guarda, como preferencia del usuario, qué cuentas quedan excluidas del selector de
// informes/planificador/prevision/home (se guardan las excluidas, no las incluidas,
// para que una cuenta nueva aparezca seleccionada por defecto). Se invoca directamente
// desde el selector al cambiar la selección — la URL ya refleja el cambio de forma
// optimista, así que aquí no hace falta revalidar ninguna ruta.
export async function guardarCuentasExcluidasInformes(idsExcluidos: string[]) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("configuracion_usuario")
    .upsert(
      { usuario_id: user.id, cuentas_excluidas_informes: idsExcluidos },
      { onConflict: "usuario_id" }
    )
    .throwOnError();
}
