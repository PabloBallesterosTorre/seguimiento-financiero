"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function guardarObjetivoAhorro(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const periodo = formData.get("periodo") as string;
  const importe_objetivo = Number(formData.get("importe_objetivo") ?? 0);

  await supabase
    .from("objetivos_ahorro")
    .upsert({ usuario_id: user.id, periodo, importe_objetivo }, { onConflict: "usuario_id,periodo" });

  revalidatePath("/dashboard");
}
