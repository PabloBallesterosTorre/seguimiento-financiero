"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { traducirErrorAuth } from "@/lib/erroresAuth";
import {
  motivoRechazo,
  normalizarCodigo,
  normalizarEmail,
  validarPassword,
  type Invitacion,
} from "@/lib/invitaciones";

const CAMPOS_INVITACION =
  "id, codigo, email, nota, creada_en, caduca_en, reservada_en, usada_por, usada_en";

// Vuelve al formulario conservando lo que ya había escrito (código y email), para no
// obligar a teclearlo otra vez por un error de contraseña.
function volverConError(codigo: string, email: string, error: string): never {
  const params = new URLSearchParams({ codigo, email, error });
  redirect(`/registro?${params.toString()}`);
}

export async function registrarConInvitacion(formData: FormData) {
  const codigo = normalizarCodigo((formData.get("codigo") as string) ?? "");
  const email = normalizarEmail((formData.get("email") as string) ?? "");
  const password = (formData.get("password") as string) ?? "";
  const password2 = (formData.get("password2") as string) ?? "";

  if (!codigo || !email) {
    volverConError(codigo, email, "Necesitas el código de invitación y tu email.");
  }

  // La contraseña se valida antes de tocar la invitación: si no, un simple error de
  // tecleo al repetirla reservaría el código y obligaría a esperar a que se liberase.
  const errorPassword = validarPassword(password, password2);
  if (errorPassword) volverConError(codigo, email, errorPassword);

  const admin = createAdminClient();

  const { data: invitacion, error: errorLectura } = await admin
    .from("invitaciones")
    .select(CAMPOS_INVITACION)
    .eq("codigo", codigo)
    .maybeSingle<Invitacion>();

  if (errorLectura) {
    console.error("registro: leer invitación", errorLectura.message);
    volverConError(codigo, email, "No se ha podido comprobar la invitación. Inténtalo de nuevo.");
  }

  const rechazo = motivoRechazo(invitacion, email, new Date());
  if (rechazo) volverConError(codigo, email, rechazo);

  const invitacionId = invitacion!.id;

  // Reserva atómica. La comprobación de arriba sirve para dar un mensaje útil, pero no
  // vale como cerrojo: entre leerla y escribirla cabe otra petición, y dos personas
  // acabarían con el mismo código. `canjear_invitacion` (migración 0032) mete todas las
  // condiciones en un único `update ... returning`, así que Postgres las resuelve bajo el
  // cerrojo de fila: solo una llamada recibe el id, y las demás reciben null.
  const { data: reservadaId, error: errorReserva } = await admin.rpc("canjear_invitacion", {
    p_codigo: codigo,
    p_email: email,
  });

  if (errorReserva) {
    console.error("registro: reservar invitación", errorReserva.message);
    volverConError(codigo, email, "No se ha podido comprobar la invitación. Inténtalo de nuevo.");
  }

  if (!reservadaId) {
    volverConError(codigo, email, "Esta invitación se acaba de usar. Pide una nueva a quien te la envió.");
  }

  const { data: creado, error: errorAlta } = await admin.auth.admin.createUser({
    email,
    password,
    // Sin paso de confirmación: la invitación ya dice quién es, porque el email lo
    // escribió quien invita, no quien se registra. Pedirle además que confirme el correo
    // no añadiría seguridad y sí un punto donde perder a la gente (spam, enlaces que
    // caducan). Ver el comentario de la migración 0032.
    email_confirm: true,
  });

  if (errorAlta || !creado?.user) {
    // El alta ha fallado, así que el código no se ha gastado: se suelta la reserva para
    // que pueda reintentarlo ahora mismo en vez de esperar a que caduque.
    await admin.from("invitaciones").update({ reservada_en: null }).eq("id", invitacionId);
    console.error("registro: crear usuario", errorAlta?.message);
    volverConError(codigo, email, traducirErrorAuth(errorAlta?.message));
  }

  const { error: errorMarcar } = await admin
    .from("invitaciones")
    .update({ usada_por: creado!.user.id, usada_en: new Date().toISOString() })
    .eq("id", invitacionId);

  // Si esto falla, el usuario ya existe y entrar no debe fallar por ello: la invitación
  // se queda reservada y la reserva caduca sola en 10 minutos. Se registra porque
  // significa que un código podría volver a quedar libre sin que nadie lo haya pedido.
  if (errorMarcar) console.error("registro: marcar invitación usada", errorMarcar.message);

  // Sesión iniciada con el cliente normal (el de las cookies): el alta termina dentro de
  // la app, no devolviendo a la pantalla de acceso a repetir la contraseña.
  const supabase = await createClient();
  const { error: errorSesion } = await supabase.auth.signInWithPassword({ email, password });

  if (errorSesion) {
    console.error("registro: iniciar sesión tras el alta", errorSesion.message);
    redirect(
      "/login?message=" +
        encodeURIComponent("Tu cuenta ya está creada. Entra con tu email y la contraseña que acabas de elegir.")
    );
  }

  revalidatePath("/", "layout");
  redirect("/home");
}
