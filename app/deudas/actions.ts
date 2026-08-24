"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Recurrencia, TipoReduccion } from "@/lib/amortizacion";

export async function crearDeuda(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const tipo = formData.get("tipo") as string;
  const nombre = formData.get("nombre") as string;
  const capital_inicial = Number(formData.get("capital_inicial") ?? 0);
  const capitalPendienteRaw = formData.get("capital_pendiente") as string;
  const capital_pendiente = capitalPendienteRaw ? Number(capitalPendienteRaw) : capital_inicial;
  const cuota = Number(formData.get("cuota") ?? 0);
  const tipoInteresRaw = formData.get("tipo_interes") as string;
  const tipo_interes = tipoInteresRaw ? Number(tipoInteresRaw) : null;
  const modalidad_interes = (formData.get("modalidad_interes") as string) || "fijo";
  const fecha_inicio = formData.get("fecha_inicio") as string;
  const fecha_fin = (formData.get("fecha_fin") as string) || null;
  const valorResidualRaw = formData.get("valor_residual") as string;
  const valor_residual = valorResidualRaw ? Number(valorResidualRaw) : null;

  await supabase.from("deudas").insert({
    usuario_id: user.id,
    tipo,
    nombre,
    capital_inicial,
    capital_pendiente,
    cuota,
    tipo_interes,
    modalidad_interes,
    fecha_inicio,
    fecha_fin,
    valor_residual,
    moneda: "EUR",
  });

  revalidatePath("/deudas");
  revalidatePath("/dashboard");
}

export async function eliminarDeuda(formData: FormData) {
  const supabase = createClient();
  const id = formData.get("id") as string;

  await supabase.from("deudas").delete().eq("id", id);

  revalidatePath("/deudas");
  revalidatePath("/dashboard");
}

export async function aplicarAmortizacionExtra(params: {
  deuda_id: string;
  importe: number;
  tipo_reduccion: TipoReduccion;
  recurrencia: Recurrencia;
  cuota_nueva: number | null;
  meses_restantes_nuevos: number;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "No autenticado." };

  const { deuda_id, importe, tipo_reduccion, recurrencia, cuota_nueva, meses_restantes_nuevos } = params;

  const { error } = await supabase.from("amortizaciones_extra").insert({
    usuario_id: user.id,
    deuda_id,
    fecha: new Date().toISOString().slice(0, 10),
    importe,
    tipo_reduccion,
    recurrencia,
  });

  if (error) return { ok: false as const, error: error.message };

  const nuevaFechaFin = new Date();
  nuevaFechaFin.setMonth(nuevaFechaFin.getMonth() + meses_restantes_nuevos);
  const fecha_fin = nuevaFechaFin.toISOString().slice(0, 10);

  if (recurrencia === "puntual") {
    const { data: deuda } = await supabase
      .from("deudas")
      .select("capital_pendiente")
      .eq("id", deuda_id)
      .single();

    await supabase
      .from("deudas")
      .update({
        capital_pendiente: deuda ? Number(deuda.capital_pendiente) - importe : undefined,
        ...(cuota_nueva ? { cuota: cuota_nueva } : {}),
        fecha_fin,
      })
      .eq("id", deuda_id);
  } else {
    await supabase.from("deudas").update({ fecha_fin }).eq("id", deuda_id);
  }

  revalidatePath(`/deudas/${deuda_id}`);
  revalidatePath("/deudas");
  revalidatePath("/dashboard");

  return { ok: true as const };
}

export async function eliminarAmortizacionExtra(formData: FormData) {
  const supabase = createClient();
  const id = formData.get("id") as string;
  const deuda_id = formData.get("deuda_id") as string;

  await supabase.from("amortizaciones_extra").delete().eq("id", id);

  revalidatePath(`/deudas/${deuda_id}`);
}
