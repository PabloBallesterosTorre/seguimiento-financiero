"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reforzarRegla } from "@/lib/reglas";

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
  categoria_id: string | null;
  cuentaContraparteId: string;
};

export async function importarMovimientos(cuenta_id: string, filas: FilaImportar[]) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "No autenticado." };
  if (filas.length === 0) return { ok: false as const, error: "No hay filas que importar." };

  // Toda la importación ocurre dentro de una única función de Postgres (migración 0020),
  // que se ejecuta en una sola transacción: o entran todos los movimientos, sus
  // conciliaciones y el saldo, o no entra nada. Antes eran escrituras sueltas desde aquí y
  // un fallo a mitad dejaba movimientos insertados con el saldo sin actualizar.
  const { data, error } = await supabase.rpc("importar_movimientos", {
    p_cuenta_id: cuenta_id,
    p_filas: filas.map((fila) => ({
      fecha: fila.fecha,
      descripcion: fila.descripcion,
      importe: fila.importe,
      tipo: fila.tipo,
      categoria_id: fila.categoria_id,
      previsto_id: fila.previstoId ?? null,
    })),
  });

  if (error) {
    console.error("importarMovimientos", error);
    return { ok: false as const, error: error.message };
  }

  const resultado = data as { importados: number; conciliados: number; saldo: number };

  // El aprendizaje de reglas es una mejora, no parte del contrato de la importación: los
  // movimientos ya se han guardado de forma atómica arriba, así que un fallo aquí se
  // registra pero no debe convertir una importación que sí funcionó en un {ok:false}
  // engañoso. Se deja fuera de la transacción justo por eso.
  for (const fila of filas) {
    if (fila.categoria_id) {
      try {
        await reforzarRegla(supabase, user.id, fila.descripcion, fila.categoria_id);
      } catch (e) {
        console.error("importarMovimientos: reforzarRegla", e);
      }
    }
  }

  revalidatePath("/movimientos");
  revalidatePath("/cuentas");
  revalidatePath("/home");
  if (resultado.conciliados > 0) {
    revalidatePath("/prevision");
    revalidatePath("/prevision/previstos");
  }

  return { ok: true as const, importados: resultado.importados, conciliados: resultado.conciliados };
}

export async function importarTraspasos(cuentaId: string, filas: FilaTraspasoImportar[]) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "No autenticado." };
  if (filas.length === 0) return { ok: false as const, error: "No hay traspasos que importar." };

  // Igual que arriba: las dos filas de cada traspaso y los saldos de ambas cuentas entran
  // en una sola transacción, para que nunca quede medio traspaso registrado.
  const { data, error } = await supabase.rpc("importar_traspasos", {
    p_cuenta_id: cuentaId,
    p_filas: filas.map((fila) => ({
      fecha: fila.fecha,
      descripcion: fila.descripcion,
      importe: fila.importe,
      categoria_id: fila.categoria_id,
      cuenta_contraparte_id: fila.cuentaContraparteId,
    })),
  });

  if (error) {
    console.error("importarTraspasos", error);
    return { ok: false as const, error: error.message };
  }

  revalidatePath("/movimientos");
  revalidatePath("/cuentas");
  revalidatePath("/home");

  return { ok: true as const, importados: (data as { importados: number }).importados };
}
