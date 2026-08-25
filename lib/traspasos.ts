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

export type MovimientoParaEmparejar = {
  id: string;
  cuenta_id: string | null;
  fecha: string;
  importe: number;
  tipo: string;
  descripcion: string;
  cuentas: { nombre: string; banco_nombre: string } | null;
};

export type CandidatoTraspaso = {
  id: string;
  fecha: string;
  descripcion: string;
  importe: number;
  cuenta: { nombre: string; banco_nombre: string } | null;
};

// Cuando dos cuentas propias están ambas en la app, un traspaso entre ellas ya
// aparece como dos movimientos independientes (uno por extracto bancario) en cuanto
// se importan ambas cuentas. Aquí no se crea nada nuevo: se buscan, para un
// movimiento dado, los candidatos ya existentes en OTRA cuenta con signo opuesto,
// mismo importe (en valor absoluto) y fecha cercana, para poder enlazarlos.
export function encontrarCandidatosTraspaso(
  actual: MovimientoParaEmparejar,
  todos: MovimientoParaEmparejar[],
  ventanaDias = 3
): CandidatoTraspaso[] {
  const fechaActual = new Date(actual.fecha).getTime();
  const ventanaMs = ventanaDias * 24 * 60 * 60 * 1000;
  const signoActual = Math.sign(Number(actual.importe));

  return todos
    .filter((m) => m.id !== actual.id)
    .filter((m) => m.tipo !== "traspaso")
    .filter((m) => m.cuenta_id !== actual.cuenta_id)
    .filter((m) => Math.sign(Number(m.importe)) === -signoActual)
    .filter((m) => Math.abs(Math.abs(Number(m.importe)) - Math.abs(Number(actual.importe))) < 0.01)
    .filter((m) => Math.abs(new Date(m.fecha).getTime() - fechaActual) <= ventanaMs)
    .map((m) => ({ id: m.id, fecha: m.fecha, descripcion: m.descripcion, importe: Number(m.importe), cuenta: m.cuentas }));
}
