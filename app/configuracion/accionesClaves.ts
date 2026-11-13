"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generarClave, hashClave, prefijoClave } from "@/lib/mcp/claves";

export type ClaveApi = {
  id: string;
  nombre: string;
  prefijo: string;
  permiso: "lectura" | "escritura";
  created_at: string;
  ultimo_uso: string | null;
  revocada_at: string | null;
};

export async function listarClaves(): Promise<ClaveApi[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("claves_api")
    .select("id, nombre, prefijo, permiso, created_at, ultimo_uso, revocada_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as ClaveApi[];
}

// Devuelve la clave en claro UNA sola vez: en la base de datos solo queda su hash, así que
// después nadie —tampoco la app— puede volver a enseñarla.
export async function crearClave(formData: FormData): Promise<{ ok: boolean; clave?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const nombre = ((formData.get("nombre") as string) ?? "").trim();
  if (!nombre) return { ok: false, error: "Ponle un nombre para reconocerla (p. ej. «Portátil»)." };
  const permiso = formData.get("permiso") === "escritura" ? "escritura" : "lectura";

  const clave = generarClave();
  const { error } = await supabase.from("claves_api").insert({
    usuario_id: user.id,
    nombre,
    prefijo: prefijoClave(clave),
    hash: hashClave(clave),
    permiso,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/configuracion");
  return { ok: true, clave };
}

// Revocar y no borrar: la fila se queda para saber qué clave existió y cuándo se usó por
// última vez, pero deja de abrir nada (las funciones mcp_* exigen revocada_at nulo).
export async function revocarClave(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  await supabase
    .from("claves_api")
    .update({ revocada_at: new Date().toISOString() })
    .eq("id", id)
    .is("revocada_at", null)
    .throwOnError();
  revalidatePath("/configuracion");
}
