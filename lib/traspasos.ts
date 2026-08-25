import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = ReturnType<typeof createClient>;

// Registra un traspaso entre dos cuentas propias como dos movimientos enlazados
// (uno por cuenta, con el signo correcto para cada una) y actualiza ambos saldos.
export async function registrarTraspaso(
  supabase: SupabaseServerClient,
  usuarioId: string,
  params: {
    cuentaOrigenId: string;
    cuentaDestinoId: string;
    fecha: string;
    importe: number;
    descripcionOrigen: string;
    descripcionDestino: string;
    origenMovimiento: "manual" | "importado";
  }
) {
  const {
    cuentaOrigenId,
    cuentaDestinoId,
    fecha,
    importe,
    descripcionOrigen,
    descripcionDestino,
    origenMovimiento,
  } = params;

  const traspaso_grupo_id = crypto.randomUUID();

  await supabase.from("movimientos").insert([
    {
      usuario_id: usuarioId,
      cuenta_id: cuentaOrigenId,
      fecha,
      descripcion: descripcionOrigen,
      importe: -importe,
      tipo: "traspaso",
      origen: origenMovimiento,
      moneda: "EUR",
      traspaso_grupo_id,
    },
    {
      usuario_id: usuarioId,
      cuenta_id: cuentaDestinoId,
      fecha,
      descripcion: descripcionDestino,
      importe,
      tipo: "traspaso",
      origen: origenMovimiento,
      moneda: "EUR",
      traspaso_grupo_id,
    },
  ]);

  const [{ data: origen }, { data: destino }] = await Promise.all([
    supabase.from("cuentas").select("saldo_actual").eq("id", cuentaOrigenId).single(),
    supabase.from("cuentas").select("saldo_actual").eq("id", cuentaDestinoId).single(),
  ]);

  if (origen) {
    await supabase
      .from("cuentas")
      .update({ saldo_actual: Number(origen.saldo_actual) - importe })
      .eq("id", cuentaOrigenId);
  }
  if (destino) {
    await supabase
      .from("cuentas")
      .update({ saldo_actual: Number(destino.saldo_actual) + importe })
      .eq("id", cuentaDestinoId);
  }
}
