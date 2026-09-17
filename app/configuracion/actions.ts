"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function upsertConfiguracion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usuarioId: string,
  campos: Record<string, unknown>
) {
  await supabase
    .from("configuracion_usuario")
    .upsert(
      { usuario_id: usuarioId, ...campos, updated_at: new Date().toISOString() },
      { onConflict: "usuario_id" }
    )
    .throwOnError();
}

export async function guardarConfiguracionGeneral(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await upsertConfiguracion(supabase, user.id, {
    nombre: (formData.get("nombre") as string) || null,
    moneda_base: (formData.get("moneda_base") as string) || "EUR",
    idioma: (formData.get("idioma") as string) || "es",
  });

  revalidatePath("/", "layout");
}

export async function guardarObjetivoAhorroGlobal(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const objetivoRaw = formData.get("objetivo_ahorro_mensual") as string;

  await upsertConfiguracion(supabase, user.id, {
    objetivo_ahorro_mensual: objetivoRaw ? Number(objetivoRaw) : null,
    incluir_inversion_en_ahorro: formData.get("incluir_inversion_en_ahorro") === "on",
  });

  revalidatePath("/home");
  revalidatePath("/configuracion");
}

// Tanda 12: el mes financiero. Se guarda la categoría que ancla la frontera, no la fecha
// concreta: las fechas se releen de los movimientos en cada carga, así que el mes de
// octubre se recoloca solo en cuanto entra la nómina de finales de septiembre.
export async function guardarMesFinanciero(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const categoria = (formData.get("categoria_inicio_mes") as string) || null;
  const diaRaw = Number(formData.get("dia_corte_mes"));
  // El check de la base de datos ya rechaza fuera de 1-28, pero un formulario manipulado
  // reventaría el guardado entero: se recorta aquí para que falle hacia un valor válido.
  const dia = Number.isFinite(diaRaw) ? Math.min(Math.max(Math.round(diaRaw), 1), 28) : 25;

  await upsertConfiguracion(supabase, user.id, {
    mes_financiero: formData.get("mes_financiero") === "on",
    dia_corte_mes: dia,
    categoria_inicio_mes: categoria,
  });

  // Cambia la frontera de todos los meses: no hay una sola pantalla con cifras mensuales
  // que no dependa de esto.
  revalidatePath("/", "layout");
}
