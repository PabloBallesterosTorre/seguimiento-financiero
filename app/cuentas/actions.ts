"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reconstruirSaldo } from "@/lib/saldos";

// Datos descriptivos de la cuenta. Deliberadamente NO incluye el saldo: editar una
// cuenta (para corregir el nombre, añadir el IBAN o marcarla como remunerada) no debe
// poder reescribir su saldo. Antes sí lo hacía, y bastaba con que el campo del
// formulario llevara un valor distinto al real para desacoplar el saldo de sus
// movimientos de forma silenciosa y permanente. El saldo solo se fija al crear la
// cuenta (saldo inicial) y se reconstruye con `recalcularSaldoCuenta`.
function leerCamposCuenta(formData: FormData) {
  const es_remunerada = formData.get("es_remunerada") === "on";
  const tipoInteresRaw = formData.get("tipo_interes") as string;
  const periodicidadRaw = formData.get("periodicidad_pago_interes") as string;

  const ibanRaw = formData.get("iban") as string;

  return {
    banco_nombre: formData.get("banco") as string,
    nombre: formData.get("nombre") as string,
    tipo: formData.get("tipo") as string,
    iban: ibanRaw ? ibanRaw.replace(/\s+/g, "").toUpperCase() : null,
    es_remunerada,
    tipo_interes: es_remunerada && tipoInteresRaw ? Number(tipoInteresRaw) : null,
    periodicidad_pago_interes: es_remunerada && periodicidadRaw ? periodicidadRaw : null,
  };
}

export async function crearCuenta(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // El saldo tecleado al dar de alta la cuenta es su saldo ANTES del primer movimiento
  // que se registre: se guarda en las dos columnas porque, sin movimientos todavía,
  // ambos coinciden. A partir de ahí `saldo_inicial` queda fijo y solo `saldo_actual`
  // se mueve, lo que permite comprobar en cualquier momento que uno se deduce del otro.
  const saldoInicial = Number(formData.get("saldo_actual") ?? 0);

  await supabase
    .from("cuentas")
    .insert({
      usuario_id: user.id,
      ...leerCamposCuenta(formData),
      saldo_inicial: saldoInicial,
      saldo_actual: saldoInicial,
      moneda: "EUR",
      activa: true,
    })
    .throwOnError();

  revalidatePath("/cuentas");
  revalidatePath("/home");
}

export async function actualizarCuenta(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  await supabase.from("cuentas").update(leerCamposCuenta(formData)).eq("id", id).throwOnError();

  revalidatePath("/cuentas");
  revalidatePath("/home");
}

// Reconstruye el saldo de una cuenta a partir de su saldo inicial más todos sus
// movimientos, que es la única fuente de verdad verificable. Repara el desfase que
// deja cualquier operación que se quedó a medias sin tener que tocar la base de datos a
// mano. La importación ya no puede provocarlo (es atómica desde la migración 0020), pero
// sigue siendo la reparación para un descuadre heredado o para cualquier escritura suelta
// que falle a mitad.
export async function recalcularSaldoCuenta(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;
  if (!id) return;

  await reconstruirSaldo(supabase, id);

  revalidatePath("/cuentas");
  revalidatePath("/home");
  revalidatePath("/informes");
  revalidatePath("/planificador");
}

export async function eliminarCuenta(formData: FormData) {
  const supabase = await createClient();
  const id = formData.get("id") as string;

  await supabase.from("cuentas").delete().eq("id", id).throwOnError();

  revalidatePath("/cuentas");
  revalidatePath("/home");
}
