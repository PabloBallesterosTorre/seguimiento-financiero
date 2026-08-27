import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { crearDeuda, eliminarDeuda } from "./actions";
import { NuevaDeuda } from "./NuevaDeuda";
import { DeudasClient } from "./DeudasClient";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { obtenerOrdenTabla } from "@/lib/ordenTabla";

export default async function DeudasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: deudas }, config, ordenInicial] = await Promise.all([
    supabase.from("deudas").select("*").order("created_at", { ascending: true }),
    user ? obtenerConfiguracion(supabase, user.id) : null,
    user ? obtenerOrdenTabla(supabase, user.id, "deudas") : null,
  ]);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-10">
        <h1 className="font-sora text-[26px] font-bold text-ink">Deuda</h1>

        <NuevaDeuda action={crearDeuda} />

        <DeudasClient
          deudas={deudas ?? []}
          moneda={config?.moneda_base ?? "EUR"}
          eliminarDeuda={eliminarDeuda}
          ordenInicial={ordenInicial}
        />
      </main>
    </>
  );
}
