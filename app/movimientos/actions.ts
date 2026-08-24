"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearMovimiento(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const cuenta_id = formData.get("cuenta_id") as string;
  const fecha = formData.get("fecha") as string;
  const descripcion = formData.get("descripcion") as string;
  const tipo = formData.get("tipo") as string;
  const categoria_id = (formData.get("categoria_id") as string) || null;
  const importeInput = Number(formData.get("importe") ?? 0);
  const importe = tipo === "gasto" ? -Math.abs(importeInput) : Math.abs(importeInput);

  await supabase.from("movimientos").insert({
    usuario_id: user.id,
    cuenta_id,
    fecha,
    descripcion,
    importe,
    tipo,
    categoria_id,
    origen: "manual",
    moneda: "EUR",
  });

  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("saldo_actual")
    .eq("id", cuenta_id)
    .single();

  if (cuenta) {
    await supabase
      .from("cuentas")
      .update({ saldo_actual: Number(cuenta.saldo_actual) + importe })
      .eq("id", cuenta_id);
  }

  revalidatePath("/movimientos");
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
}

export async function eliminarMovimiento(formData: FormData) {
  const supabase = createClient();
  const id = formData.get("id") as string;

  const { data: movimiento } = await supabase
    .from("movimientos")
    .select("cuenta_id, importe")
    .eq("id", id)
    .single();

  await supabase.from("movimientos").delete().eq("id", id);

  if (movimiento) {
    const { data: cuenta } = await supabase
      .from("cuentas")
      .select("saldo_actual")
      .eq("id", movimiento.cuenta_id)
      .single();

    if (cuenta) {
      await supabase
        .from("cuentas")
        .update({ saldo_actual: Number(cuenta.saldo_actual) - Number(movimiento.importe) })
        .eq("id", movimiento.cuenta_id);
    }
  }

  revalidatePath("/movimientos");
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
}
