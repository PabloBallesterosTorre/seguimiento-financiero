"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function upsertConfiguracion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usuarioId: string,
  campos: Record<string, unknown>
) {
  await supabase
    .from("configuracion_usuario")
    .upsert(
      { usuario_id: usuarioId, ...campos, updated_at: new Date().toISOString() },
      { onConflict: "usuario_id" }
    )
    .throwOnError();
}

export async function guardarConfiguracionGeneral(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await upsertConfiguracion(supabase, user.id, {
    nombre: (formData.get("nombre") as string) || null,
    moneda_base: (formData.get("moneda_base") as string) || "EUR",
    idioma: (formData.get("idioma") as string) || "es",
  });

  revalidatePath("/", "layout");
}

export async function guardarObjetivoAhorroGlobal(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const objetivoRaw = formData.get("objetivo_ahorro_mensual") as string;

  await upsertConfiguracion(supabase, user.id, {
    objetivo_ahorro_mensual: objetivoRaw ? Number(objetivoRaw) : null,
    incluir_inversion_en_ahorro: formData.get("incluir_inversion_en_ahorro") === "on",
  });

  revalidatePath("/home");
  revalidatePath("/configuracion");
}
