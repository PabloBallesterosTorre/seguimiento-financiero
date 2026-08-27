"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sugerirCategoria } from "@/lib/categorizacion";
import { reforzarRegla } from "@/lib/reglas";
import { registrarTraspaso } from "@/lib/traspasos";

export async function actualizarCategoriaMovimiento(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const id = formData.get("id") as string;
  const descripcion = formData.get("descripcion") as string;
  const categoria_id = (formData.get("categoria_id") as string) || null;

  await supabase.from("movimientos").update({ categoria_id }).eq("id", id).throwOnError();

  // El aprendizaje de la regla es una mejora, no parte del contrato de este cambio:
  // la categoría del movimiento ya se ha guardado arriba, así que un fallo aquí se
  // registra pero no debe convertirse en una pantalla de error para algo que sí
  // funcionó.
  if (categoria_id) {
    try {
      await reforzarRegla(supabase, user.id, descripcion, categoria_id);
    } catch (e) {
      console.error("actualizarCategoriaMovimiento: reforzarRegla", e);
    }
  }

  revalidatePath("/movimientos");
}

export async function crearMovimiento(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const cuenta_id = formData.get("cuenta_id") as string;
  const fecha = formData.get("fecha") as string;
  const descripcion = formData.get("descripcion") as string;
  const tipo = formData.get("tipo") as string;
  const importeInput = Number(formData.get("importe") ?? 0);
  const importe = tipo === "gasto" ? -Math.abs(importeInput) : Math.abs(importeInput);

  let categoria_id = (formData.get("categoria_id") as string) || null;

  const { data: reglas } = await supabase
    .from("reglas_categorizacion")
    .select("patron_descripcion, categoria_id, veces_usada")
    .eq("usuario_id", user.id);

  if (!categoria_id) {
    categoria_id = sugerirCategoria(descripcion, reglas ?? []);
  }

  await supabase
    .from("movimientos")
    .insert({
      usuario_id: user.id,
      cuenta_id,
      fecha,
      descripcion,
      importe,
      tipo,
      categoria_id,
      origen: "manual",
      moneda: "EUR",
    })
    .throwOnError();

  // .throwOnError() aquí es importante: el movimiento de arriba ya se ha insertado,
  // así que si esta lectura fallara y se dejara pasar en silencio, el saldo de la
  // cuenta se quedaría desincronizado de sus movimientos sin ningún aviso.
  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("saldo_actual")
    .eq("id", cuenta_id)
    .single()
    .throwOnError();

  await supabase
    .from("cuentas")
    .update({ saldo_actual: Number(cuenta.saldo_actual) + importe })
    .eq("id", cuenta_id)
    .throwOnError();

  // El aprendizaje de la regla es una mejora, no parte del contrato de esta alta: el
  // movimiento y el saldo ya se han guardado arriba, así que un fallo aquí se
  // registra pero no debe convertirse en una pantalla de error para algo que sí
  // funcionó.
  if (categoria_id) {
    try {
      await reforzarRegla(supabase, user.id, descripcion, categoria_id);
    } catch (e) {
      console.error("crearMovimiento: reforzarRegla", e);
    }
  }

  revalidatePath("/movimientos");
  revalidatePath("/cuentas");
  revalidatePath("/home");
}

export async function crearTraspaso(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const cuenta_origen_id = formData.get("cuenta_origen_id") as string;
  const cuenta_destino_id = formData.get("cuenta_destino_id") as string;
  const fecha = formData.get("fecha") as string;
  const importe = Math.abs(Number(formData.get("importe") ?? 0));
  const descripcionInput = (formData.get("descripcion") as string) || "";

  if (!cuenta_origen_id || !cuenta_destino_id || cuenta_origen_id === cuenta_destino_id || importe <= 0) {
    return;
  }

  const [{ data: origen }, { data: destino }] = await Promise.all([
    supabase.from("cuentas").select("saldo_actual, nombre").eq("id", cuenta_origen_id).single().throwOnError(),
    supabase.from("cuentas").select("saldo_actual, nombre").eq("id", cuenta_destino_id).single().throwOnError(),
  ]);

  await registrarTraspaso(supabase, user.id, {
    cuentaOrigenId: cuenta_origen_id,
    cuentaDestinoId: cuenta_destino_id,
    fecha,
    importe,
    descripcionOrigen: descripcionInput || `Traspaso a ${destino.nombre}`,
    descripcionDestino: descripcionInput || `Traspaso desde ${origen.nombre}`,
    origenMovimiento: "manual",
  });

  revalidatePath("/movimientos");
  revalidatePath("/cuentas");
  revalidatePath("/home");
}

