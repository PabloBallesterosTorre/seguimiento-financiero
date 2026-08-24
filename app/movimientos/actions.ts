"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sugerirCategoria } from "@/lib/categorizacion";
import { reforzarRegla } from "@/lib/reglas";

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

  if (categoria_id) {
    await reforzarRegla(supabase, user.id, descripcion, categoria_id);
  }

  revalidatePath("/movimientos");
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
}

export async function crearTraspaso(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const cuenta_origen_id = formData.get("cuenta_origen_id") as string;
  const cuenta_destino_id = formData.get("cuenta_destino_id") as string;
  const fecha = formData.get("fecha") as string;
  const importe = Math.abs(Number(formData.get("importe") ?? 0));
  const descripcionInput = (formData.get("descripcion") as string) || "";

  if (!cuenta_origen_id || !cuenta_destino_id || cuenta_origen_id === cuenta_destino_id || importe <= 0) {
    return;
  }

  const [{ data: origen }, { data: destino }] = await Promise.all([
    supabase.from("cuentas").select("saldo_actual, nombre").eq("id", cuenta_origen_id).single(),
    supabase.from("cuentas").select("saldo_actual, nombre").eq("id", cuenta_destino_id).single(),
  ]);

  if (!origen || !destino) return;

  const traspaso_grupo_id = crypto.randomUUID();

  await supabase.from("movimientos").insert([
    {
      usuario_id: user.id,
      cuenta_id: cuenta_origen_id,
      fecha,
      descripcion: descripcionInput || `Traspaso a ${destino.nombre}`,
      importe: -importe,
      tipo: "traspaso",
      origen: "manual",
      moneda: "EUR",
      traspaso_grupo_id,
    },
    {
      usuario_id: user.id,
      cuenta_id: cuenta_destino_id,
      fecha,
      descripcion: descripcionInput || `Traspaso desde ${origen.nombre}`,
      importe,
      tipo: "traspaso",
      origen: "manual",
      moneda: "EUR",
      traspaso_grupo_id,
    },
  ]);

  await Promise.all([
    supabase
      .from("cuentas")
      .update({ saldo_actual: Number(origen.saldo_actual) - importe })
      .eq("id", cuenta_origen_id),
    supabase
      .from("cuentas")
      .update({ saldo_actual: Number(destino.saldo_actual) + importe })
      .eq("id", cuenta_destino_id),
  ]);

  revalidatePath("/movimientos");
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");
}

export async function eliminarTraspaso(formData: FormData) {
  const supabase = createClient();
  const traspaso_grupo_id = formData.get("traspaso_grupo_id") as string;

  const { data: filas } = await supabase
    .from("movimientos")
    .select("cuenta_id, importe")
    .eq("traspaso_grupo_id", traspaso_grupo_id);

  await supabase.from("movimientos").delete().eq("traspaso_grupo_id", traspaso_grupo_id);

  for (const fila of filas ?? []) {
    const { data: cuenta } = await supabase
      .from("cuentas")
      .select("saldo_actual")
      .eq("id", fila.cuenta_id)
      .single();

    if (cuenta) {
      await supabase
        .from("cuentas")
        .update({ saldo_actual: Number(cuenta.saldo_actual) - Number(fila.importe) })
        .eq("id", fila.cuenta_id);
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
