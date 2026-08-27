"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function leerCamposCategoria(formData: FormData) {
  return {
    nombre: formData.get("nombre") as string,
    categoria_padre_id: (formData.get("categoria_padre_id") as string) || null,
    es_categoria_inversion: formData.get("es_categoria_inversion") === "on",
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

// Plantilla inicial ofrecida a un usuario nuevo sin categorías todavía, para no obligarle
// a crearlas todas a mano una a una antes de poder categorizar su primer movimiento
// importado. Son solo un punto de partida editable/eliminable, no una lista cerrada.
const CATEGORIAS_SUGERIDAS = [
  "Nómina",
  "Alimentación",
  "Vivienda",
  "Transporte",
  "Ocio",
  "Salud",
  "Compras",
  "Ahorro e Inversión",
  "Transferencias entre cuentas propias",
];

export async function crearCategoriasSugeridas() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("categorias").insert(
    CATEGORIAS_SUGERIDAS.map((nombre) => ({
      usuario_id: user.id,
      nombre,
      categoria_padre_id: null,
      es_categoria_inversion: nombre === "Ahorro e Inversión",
    }))
  );

  revalidatePath("/categorias");
}

export type MovimientoAsociado = {
  id: string;
  fecha: string;
  descripcion: string;
  importe: number;
  tipo: string;
  cuentas: { nombre: string; banco_nombre: string } | null;
};

// Movimientos asociados a una categoría, para la vista de detalle al editar:
// el llamador decide qué ids incluir (solo la propia si es una subcategoría,
// o ella más sus subcategorías si es una categoría padre).
export async function obtenerMovimientosDeCategoria(categoriaIds: string[]): Promise<MovimientoAsociado[]> {
  const supabase = createClient();

  if (categoriaIds.length === 0) return [];

  const { data } = await supabase
    .from("movimientos")
    .select("id, fecha, descripcion, importe, tipo, cuentas(nombre, banco_nombre)")
    .in("categoria_id", categoriaIds)
    .order("fecha", { ascending: false })
    .limit(200);

  return (data ?? []) as unknown as MovimientoAsociado[];
}
