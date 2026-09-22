import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente de Supabase con la service-role key. SOLO para el servidor.
//
// Por qué existe: el alta pública de Supabase Auth está desactivada a propósito. Si se
// activara para poder usar `signUp` desde el navegador, cualquiera podría llamar al
// endpoint de Auth directamente con la anon key —que es pública, va en el bundle— y
// crearse una cuenta saltándose la comprobación del código de invitación. Con el alta
// cerrada, la única forma de crear un usuario es `auth.admin.createUser`, que exige esta
// clave, y esta clave solo vive en el servidor. La puerta deja de ser la interfaz y pasa
// a ser el servidor.
//
// Esta clave SALTA todas las políticas RLS. No se usa para leer ni escribir datos del
// usuario: únicamente para el alta y para leer/marcar la invitación que la autoriza, que
// es justo lo que no se puede hacer con la sesión de alguien que todavía no existe.
export function createAdminClient() {
  // Red de seguridad: si algún día este módulo acaba importado desde un Client
  // Component por error, es mejor romper en desarrollo que publicar la clave.
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient es solo de servidor: nunca debe llegar al navegador.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_SUPABASE_URL): el registro por invitación no puede funcionar sin ella."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      // No hay sesión que mantener: este cliente actúa como el servidor, no como un
      // usuario. Persistir o refrescar sesión aquí solo podría contaminar la del
      // visitante que esté haciendo la petición.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
