"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcularCuota, simularAmortizacion, type Recurrencia, type TipoReduccion } from "@/lib/amortizacion";

type SupabaseServerClient = ReturnType<typeof createClient>;

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

// Descuenta `importe` del capital pendiente de la deuda, recalcula la cuota si el
// efecto es "reducir_cuota" y actualiza la fecha de fin estimada — usado tanto al
// registrar una amortización con fecha pasada/hoy como al confirmar una planificada.
async function aplicarFilaAmortizacion(
  supabase: SupabaseServerClient,
  filaId: string,
  deudaId: string,
  importe: number,
  tipoReduccion: TipoReduccion
) {
  const { data: deuda } = await supabase
    .from("deudas")
    .select("capital_pendiente, cuota, tipo_interes, valor_residual")
    .eq("id", deudaId)
    .single();

  if (!deuda || deuda.tipo_interes === null) {
    await supabase
      .from("amortizaciones_extra")
      .update({ aplicado: true, aplicado_en: new Date().toISOString() })
      .eq("id", filaId);
    return;
  }

  const tasaAnual = Number(deuda.tipo_interes);
  const valorResidual = Number(deuda.valor_residual ?? 0);
  const capitalActual = Number(deuda.capital_pendiente);
  const cuotaActual = Number(deuda.cuota);

  const antes = simularAmortizacion(capitalActual, tasaAnual, cuotaActual, valorResidual);
  const nuevoCapital = Math.max(capitalActual - importe, valorResidual);

  let cuotaNueva = cuotaActual;
  if (tipoReduccion === "reducir_cuota") {
    cuotaNueva = calcularCuota(nuevoCapital, tasaAnual, antes.mesesRestantes, valorResidual);
  }

  const despues = simularAmortizacion(nuevoCapital, tasaAnual, cuotaNueva, valorResidual);
  const nuevaFechaFin = new Date();
  nuevaFechaFin.setMonth(nuevaFechaFin.getMonth() + despues.mesesRestantes);

  await supabase
    .from("deudas")
    .update({
      capital_pendiente: nuevoCapital,
      cuota: cuotaNueva,
      fecha_fin: nuevaFechaFin.toISOString().slice(0, 10),
    })
    .eq("id", deudaId);

  await supabase
    .from("amortizaciones_extra")
    .update({ aplicado: true, aplicado_en: new Date().toISOString() })
    .eq("id", filaId);
}

export async function registrarAmortizacionExtra(formData: FormData) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const deuda_id = formData.get("deuda_id") as string;
  const fecha = formData.get("fecha") as string;
  const importe = Number(formData.get("importe") ?? 0);
  const tipo_reduccion = formData.get("tipo_reduccion") as TipoReduccion;
  const recurrencia = (formData.get("recurrencia") as Recurrencia) || "puntual";

  const hoy = new Date().toISOString().slice(0, 10);

  const { data: fila, error } = await supabase
    .from("amortizaciones_extra")
    .insert({
      usuario_id: user.id,
      deuda_id,
      fecha,
      importe,
      tipo_reduccion,
      recurrencia,
      aplicado: false,
    })
    .select("id")
    .single();

  if (!error && fila && fecha <= hoy) {
    await aplicarFilaAmortizacion(supabase, fila.id, deuda_id, importe, tipo_reduccion);
  }

  revalidatePath(`/deudas/${deuda_id}`);
  revalidatePath("/deudas");
  revalidatePath("/dashboard");
}

export async function marcarAmortizacionAplicada(formData: FormData) {
  const supabase = createClient();
  const id = formData.get("id") as string;
  const deuda_id = formData.get("deuda_id") as string;
  const importe = Number(formData.get("importe"));
  const tipo_reduccion = formData.get("tipo_reduccion") as TipoReduccion;

  await aplicarFilaAmortizacion(supabase, id, deuda_id, importe, tipo_reduccion);

  revalidatePath(`/deudas/${deuda_id}`);
  revalidatePath("/deudas");
  revalidatePath("/dashboard");
}

export async function eliminarAmortizacionExtra(formData: FormData) {
  const supabase = createClient();
  const id = formData.get("id") as string;
  const deuda_id = formData.get("deuda_id") as string;

  await supabase.from("amortizaciones_extra").delete().eq("id", id);

  revalidatePath(`/deudas/${deuda_id}`);
}
