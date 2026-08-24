"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearCuenta(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const banco = formData.get("banco") as string;
  const nombre = formData.get("nombre") as string;
  const tipo = formData.get("tipo") as string;
  const saldo_actual = Number(formData.get("saldo_actual") ?? 0);

  await supabase.from("cuentas").insert({
    usuario_id: user.id,
    banco_nombre: banco,
    nombre,
    tipo,
    saldo_actual,
    moneda: "EUR",
    activa: true,
  });

  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
}

export async function eliminarCuenta(formData: FormData) {
  const supabase = createClient();
  const id = formData.get("id") as string;

  await supabase.from("cuentas").delete().eq("id", id);

  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
}
