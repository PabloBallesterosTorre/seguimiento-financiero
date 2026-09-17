import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { obtenerOrdenTabla } from "@/lib/ordenTabla";
import {
  crearCuenta,
  actualizarCuenta,
  eliminarCuenta,
  recalcularSaldoCuenta,
  alternarExclusionInformes,
} from "./actions";
import { CuentasClient } from "./CuentasClient";
import { diagnosticarSaldos } from "@/lib/saldos";

export default async function CuentasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: cuentas }, config, ordenInicial, { data: movimientos }] = await Promise.all([
    supabase.from("cuentas").select("*").order("created_at", { ascending: true }),
    user ? obtenerConfiguracion(supabase, user.id) : null,
    user ? obtenerOrdenTabla(supabase, user.id, "cuentas") : null,
    supabase.from("movimientos").select("cuenta_id, importe"),
  ]);

  // El saldo guardado debería ser siempre saldo_inicial + suma de movimientos. Se
  // comprueba en cada carga de esta pantalla para que un descuadre se vea en cuanto
  // aparece, en vez de propagarse en silencio al patrimonio y a los informes.
  const desfases = diagnosticarSaldos(
    (cuentas ?? []).map((c) => ({
      id: c.id,
      saldo_actual: Number(c.saldo_actual),
      saldo_inicial: Number(c.saldo_inicial ?? 0),
    })),
    (movimientos ?? []).map((m) => ({ cuenta_id: m.cuenta_id, importe: Number(m.importe) }))
  );

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-10">
        <h1 className="font-sora text-[26px] font-bold text-ink">Cuentas</h1>

        <CuentasClient
          cuentas={cuentas ?? []}
          moneda={config?.moneda_base ?? "EUR"}
          crearCuenta={crearCuenta}
          actualizarCuenta={actualizarCuenta}
          eliminarCuenta={eliminarCuenta}
          recalcularSaldoCuenta={recalcularSaldoCuenta}
          alternarExclusionInformes={alternarExclusionInformes}
          cuentasExcluidas={config?.cuentas_excluidas_informes ?? []}
          desfases={Object.fromEntries(desfases)}
          ordenInicial={ordenInicial}
        />
      </main>
    </>
  );
}
