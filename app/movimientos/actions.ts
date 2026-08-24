"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizarDescripcion, sugerirCategoria } from "@/lib/categorizacion";

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
  const importeInput = Number(formData.get("importe") ?? 0);
  const importe = tipo === "gasto" ? -Math.abs(importeInput) : Math.abs(importeInput);

  let categoria_id = (formData.get("categoria_id") as string) || null;

  const { data: reglas } = await supabase
    .from("reglas_categorizacion")
    .select("patron_descripcion, categoria_id, veces_usada")
    .eq("usuario_id", user.id);

  if (!categoria_id) {
    categoria_id = sugerirCategoria(descripcion, reglas ?? []);
  }

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

  // Aprendizaje: refuerza o crea la regla de categorización para esta descripción.
  if (categoria_id) {
    const patron = normalizarDescripcion(descripcion);

    const { data: reglaExistente } = await supabase
      .from("reglas_categorizacion")
      .select("id, veces_usada")
      .eq("usuario_id", user.id)
      .eq("patron_descripcion", patron)
      .maybeSingle();

    if (reglaExistente) {
      await supabase
        .from("reglas_categorizacion")
        .update({
          categoria_id,
          veces_usada: reglaExistente.veces_usada + 1,
          ultima_fecha_uso: new Date().toISOString(),
        })
        .eq("id", reglaExistente.id);
    } else {
      await supabase.from("reglas_categorizacion").insert({
        usuario_id: user.id,
        patron_descripcion: patron,
        categoria_id,
      });
    }
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
