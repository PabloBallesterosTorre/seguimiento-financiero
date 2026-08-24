import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { crearCuenta, actualizarCuenta, eliminarCuenta } from "./actions";
import { CuentasClient } from "./CuentasClient";

export default async function CuentasPage() {
  const supabase = createClient();
  const { data: cuentas } = await supabase
    .from("cuentas")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <h1 className="text-xl font-semibold">Cuentas</h1>

        <CuentasClient
          cuentas={cuentas ?? []}
          crearCuenta={crearCuenta}
          actualizarCuenta={actualizarCuenta}
          eliminarCuenta={eliminarCuenta}
        />
      </main>
    </>
  );
}
