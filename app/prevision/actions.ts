"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearMovimientoPrevisto(formData: FormData) {
  const supabase = createClient();

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

  await supabase.from("movimientos_previstos").insert({
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
  });

  revalidatePath("/prevision");
  revalidatePath("/prevision/previstos");
}

export async function actualizarMovimientoPrevisto(formData: FormData) {
  const supabase = createClient();
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
    })
    .eq("id", id);

  revalidatePath("/prevision");
  revalidatePath("/prevision/previstos");
}

export async function cambiarEstadoPrevisto(formData: FormData) {
  const supabase = createClient();
  const id = formData.get("id") as string;
  const estado = formData.get("estado") as string;

  await supabase.from("movimientos_previstos").update({ estado }).eq("id", id);

  revalidatePath("/prevision");
  revalidatePath("/prevision/previstos");
}

export async function eliminarMovimientoPrevisto(formData: FormData) {
  const supabase = createClient();
  const id = formData.get("id") as string;

  await supabase.from("movimientos_previstos").delete().eq("id", id);

  revalidatePath("/prevision");
  revalidatePath("/prevision/previstos");
}

export async function vincularMovimientoPrevisto(formData: FormData) {
  const supabase = createClient();
  const previsto_id = formData.get("previsto_id") as string;
  const movimiento_id = formData.get("movimiento_id") as string;

  if (!movimiento_id) return;

  await supabase
    .from("movimientos_previstos")
    .update({ movimiento_real_id: movimiento_id })
    .eq("id", previsto_id);

  revalidatePath("/prevision");
}

export async function desvincularMovimientoPrevisto(formData: FormData) {
  const supabase = createClient();
  const previsto_id = formData.get("previsto_id") as string;

  await supabase
    .from("movimientos_previstos")
    .update({ movimiento_real_id: null })
    .eq("id", previsto_id);

  revalidatePath("/prevision");
}