export async function vincularComoTraspaso(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const movimiento_id = formData.get("movimiento_id") as string;
  const movimiento_contraparte_id = formData.get("movimiento_contraparte_id") as string;

  if (!movimiento_id || !movimiento_contraparte_id || movimiento_id === movimiento_contraparte_id) return;

  const { data: filas } = await supabase
    .from("movimientos")
    .select("id, cuenta_id, tipo")
    .in("id", [movimiento_id, movimiento_contraparte_id]);

  if (!filas || filas.length !== 2) return;
  if (filas.some((f) => f.tipo === "traspaso")) return;
  if (filas[0].cuenta_id === filas[1].cuenta_id) return;

  // Ambos movimientos ya existían y ya estaban sumados a sus saldos respectivos:
  // vincularlos como traspaso solo cambia su tipo/categoría, nunca los saldos.
  const traspaso_grupo_id = crypto.randomUUID();

  await Promise.all(
    filas.map((f) =>
      supabase
        .from("movimientos")
        .update({ tipo: "traspaso", categoria_id: null, traspaso_grupo_id, tipo_original: f.tipo })
        .eq("id", f.id)
        .throwOnError()
    )
  );

  revalidatePath("/movimientos");
  revalidatePath("/home");
}

export async function eliminarTraspaso(formData: FormData) {
  const supabase = await createClient();
  const traspaso_grupo_id = formData.get("traspaso_grupo_id") as string;

  const { data: filas } = await supabase
    .from("movimientos")
    .select("id, cuenta_id, importe, tipo_original")
    .eq("traspaso_grupo_id", traspaso_grupo_id);

  if (!filas || filas.length === 0) return;

  // Si viene de vincular dos movimientos ya existentes, no se tocó ningún saldo al
  // crearlo (tipo_original queda guardado) — desvincular tampoco debe tocarlo, solo
  // devuelve cada fila a su tipo original. Si es un traspaso creado de cero (el botón
  // "Nuevo traspaso"), sí hay que borrar las filas y revertir el saldo que se sumó.
  const esVinculado = filas.every((f) => f.tipo_original !== null);

  if (esVinculado) {
    await Promise.all(
      filas.map((f) =>
        supabase
          .from("movimientos")
          .update({ tipo: f.tipo_original, tipo_original: null, traspaso_grupo_id: null })
          .eq("id", f.id)
          .throwOnError()
      )
    );
  } else {
    await supabase.from("movimientos").delete().eq("traspaso_grupo_id", traspaso_grupo_id).throwOnError();

    for (const fila of filas) {
      // .throwOnError() aquí es importante: los movimientos ya se han borrado arriba,
      // así que un fallo silencioso en esta lectura dejaría el saldo de la cuenta sin
      // revertir, desincronizado de sus movimientos reales.
      const { data: cuenta } = await supabase
        .from("cuentas")
        .select("saldo_actual")
        .eq("id", fila.cuenta_id)
        .single()
        .throwOnError();

      await supabase
        .from("cuentas")
        .update({ saldo_actual: Number(cuenta.saldo_actual) - Number(fila.importe) })
        .eq("id", fila.cuenta_id)
        .throwOnError();
    }
  }

  revalidatePath("/movimientos");
  revalidatePath("/cuentas");
  revalidatePath("/home");
}

export async function eliminarMovimiento(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  // Se lee el movimiento (con throwOnError) ANTES de borrarlo: si esta lectura
  // fallara, abortar aquí es mejor que borrar el movimiento y dejar el saldo de la
  // cuenta sin revertir en silencio.
  const { data: movimiento } = await supabase
    .from("movimientos")
    .select("cuenta_id, importe")
    .eq("id", id)
    .single()
    .throwOnError();

  await supabase.from("movimientos").delete().eq("id", id).throwOnError();

  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("saldo_actual")
    .eq("id", movimiento.cuenta_id)
    .single()
    .throwOnError();

  await supabase
    .from("cuentas")
    .update({ saldo_actual: Number(cuenta.saldo_actual) - Number(movimiento.importe) })
    .eq("id", movimiento.cuenta_id)
    .throwOnError();

  revalidatePath("/movimientos");
  revalidatePath("/cuentas");
  revalidatePath("/home");
}
