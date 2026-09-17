"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// El ISIN es la clave con la que una fila importada encuentra su posición, así que se
// guarda siempre normalizado (sin espacios y en mayúsculas). Vacío se guarda como null,
// no como cadena vacía: el índice único es parcial sobre "isin is not null", y varias
// inversiones sin ISIN tienen que poder convivir.
function normalizarIsin(valor: FormDataEntryValue | null): string | null {
  const texto = ((valor as string) ?? "").replace(/\s+/g, "").toUpperCase();
  return texto === "" ? null : texto;
}

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
  const isin = normalizarIsin(formData.get("isin"));
  const cuenta_id = (formData.get("cuenta_id") as string) || null;
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
      isin,
      cuenta_id,
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
  const isin = normalizarIsin(formData.get("isin"));
  const cuenta_id = (formData.get("cuenta_id") as string) || null;

  await supabase
    .from("inversiones")
    .update({ tipo_activo, nombre, es_recurrente, movimiento_previsto_id, rentabilidad_anual_asumida, isin, cuenta_id })
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

// ============================================================================
// Libro de operaciones (tanda 10)
// ============================================================================

function numeroOpcional(valor: FormDataEntryValue | null): number | null {
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

// Tras tocar el libro de una inversión hay que reconstruir sus campos cacheados
// (participaciones, coste_neto, valor_actual). Se hace en la base de datos, con la misma
// función que usa la importación, para que el criterio sea uno solo: reconstruir desde
// las operaciones en vez de ir sumando, igual que el saldo de las cuentas.
async function refrescarInversion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  inversionId: string,
  revalorizar?: { fecha: string; precio: number | null }
) {
  // Si la operación traía precio, ese precio vale para toda la posición a esa fecha, no
  // solo para lo comprado: queda como punto real de valor (salvo que ese día ya tenga
  // una valoración manual, que siempre gana).
  if (revalorizar && revalorizar.precio !== null && revalorizar.precio > 0) {
    await supabase.rpc("revalorizar_inversion", {
      p_inversion_id: inversionId,
      p_fecha: revalorizar.fecha,
      p_precio: revalorizar.precio,
    });
  }

  await supabase.rpc("recalcular_inversion", { p_inversion_id: inversionId }).throwOnError();

  revalidatePath("/inversiones");
  revalidatePath(`/inversiones/${inversionId}`);
  revalidatePath("/home");
  revalidatePath("/informes");
  revalidatePath("/planificador");
}

// Alta manual de una operación, para lo que no llega por extracto: una posición
// custodiada fuera de la app, un dividendo, un traspaso entre fondos, o simplemente
// completar el histórico anterior a lo que cubren los extractos.
export async function registrarOperacion(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const inversion_id = formData.get("inversion_id") as string;
  const fecha = formData.get("fecha") as string;
  const tipo = formData.get("tipo") as string;
  const importeBruto = Math.abs(Number(formData.get("importe") ?? 0));
  const participacionesBrutas = numeroOpcional(formData.get("participaciones"));
  const precio = numeroOpcional(formData.get("precio"));
  const comision = numeroOpcional(formData.get("comision")) ?? 0;
  const nota = ((formData.get("nota") as string) ?? "").trim() || null;

  // El formulario pide importes en positivo y el signo lo pone el tipo de operación:
  // pedirle al usuario que teclee un negativo para una venta es una fuente de errores
  // gratuita. Compra y aportación meten dinero en la inversión; venta, retirada y
  // dividendo lo sacan.
  const sacaDinero = tipo === "venta" || tipo === "retirada" || tipo === "dividendo";
  const importe = sacaDinero ? -importeBruto : importeBruto;
  const participaciones =
    participacionesBrutas === null ? null : sacaDinero ? -Math.abs(participacionesBrutas) : Math.abs(participacionesBrutas);

  await supabase
    .from("inversion_operaciones")
    .insert({
      usuario_id: user.id,
      inversion_id,
      fecha,
      tipo,
      importe,
      participaciones,
      precio,
      comision,
      nota,
      origen: "manual",
    })
    .throwOnError();

  await refrescarInversion(supabase, inversion_id, { fecha, precio });
}

export async function eliminarOperacion(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const inversion_id = formData.get("inversion_id") as string;

  await supabase.from("inversion_operaciones").delete().eq("id", id).throwOnError();

  // No se borra la valoración que aquella operación pudiera haber generado: es un dato
  // de mercado observado, sigue siendo cierto aunque la operación se anule.
  await refrescarInversion(supabase, inversion_id);
}

// Vincula un movimiento ya importado con una inversión. Es la vía manual para los bancos
// cuyo extracto no trae ISIN ni participaciones (Revolut, Ibercaja): el movimiento ya
// está registrado, aquí solo se declara qué se compró con él.
export async function asignarMovimientoAInversion(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const movimiento_id = formData.get("movimiento_id") as string;
  const inversion_id = formData.get("inversion_id") as string;
  if (!inversion_id) return;

  const participaciones = numeroOpcional(formData.get("participaciones"));
  const precio = numeroOpcional(formData.get("precio"));

  const { data: movimiento } = await supabase
    .from("movimientos")
    .select("fecha, importe")
    .eq("id", movimiento_id)
    .single()
    .throwOnError();

  // Mismo criterio de signo que la importación: el extracto mira desde la cuenta, la
  // operación desde la inversión, así que el importe va cambiado de signo.
  const importe = -Number(movimiento.importe);
  const entra = importe > 0;

  await supabase
    .from("inversion_operaciones")
    .insert({
      usuario_id: user.id,
      inversion_id,
      fecha: movimiento.fecha,
      tipo: participaciones !== null ? (entra ? "compra" : "venta") : entra ? "aportacion" : "retirada",
      importe,
      participaciones: participaciones === null ? null : entra ? Math.abs(participaciones) : -Math.abs(participaciones),
      precio,
      movimiento_id,
      origen: "manual",
    })
    .throwOnError();

  await refrescarInversion(supabase, inversion_id, { fecha: movimiento.fecha, precio });
  revalidatePath("/movimientos");
}
