"use server";

import { createClient } from "@/lib/supabase/server";
import type { Direccion } from "@/lib/ordenTabla";

// Guarda el criterio de ordenación elegido por el usuario para una tabla concreta,
// para que se recuerde la próxima vez que entre (tanda 5, mejora 2). Se invoca
// directamente desde el componente cliente al hacer clic en una cabecera, no desde
// un <form> — no hace falta revalidar ninguna ruta, la propia tabla ya se reordena
// en el cliente de forma optimista.
export async function guardarOrdenTabla(tabla: string, columna: string, direccion: Direccion) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("preferencias_tabla")
    .upsert({ usuario_id: user.id, tabla, columna, direccion }, { onConflict: "usuario_id,tabla" });
}
