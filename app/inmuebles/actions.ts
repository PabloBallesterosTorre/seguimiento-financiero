"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Tanda 18: alta, ficha, valoraciones y vínculos de los inmuebles. RLS ya limita todo al
// usuario; las políticas de `inmuebles` además impiden enlazar una hipoteca ajena.

function texto(formData: FormData, campo: string): string | null {
  const v = ((formData.get(campo) as string) ?? "").trim();
  return v === "" ? null : v;
}

function numero(formData: FormData, campo: string): number | null {
  const v = texto(formData, campo);
  if (v === null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function datosFicha(formData: FormData) {
  const uso = texto(formData, "uso");
  const porcentaje = numero(formData, "porcentaje_propiedad");
  return {
    nombre: texto(formData, "nombre") ?? "Inmueble",
    uso: uso === "vivienda_habitual" || uso === "segunda_residencia" || uso === "otro" ? uso : "alquiler",
    direccion: texto(formData, "direccion"),
    superficie_m2: numero(formData, "superficie_m2"),
    fecha_compra: texto(formData, "fecha_compra"),
    precio_compra: numero(formData, "precio_compra"),
    gastos_compra: numero(formData, "gastos_compra") ?? 0,
    porcentaje_propiedad: porcentaje !== null && porcentaje > 0 && porcentaje <= 100 ? porcentaje : 100,
    deuda_id: texto(formData, "deuda_id"),
    fianza: numero(formData, "fianza"),
    ambito: formData.get("ambito") === "conjunto" ? "conjunto" : "personal",
    notas: texto(formData, "notas"),
  };
}

// El valor del inmueble es el de su última valoración por fecha, no el de la última que se
// tecleó: registrar hoy una tasación antigua no debe pisar una más reciente.
async function sincronizarValorActual(supabase: Awaited<ReturnType<typeof createClient>>, inmuebleId: string) {
  const { data: ultima } = await supabase
    .from("inmueble_valoraciones")
    .select("fecha, valor")
    .eq("inmueble_id", inmuebleId)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase
    .from("inmuebles")
    .update({ valor_actual: ultima?.valor ?? null, fecha_valoracion: ultima?.fecha ?? null })
    .eq("id", inmuebleId)
    .throwOnError();
}

function revalidar(id?: string) {
  revalidatePath("/inmuebles");
  if (id) revalidatePath(`/inmuebles/${id}`);
  revalidatePath("/home");
  revalidatePath("/planificador");
}

export async function crearInmueble(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const valor = numero(formData, "valor_actual");
  const hoy = new Date().toISOString().slice(0, 10);

  const { data: creado } = await supabase
    .from("inmuebles")
    .insert({ usuario_id: user.id, ...datosFicha(formData) })
    .select("id")
    .single()
    .throwOnError();

  if (valor !== null && valor >= 0) {
    await supabase
      .from("inmueble_valoraciones")
      .insert({ inmueble_id: creado.id, usuario_id: user.id, fecha: hoy, valor })
      .throwOnError();
    await sincronizarValorActual(supabase, creado.id);
  }

  revalidar(creado.id);
  redirect(`/inmuebles/${creado.id}`);
}

export async function actualizarInmueble(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  await supabase.from("inmuebles").update(datosFicha(formData)).eq("id", id).throwOnError();
  revalidar(id);
}

export async function eliminarInmueble(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  // Los movimientos se quedan (on delete set null): eran gastos e ingresos reales.
  await supabase.from("inmuebles").delete().eq("id", id).throwOnError();
  revalidar();
  revalidatePath("/movimientos");
  redirect("/inmuebles");
}

export async function registrarValoracionInmueble(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const inmuebleId = formData.get("inmueble_id") as string;
  const fecha = texto(formData, "fecha") ?? new Date().toISOString().slice(0, 10);
  const valor = numero(formData, "valor");
  if (valor === null || valor < 0) return;

  // Una valoración por día: volver a registrar la misma fecha la corrige.
  await supabase
    .from("inmueble_valoraciones")
    .upsert({ inmueble_id: inmuebleId, usuario_id: user.id, fecha, valor }, { onConflict: "inmueble_id,fecha" })
    .throwOnError();
  await sincronizarValorActual(supabase, inmuebleId);
  revalidar(inmuebleId);
}

export async function eliminarValoracionInmueble(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const inmuebleId = formData.get("inmueble_id") as string;
  await supabase.from("inmueble_valoraciones").delete().eq("id", id).throwOnError();
  await sincronizarValorActual(supabase, inmuebleId);
  revalidar(inmuebleId);
}

// Atajo para lo que ya estaba organizado con etiquetas ("Piso Pablo"): vincula de una vez
// todos los movimientos de esa etiqueta que aún no tienen inmueble. No toca los que ya
// están vinculados a otro.
export async function vincularMovimientosDeEtiqueta(formData: FormData) {
  const supabase = await createClient();
  const inmuebleId = formData.get("inmueble_id") as string;
  const etiquetaId = formData.get("etiqueta_id") as string;
  if (!inmuebleId || !etiquetaId) return;

  const { data: propio } = await supabase.from("inmuebles").select("id").eq("id", inmuebleId).maybeSingle();
  if (!propio) return;

  const { data: filas } = await supabase
    .from("movimiento_etiquetas")
    .select("movimiento_id")
    .eq("etiqueta_id", etiquetaId)
    .throwOnError();
  const ids = (filas ?? []).map((f) => f.movimiento_id as string);

  // Por tandas: una lista de ids muy larga no cabe en la URL de PostgREST.
  for (let i = 0; i < ids.length; i += 200) {
    await supabase
      .from("movimientos")
      .update({ inmueble_id: inmuebleId })
      .in("id", ids.slice(i, i + 200))
      .is("inmueble_id", null)
      .neq("tipo", "traspaso")
      .throwOnError();
  }
  revalidar(inmuebleId);
  revalidatePath("/movimientos");
}
