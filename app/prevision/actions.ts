"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearMovimientoPrevisto(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const descripcion = formData.get("descripcion") as string;
  const tipo = formData.get("tipo") as string;
  const categoria_id = (formData.get("categoria_id") as string) || null;
  const cuenta_id = (formData.get("cuenta_id") as string) || null;
  const importe_estimado = Number(formData.get("importe_estimado") ?? 0);
  const importeMinRaw = formData.get("importe_min") as string;
  const importeMaxRaw = formData.get("importe_max") as string;
  const importe_min = importeMinRaw ? Number(importeMinRaw) : null;
  const importe_max = importeMaxRaw ? Number(importeMaxRaw) : null;
  const tipo_recurrencia = formData.get("tipo_recurrencia") as string;
  const periodicidad = (formData.get("periodicidad") as string) || null;
  const fecha = (formData.get("fecha") as string) || null;
  const fecha_inicio = (formData.get("fecha_inicio") as string) || null;
  const fecha_fin = (formData.get("fecha_fin") as string) || null;
  const origen_calculo = (formData.get("origen_calculo") as string) === "media_categoria" ? "media_categoria" : "fijo";
  // Presupuesto de categoría en vez de transacción esperada: ver migración 0030 y
  // ocurrenciasPendientesEnMes.
  const es_presupuesto = formData.get("es_presupuesto") === "on";

  await supabase
    .from("movimientos_previstos")
    .insert({
      usuario_id: user.id,
      descripcion,
      tipo,
      categoria_id,
      cuenta_id,
      importe_estimado,
      importe_min,
      importe_max,
      tipo_recurrencia,
      periodicidad: tipo_recurrencia === "recurrente" ? periodicidad : null,
      fecha: tipo_recurrencia === "unica_vez" ? fecha : null,
      fecha_inicio: tipo_recurrencia === "recurrente" ? fecha_inicio : null,
      fecha_fin: tipo_recurrencia === "recurrente" ? fecha_fin : null,
      estado: "activo",
      origen_calculo,
      es_presupuesto,
    })
    .throwOnError();

  revalidatePath("/prevision");
  revalidatePath("/prevision/previstos");
}

export async function actualizarMovimientoPrevisto(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const descripcion = formData.get("descripcion") as string;
  const tipo = formData.get("tipo") as string;
  const categoria_id = (formData.get("categoria_id") as string) || null;
  const cuenta_id = (formData.get("cuenta_id") as string) || null;
  const importe_estimado = Number(formData.get("importe_estimado") ?? 0);
  const importeMinRaw = formData.get("importe_min") as string;
  const importeMaxRaw = formData.get("importe_max") as string;
  const importe_min = importeMinRaw ? Number(importeMinRaw) : null;
  const importe_max = importeMaxRaw ? Number(importeMaxRaw) : null;
  const tipo_recurrencia = formData.get("tipo_recurrencia") as string;
  const periodicidad = (formData.get("periodicidad") as string) || null;
  const fecha = (formData.get("fecha") as string) || null;
  const fecha_inicio = (formData.get("fecha_inicio") as string) || null;
  const fecha_fin = (formData.get("fecha_fin") as string) || null;
  const es_presupuesto = formData.get("es_presupuesto") === "on";

  await supabase
    .from("movimientos_previstos")
    .update({
      descripcion,
      tipo,
      categoria_id,
      cuenta_id,
      importe_estimado,
      importe_min,
      importe_max,
      tipo_recurrencia,
      periodicidad: tipo_recurrencia === "recurrente" ? periodicidad : null,
      fecha: tipo_recurrencia === "unica_vez" ? fecha : null,
      fecha_inicio: tipo_recurrencia === "recurrente" ? fecha_inicio : null,
      fecha_fin: tipo_recurrencia === "recurrente" ? fecha_fin : null,
      es_presupuesto,
    })
    .eq("id", id)
    .throwOnError();

  revalidatePath("/prevision");
  revalidatePath("/prevision/previstos");
}

export async function cambiarEstadoPrevisto(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const estado = formData.get("estado") as string;

  await supabase.from("movimientos_previstos").update({ estado }).eq("id", id).throwOnError();

  revalidatePath("/prevision");
  revalidatePath("/prevision/previstos");
}

export async function eliminarMovimientoPrevisto(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  await supabase.from("movimientos_previstos").delete().eq("id", id).throwOnError();

  revalidatePath("/prevision");
  revalidatePath("/prevision/previstos");
}

export async function descartarSugerenciaPrevision(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const nivel = formData.get("nivel") as string;
  const clave = formData.get("clave") as string;

  await supabase
    .from("patrones_descartados")
    .upsert({ usuario_id: user.id, nivel, clave }, { onConflict: "usuario_id,nivel,clave" })
    .throwOnError();

  revalidatePath("/prevision/sugerencias");
}

export async function vincularMovimientoPrevisto(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const previsto_id = formData.get("previsto_id") as string;
  const movimiento_id = formData.get("movimiento_id") as string;

  if (!movimiento_id) return;

  // El periodo es la FECHA del movimiento real, no el día 1 del mes.
  //
  // El mes sigue siendo el mismo (todo lo que lee `periodo` se queda con los siete primeros
  // caracteres), pero así un previsto semanal puede tener varias conciliaciones en un mismo
  // mes: las aportaciones a inversión ocurren cuatro o cinco veces al mes y con el día 1
  // fijo solo se podía enlazar una, por la clave única (previsto_id, periodo).
  //
  // Se lee de la base de datos en vez de aceptarla del formulario: la fecha del movimiento
  // es un hecho, no algo que deba poder mandar el cliente.
  const { data: movimiento } = await supabase
    .from("movimientos")
    .select("fecha")
    .eq("id", movimiento_id)
    .maybeSingle();

  if (!movimiento) return;

  await supabase
    .from("previsto_conciliaciones")
    .upsert(
      { usuario_id: user.id, previsto_id, periodo: movimiento.fecha, movimiento_real_id: movimiento_id },
      { onConflict: "previsto_id,periodo" }
    )
    .throwOnError();

  revalidatePath("/prevision");
}

export async function desvincularMovimientoPrevisto(formData: FormData) {
  const supabase = await createClient();
  const previsto_id = formData.get("previsto_id") as string;
  const periodo = formData.get("periodo") as string;

  await supabase
    .from("previsto_conciliaciones")
    .delete()
    .eq("previsto_id", previsto_id)
    .eq("periodo", periodo)
    .throwOnError();

  revalidatePath("/prevision");
}
