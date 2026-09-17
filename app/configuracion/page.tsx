import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { obtenerConfiguracion, obtenerOpcionesMesFinanciero } from "@/lib/configuracion";
import { descripcionMes } from "@/lib/mesFinanciero";
import { guardarConfiguracionGeneral, guardarObjetivoAhorroGlobal, guardarMesFinanciero } from "./actions";
import { ConfiguracionTabs } from "./ConfiguracionTabs";

export default async function ConfiguracionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const config = user ? await obtenerConfiguracion(supabase, user.id) : null;

  const { data: categoriasRaw } = await supabase
    .from("categorias")
    .select("id, nombre")
    .order("nombre");

  // Vista previa de las fronteras reales de los últimos meses. Es lo que convierte el
  // ajuste en algo comprobable: en vez de prometer que "el mes empieza con la nómina",
  // enseña las fechas concretas que han salido de los movimientos del usuario.
  const opcionesMes = config
    ? await obtenerOpcionesMesFinanciero(supabase, config)
    : { activo: false, diaCorte: 25, anclas: [] };
  const hoy = new Date();
  const vistaPreviaMeses = [3, 2, 1, 0].map((atras) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - atras, 1);
    const nombre = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(d);
    return {
      nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1),
      rango: descripcionMes(d.getFullYear(), d.getMonth() + 1, opcionesMes),
    };
  });

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-10">
        <h1 className="font-sora text-[26px] font-bold text-ink">Configuración de perfil</h1>

        <ConfiguracionTabs
          email={user?.email ?? ""}
          nombre={config?.nombre ?? null}
          monedaBase={config?.moneda_base ?? "EUR"}
          idioma={config?.idioma ?? "es"}
          objetivoAhorroMensual={config?.objetivo_ahorro_mensual ?? null}
          incluirInversionEnAhorro={config?.incluir_inversion_en_ahorro ?? true}
          mesFinanciero={config?.mes_financiero ?? false}
          diaCorteMes={config?.dia_corte_mes ?? 25}
          categoriaInicioMes={config?.categoria_inicio_mes ?? null}
          categorias={categoriasRaw ?? []}
          vistaPreviaMeses={vistaPreviaMeses}
          guardarConfiguracionGeneral={guardarConfiguracionGeneral}
          guardarObjetivoAhorroGlobal={guardarObjetivoAhorroGlobal}
          guardarMesFinanciero={guardarMesFinanciero}
        />
      </main>
    </>
  );
}
