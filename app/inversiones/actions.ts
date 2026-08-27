"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function crearInversion(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const tipo_activo = formData.get("tipo_activo") as string;
  const nombre = formData.get("nombre") as string;
  const valor_actual = Number(formData.get("valor_actual") ?? 0);
  const es_recurrente = formData.get("es_recurrente") === "on";
  const movimiento_previsto_id = es_recurrente ? (formData.get("movimiento_previsto_id") as string) || null : null;
  const rentabilidadRaw = formData.get("rentabilidad_anual_asumida");
  const rentabilidad_anual_asumida = rentabilidadRaw && rentabilidadRaw !== "" ? Number(rentabilidadRaw) : null;
  const hoy = new Date().toISOString().slice(0, 10);

  const { data: inversion } = await supabase
    .from("inversiones")
    .insert({
      usuario_id: user.id,
      tipo_activo,
      nombre,
      valor_actual,
      moneda: "EUR",
      origen: "manual",
      es_recurrente,
      movimiento_previsto_id,
      rentabilidad_anual_asumida,
    })
    .select("id")
    .single()
    .throwOnError();

  await supabase
    .from("inversion_valoraciones")
    .insert({ usuario_id: user.id, inversion_id: inversion.id, fecha: hoy, valor: valor_actual, origen: "manual" })
    .throwOnError();

  revalidatePath("/inversiones");
  revalidatePath("/home");
  revalidatePath("/planificador");
}

export async function editarInversion(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const tipo_activo = formData.get("tipo_activo") as string;
  const nombre = formData.get("nombre") as string;
  const es_recurrente = formData.get("es_recurrente") === "on";
  const movimiento_previsto_id = es_recurrente ? (formData.get("movimiento_previsto_id") as string) || null : null;
  const rentabilidadRaw = formData.get("rentabilidad_anual_asumida");
  const rentabilidad_anual_asumida = rentabilidadRaw && rentabilidadRaw !== "" ? Number(rentabilidadRaw) : null;

  await supabase
    .from("inversiones")
    .update({ tipo_activo, nombre, es_recurrente, movimiento_previsto_id, rentabilidad_anual_asumida })
    .eq("id", id)
    .throwOnError();

  revalidatePath("/inversiones");
  revalidatePath(`/inversiones/${id}`);
  revalidatePath("/planificador");
}

// Registra un nuevo punto de valoración (fecha + valor). Usado tanto por la
// actualización rápida del listado (fecha = hoy) como por el formulario de la
// pantalla de detalle (fecha libre, para corregir o rellenar histórico pasado). El
// mismo día solo puede tener un punto por inversión (tanda 8, mejora 2b) — un
// segundo guardado el mismo día corrige el valor de ese día en vez de duplicarlo.
export async function registrarValoracionInversion(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const id = formData.get("id") as string;
  const valor_actual = Number(formData.get("valor_actual") ?? 0);
  const fechaRaw = formData.get("fecha") as string | null;
  const fecha = fechaRaw && fechaRaw !== "" ? fechaRaw : new Date().toISOString().slice(0, 10);

  await supabase
    .from("inversion_valoraciones")
    .upsert(
      { usuario_id: user.id, inversion_id: id, fecha, valor: valor_actual, origen: "manual" },
      { onConflict: "inversion_id,fecha" }
    )
    .throwOnError();

  // .throwOnError() aquí es importante: la valoración ya se ha guardado arriba, así
  // que un fallo silencioso en esta lectura dejaría el valor_actual "en caché" de la
  // inversión desincronizado de su histórico real.
  const { data: masReciente } = await supabase
    .from("inversion_valoraciones")
    .select("fecha, valor")
    .eq("inversion_id", id)
    .order("fecha", { ascending: false })
    .limit(1)
    .single()
    .throwOnError();

  await supabase
    .from("inversiones")
    .update({ valor_actual: masReciente.valor, fecha_actualizacion: new Date(masReciente.fecha).toISOString() })
    .eq("id", id)
    .throwOnError();

  revalidatePath("/inversiones");
  revalidatePath(`/inversiones/${id}`);
  revalidatePath("/home");
  revalidatePath("/planificador");
}

export async function eliminarInversion(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  await supabase.from("inversiones").delete().eq("id", id).throwOnError();

  revalidatePath("/inversiones");
  revalidatePath("/home");
  revalidatePath("/planificador");
}
