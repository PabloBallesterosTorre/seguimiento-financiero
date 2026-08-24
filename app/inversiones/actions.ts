"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearInversion(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const tipo_activo = formData.get("tipo_activo") as string;
  const nombre = formData.get("nombre") as string;
  const valor_actual = Number(formData.get("valor_actual") ?? 0);

  await supabase.from("inversiones").insert({
    usuario_id: user.id,
    tipo_activo,
    nombre,
    valor_actual,
    moneda: "EUR",
    origen: "manual",
  });

  revalidatePath("/inversiones");
  revalidatePath("/dashboard");
}

export async function actualizarValorInversion(formData: FormData) {
  const supabase = createClient();
  const id = formData.get("id") as string;
  const valor_actual = Number(formData.get("valor_actual") ?? 0);

  await supabase
    .from("inversiones")
    .update({ valor_actual, fecha_actualizacion: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/inversiones");
  revalidatePath("/dashboard");
}

export async function eliminarInversion(formData: FormData) {
  const supabase = createClient();
  const id = formData.get("id") as string;

  await supabase.from("inversiones").delete().eq("id", id);

  revalidatePath("/inversiones");
  revalidatePath("/dashboard");
}
