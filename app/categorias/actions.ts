"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Bloque } from "@/lib/regla503020";

const BLOQUES_VALIDOS: Bloque[] = ["ingreso", "necesario", "capricho"];

function leerCamposCategoria(formData: FormData) {
  const bloque = formData.get("bloque") as string;
  return {
    nombre: formData.get("nombre") as string,
    categoria_padre_id: (formData.get("categoria_padre_id") as string) || null,
    es_categoria_inversion: formData.get("es_categoria_inversion") === "on",
    bloque: BLOQUES_VALIDOS.includes(bloque as Bloque) ? (bloque as Bloque) : null,
  };
}

export async function crearCategoria(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("categorias")
    .insert({
      usuario_id: user.id,
      ...leerCamposCategoria(formData),
    })
    .throwOnError();

  revalidatePath("/categorias");
}

export async function actualizarCategoria(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  await supabase.from("categorias").update(leerCamposCategoria(formData)).eq("id", id).throwOnError();

  revalidatePath("/categorias");
}

export async function eliminarCategoria(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  await supabase.from("categorias").delete().eq("id", id).throwOnError();

  revalidatePath("/categorias");
}

// Plantilla inicial ofrecida a un usuario nuevo sin categorías todavía, para no obligarle
// a crearlas todas a mano una a una antes de poder categorizar su primer movimiento
// importado. Son solo un punto de partida editable/eliminable, no una lista cerrada. Cada
// una trae ya su bloque de la regla 50/30/20 para que el gráfico funcione desde el primer
// mes; las transferencias entre cuentas propias no llevan, porque se anulan entre sí.
const CATEGORIAS_SUGERIDAS: { nombre: string; bloque: Bloque | null }[] = [
  { nombre: "Nómina", bloque: "ingreso" },
  { nombre: "Alimentación", bloque: "necesario" },
  { nombre: "Vivienda", bloque: "necesario" },
  { nombre: "Transporte", bloque: "necesario" },
  { nombre: "Ocio", bloque: "capricho" },
  { nombre: "Salud", bloque: "necesario" },
  { nombre: "Compras", bloque: "capricho" },
  { nombre: "Ahorro e Inversión", bloque: null },
  { nombre: "Transferencias entre cuentas propias", bloque: null },
];

export async function crearCategoriasSugeridas() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("categorias")
    .insert(
      CATEGORIAS_SUGERIDAS.map(({ nombre, bloque }) => ({
        usuario_id: user.id,
        nombre,
        categoria_padre_id: null,
        es_categoria_inversion: nombre === "Ahorro e Inversión",
        bloque,
      }))
    )
    .throwOnError();

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
  const supabase = await createClient();

  if (categoriaIds.length === 0) return [];

  const { data } = await supabase
    .from("movimientos")
    .select("id, fecha, descripcion, importe, tipo, cuentas(nombre, banco_nombre)")
    .in("categoria_id", categoriaIds)
    .order("fecha", { ascending: false })
    .limit(200);

  return (data ?? []) as unknown as MovimientoAsociado[];
}
