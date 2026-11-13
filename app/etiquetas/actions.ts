"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { etiquetarPorReglas } from "@/lib/etiquetasServidor";

function revalidar() {
  revalidatePath("/movimientos");
  revalidatePath("/categorias");
  revalidatePath("/informes");
}

function leerPatron(formData: FormData): string | null {
  const patron = ((formData.get("patron") as string) ?? "").trim();
  return patron === "" ? null : patron;
}

// Devuelve un mensaje de error legible en vez de lanzar: el único fallo esperable es el
// nombre repetido (índice único sin distinguir mayúsculas), y eso es un aviso para el
// usuario, no una pantalla de error.
export async function crearEtiqueta(formData: FormData): Promise<{ ok: boolean; error?: string; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const nombre = ((formData.get("nombre") as string) ?? "").trim();
  if (!nombre) return { ok: false, error: "Ponle un nombre a la etiqueta." };

  const { data, error } = await supabase
    .from("etiquetas")
    .insert({ usuario_id: user.id, nombre, patron: leerPatron(formData) })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.code === "23505" ? `Ya tienes una etiqueta llamada "${nombre}".` : error.message };
  }

  revalidar();
  return { ok: true, id: data.id };
}

export async function editarEtiqueta(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const nombre = ((formData.get("nombre") as string) ?? "").trim();
  if (!nombre) return { ok: false, error: "Ponle un nombre a la etiqueta." };

  const { error } = await supabase.from("etiquetas").update({ nombre, patron: leerPatron(formData) }).eq("id", id);
  if (error) {
    return { ok: false, error: error.code === "23505" ? `Ya tienes una etiqueta llamada "${nombre}".` : error.message };
  }

  revalidar();
  return { ok: true };
}

// Borrar la etiqueta la quita de todos sus movimientos (on delete cascade); los movimientos
// no se tocan.
export async function eliminarEtiqueta(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  await supabase.from("etiquetas").delete().eq("id", id).throwOnError();
  revalidar();
}

// Pone o quita una etiqueta de un movimiento desde la tabla de Movimientos.
export async function alternarEtiquetaMovimiento(movimientoId: string, etiquetaId: string, poner: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  if (poner) {
    await supabase
      .from("movimiento_etiquetas")
      .upsert(
        { movimiento_id: movimientoId, etiqueta_id: etiquetaId, usuario_id: user.id, origen: "manual" },
        { onConflict: "movimiento_id,etiqueta_id", ignoreDuplicates: true }
      )
      .throwOnError();
  } else {
    await supabase
      .from("movimiento_etiquetas")
      .delete()
      .eq("movimiento_id", movimientoId)
      .eq("etiqueta_id", etiquetaId)
      .throwOnError();
  }

  revalidar();
}

// Aplica el patrón de una etiqueta a todo el histórico, a petición expresa del usuario.
// Las importaciones y altas nuevas ya lo aplican solas; esto es para lo que ya estaba dentro
// cuando se creó o se cambió el patrón.
export async function aplicarEtiquetaAExistentes(formData: FormData): Promise<{ etiquetados: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { etiquetados: 0 };

  const id = formData.get("id") as string;
  // Por páginas: la API de Supabase devuelve como mucho 1000 filas por consulta, y el
  // histórico de movimientos pasa de eso enseguida.
  const movimientos: { id: string; descripcion: string }[] = [];
  const pagina = 1000;
  for (let desde = 0; ; desde += pagina) {
    const { data } = await supabase
      .from("movimientos")
      .select("id, descripcion")
      .order("id")
      .range(desde, desde + pagina - 1)
      .throwOnError();
    movimientos.push(...(data ?? []));
    if (!data || data.length < pagina) break;
  }
  const etiquetados = await etiquetarPorReglas(supabase, user.id, movimientos, id);

  revalidar();
  return { etiquetados };
}
