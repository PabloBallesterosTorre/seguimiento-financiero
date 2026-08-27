"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function leerCamposCuenta(formData: FormData) {
  const es_remunerada = formData.get("es_remunerada") === "on";
  const tipoInteresRaw = formData.get("tipo_interes") as string;
  const periodicidadRaw = formData.get("periodicidad_pago_interes") as string;

  const ibanRaw = formData.get("iban") as string;

  return {
    banco_nombre: formData.get("banco") as string,
    nombre: formData.get("nombre") as string,
    tipo: formData.get("tipo") as string,
    saldo_actual: Number(formData.get("saldo_actual") ?? 0),
    iban: ibanRaw ? ibanRaw.replace(/\s+/g, "").toUpperCase() : null,
    es_remunerada,
    tipo_interes: es_remunerada && tipoInteresRaw ? Number(tipoInteresRaw) : null,
    periodicidad_pago_interes: es_remunerada && periodicidadRaw ? periodicidadRaw : null,
  };
}

export async function crearCuenta(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("cuentas")
    .insert({
      usuario_id: user.id,
      ...leerCamposCuenta(formData),
      moneda: "EUR",
      activa: true,
    })
    .throwOnError();

  revalidatePath("/cuentas");
  revalidatePath("/home");
}

export async function actualizarCuenta(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  await supabase.from("cuentas").update(leerCamposCuenta(formData)).eq("id", id).throwOnError();

  revalidatePath("/cuentas");
  revalidatePath("/home");
}

export async function eliminarCuenta(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  await supabase.from("cuentas").delete().eq("id", id).throwOnError();

  revalidatePath("/cuentas");
  revalidatePath("/home");
}
