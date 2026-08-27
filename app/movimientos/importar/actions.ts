"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reforzarRegla } from "@/lib/reglas";
import { registrarTraspaso } from "@/lib/traspasos";
import { calcularSaldoTrasImportar } from "@/lib/importarCsv";

export type FilaImportar = {
  fecha: string;
  descripcion: string;
  importe: number;
  tipo: "ingreso" | "gasto";
  categoria_id: string | null;
  previstoId?: string | null;
};

export type FilaTraspasoImportar = {
  fecha: string;
  descripcion: string;
  importe: number;
  cuentaContraparteId: string;
};

export async function importarMovimientos(cuenta_id: string, filas: FilaImportar[]) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "No autenticado." };
  if (filas.length === 0) return { ok: false as const, error: "No hay filas que importar." };

  // Las filas sin previsión que conciliar se insertan en bloque (rápido). Las que sí
  // se van a conciliar se insertan una a una para poder recuperar su id real y
  // vincularlo al Movimiento previsto correspondiente, sin depender de que el orden
  // de un insert múltiple con RETURNING coincida con el de entrada.
  const filasConPrevisto = filas.filter((f) => f.previstoId);
  const filasSinPrevisto = filas.filter((f) => !f.previstoId);

  if (filasSinPrevisto.length > 0) {
    const { error } = await supabase.from("movimientos").insert(
      filasSinPrevisto.map((fila) => ({
        usuario_id: user.id,
        cuenta_id,
        fecha: fila.fecha,
        descripcion: fila.descripcion,
        importe: fila.importe,
        tipo: fila.tipo,
        categoria_id: fila.categoria_id,
        origen: "importado",
        moneda: "EUR",
      }))
    );

    if (error) return { ok: false as const, error: error.message };
  }

  for (const fila of filasConPrevisto) {
    const { data: insertado, error } = await supabase
      .from("movimientos")
      .insert({
        usuario_id: user.id,
        cuenta_id,
        fecha: fila.fecha,
        descripcion: fila.descripcion,
        importe: fila.importe,
        tipo: fila.tipo,
        categoria_id: fila.categoria_id,
        origen: "importado",
        moneda: "EUR",
      })
      .select("id")
      .single();

    if (error) return { ok: false as const, error: error.message };

    if (insertado) {
      const periodo = `${fila.fecha.slice(0, 7)}-01`;
      await supabase.from("previsto_conciliaciones").upsert(
        { usuario_id: user.id, previsto_id: fila.previstoId!, periodo, movimiento_real_id: insertado.id },
        { onConflict: "previsto_id,periodo" }
      );
    }
  }

  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("saldo_actual")
    .eq("id", cuenta_id)
    .single();

  if (cuenta) {
    await supabase
      .from("cuentas")
      .update({ saldo_actual: calcularSaldoTrasImportar(Number(cuenta.saldo_actual), filas) })
      .eq("id", cuenta_id);
  }

  for (const fila of filas) {
    if (fila.categoria_id) {
      await reforzarRegla(supabase, user.id, fila.descripcion, fila.categoria_id);
    }
  }

  revalidatePath("/movimientos");
  revalidatePath("/cuentas");
  revalidatePath("/home");
  if (filasConPrevisto.length > 0) {
    revalidatePath("/prevision");
    revalidatePath("/prevision/previstos");
  }

  return { ok: true as const, importados: filas.length, conciliados: filasConPrevisto.length };
}

export async function importarTraspasos(cuentaId: string, filas: FilaTraspasoImportar[]) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "No autenticado." };
  if (filas.length === 0) return { ok: false as const, error: "No hay traspasos que importar." };

  for (const fila of filas) {
    const importeAbsoluto = Math.abs(fila.importe);
    const esSalida = fila.importe < 0;

    await registrarTraspaso(supabase, user.id, {
      cuentaOrigenId: esSalida ? cuentaId : fila.cuentaContraparteId,
      cuentaDestinoId: esSalida ? fila.cuentaContraparteId : cuentaId,
      fecha: fila.fecha,
      importe: importeAbsoluto,
      descripcionOrigen: fila.descripcion,
      descripcionDestino: fila.descripcion,
      origenMovimiento: "importado",
    });
  }

  revalidatePath("/movimientos");
  revalidatePath("/cuentas");
  revalidatePath("/home");

  return { ok: true as const, importados: filas.length };
}
