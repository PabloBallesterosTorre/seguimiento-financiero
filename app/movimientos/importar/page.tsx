import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { ImportarCSV } from "./ImportarCSV";
import { ordenarCategoriasJerarquia } from "@/lib/categorias";
import { obtenerConfiguracion, obtenerOpcionesMesFinanciero } from "@/lib/configuracion";
import type { MovimientoPrevisto } from "@/lib/prevision";

export default async function ImportarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: cuentas },
    { data: categorias },
    { data: reglas },
    { data: existentes },
    { data: previstos },
    { data: inversiones },
    config,
  ] = await Promise.all([
      supabase.from("cuentas").select("id, nombre, banco_nombre, iban").eq("activa", true).order("nombre"),
      supabase.from("categorias").select("id, nombre, categoria_padre_id").order("nombre"),
      supabase.from("reglas_categorizacion").select("patron_descripcion, categoria_id, veces_usada"),
      supabase.from("movimientos").select("cuenta_id, fecha, importe, descripcion"),
      supabase.from("movimientos_previstos").select("*").eq("estado", "activo").in("tipo", ["ingreso", "gasto"]),
      supabase.from("inversiones").select("id, nombre, isin"),
      user ? obtenerConfiguracion(supabase, user.id) : null,
    ]);

  // Se pasan al cliente para poder emparejar cada movimiento con sus previsiones usando el
  // mes financiero: la nómina cobrada el 28 de agosto es la de septiembre, y contra agosto
  // natural no encontraba su previsión.
  const opcionesMes = config
    ? await obtenerOpcionesMesFinanciero(supabase, config)
    : { activo: false, diaCorte: 25, anclas: [] };

  const categoriasOrdenadas = ordenarCategoriasJerarquia(categorias ?? []);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <h1 className="font-sora text-[26px] font-bold text-ink">Importar movimientos</h1>
          <Link href="/movimientos" className="text-sm font-semibold text-ink-tertiary hover:text-ink">
            ← Volver a movimientos
          </Link>
        </div>

        {(cuentas ?? []).length === 0 ? (
          <p className="text-sm text-ink-tertiary">
            Antes de importar, da de alta una cuenta en la sección Cuentas.
          </p>
        ) : (
          <ImportarCSV
            cuentas={cuentas ?? []}
            categorias={categoriasOrdenadas}
            reglas={reglas ?? []}
            existentes={existentes ?? []}
            previstos={(previstos ?? []) as unknown as MovimientoPrevisto[]}
            inversiones={inversiones ?? []}
            moneda={config?.moneda_base ?? "EUR"}
            opcionesMes={{ ...opcionesMes, anclas: [...opcionesMes.anclas] }}
          />
        )}
      </main>
    </>
  );
}
