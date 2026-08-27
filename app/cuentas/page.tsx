import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { obtenerOrdenTabla } from "@/lib/ordenTabla";
import { crearCuenta, actualizarCuenta, eliminarCuenta } from "./actions";
import { CuentasClient } from "./CuentasClient";

export default async function CuentasPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: cuentas }, config, ordenInicial] = await Promise.all([
    supabase.from("cuentas").select("*").order("created_at", { ascending: true }),
    user ? obtenerConfiguracion(supabase, user.id) : null,
    user ? obtenerOrdenTabla(supabase, user.id, "cuentas") : null,
  ]);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-10">
        <h1 className="font-sora text-[26px] font-bold text-ink">Cuentas</h1>

        <CuentasClient
          cuentas={cuentas ?? []}
          moneda={config?.moneda_base ?? "EUR"}
          crearCuenta={crearCuenta}
          actualizarCuenta={actualizarCuenta}
          eliminarCuenta={eliminarCuenta}
          ordenInicial={ordenInicial}
        />
      </main>
    </>
  );
}
