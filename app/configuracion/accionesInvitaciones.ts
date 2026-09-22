"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { esAdminActual } from "@/lib/admin";
import { generarCodigo, normalizarEmail, type Invitacion } from "@/lib/invitaciones";

const CAMPOS_INVITACION =
  "id, codigo, email, nota, creada_en, caduca_en, reservada_en, usada_por, usada_en";

const DIAS_VALIDEZ = 30;

// Comprueba que quien llama es administrador y devuelve su sesión.
//
// La comprobación va aquí y no solo en la pantalla: que el botón no se pinte no impide
// que alguien invoque la server action por su cuenta. Las políticas RLS de la tabla solo
// garantizan que cada uno gestiona SUS invitaciones — no que pueda crearlas.
async function exigirAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !esAdminActual(user.email)) {
    throw new Error("Solo un administrador puede gestionar invitaciones.");
  }

  return { supabase, user };
}

export async function listarInvitaciones(): Promise<Invitacion[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !esAdminActual(user.email)) return [];

  const { data, error } = await supabase
    .from("invitaciones")
    .select(CAMPOS_INVITACION)
    .order("creada_en", { ascending: false });

  if (error) {
    console.error("listarInvitaciones", error.message);
    return [];
  }

  return (data ?? []) as Invitacion[];
}

export async function crearInvitacion(formData: FormData) {
  const { supabase, user } = await exigirAdmin();

  const email = normalizarEmail((formData.get("email") as string) ?? "");
  const nota = ((formData.get("nota") as string) ?? "").trim();

  if (!email) return;

  const caducaEn = new Date(Date.now() + DIAS_VALIDEZ * 24 * 60 * 60 * 1000).toISOString();

  await supabase
    .from("invitaciones")
    .insert({
      codigo: generarCodigo(),
      email,
      nota: nota || null,
      creada_por: user.id,
      caduca_en: caducaEn,
    })
    .throwOnError();

  revalidatePath("/configuracion");
}

// Borrar una invitación es la forma de revocarla: mientras no se haya canjeado, deja de
// existir y el enlace que se envió deja de servir. Las ya usadas también se pueden
// borrar —son solo historial—, y hacerlo no toca la cuenta que se creó con ella.
export async function revocarInvitacion(formData: FormData) {
  const { supabase } = await exigirAdmin();

  const id = formData.get("id") as string;
  if (!id) return;

  await supabase.from("invitaciones").delete().eq("id", id).throwOnError();

  revalidatePath("/configuracion");
}
