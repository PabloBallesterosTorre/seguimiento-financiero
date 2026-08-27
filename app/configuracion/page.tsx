import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { guardarConfiguracionGeneral, guardarObjetivoAhorroGlobal } from "./actions";
import { ConfiguracionTabs } from "./ConfiguracionTabs";

export default async function ConfiguracionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const config = user ? await obtenerConfiguracion(supabase, user.id) : null;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-10">
        <h1 className="font-sora text-[26px] font-bold text-ink">Configuración de perfil</h1>

        <ConfiguracionTabs
          email={user?.email ?? ""}
          nombre={config?.nombre ?? null}
          monedaBase={config?.moneda_base ?? "EUR"}
          idioma={config?.idioma ?? "es"}
          objetivoAhorroMensual={config?.objetivo_ahorro_mensual ?? null}
          incluirInversionEnAhorro={config?.incluir_inversion_en_ahorro ?? true}
          guardarConfiguracionGeneral={guardarConfiguracionGeneral}
          guardarObjetivoAhorroGlobal={guardarObjetivoAhorroGlobal}
        />
      </main>
    </>
  );
}
