"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reforzarRegla } from "@/lib/reglas";
import { registrarTraspaso } from "@/lib/traspasos";

export type FilaImportar = {
  fecha: string;
  descripcion: string;
  importe: number;
  tipo: "ingreso" | "gasto";
  categoria_id: string | null;
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

  const { error } = await supabase.from("movimientos").insert(
    filas.map((fila) => ({
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

  const totalImporte = filas.reduce((suma, fila) => suma + fila.importe, 0);

  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("saldo_actual")
    .eq("id", cuenta_id)
    .single();

  if (cuenta) {
    await supabase
      .from("cuentas")
      .update({ saldo_actual: Number(cuenta.saldo_actual) + totalImporte })
      .eq("id", cuenta_id);
  }

  for (const fila of filas) {
    if (fila.categoria_id) {
      await reforzarRegla(supabase, user.id, fila.descripcion, fila.categoria_id);
    }
  }

  revalidatePath("/movimientos");
  revalidatePath("/cuentas");
  revalidatePath("/dashboard");

  return { ok: true as const, importados: filas.length };
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
  revalidatePath("/dashboard");

  return { ok: true as const, importados: filas.length };
}
