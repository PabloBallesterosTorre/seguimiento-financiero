"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function leerCamposCategoria(formData: FormData) {
  const tipo = formData.get("tipo") as string;
  const categoria_padre_id = (formData.get("categoria_padre_id") as string) || null;

  return {
    nombre: formData.get("nombre") as string,
    tipo,
    categoria_padre_id,
    es_categoria_inversion: tipo === "gasto" && formData.get("es_categoria_inversion") === "on",
  };
}

export async function crearCategoria(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("categorias").insert({
    usuario_id: user.id,
    ...leerCamposCategoria(formData),
  });

  revalidatePath("/categorias");
}

export async function actualizarCategoria(formData: FormData) {
  const supabase = createClient();
  const id = formData.get("id") as string;

  await supabase.from("categorias").update(leerCamposCategoria(formData)).eq("id", id);

  revalidatePath("/categorias");
}

export async function eliminarCategoria(formData: FormData) {
  const supabase = createClient();
  const id = formData.get("id") as string;

  await supabase.from("categorias").delete().eq("id", id);

  revalidatePath("/categorias");
}
