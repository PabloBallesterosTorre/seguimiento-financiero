import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { ImportarCSV } from "./ImportarCSV";
import { ordenarCategoriasJerarquia } from "@/lib/categorias";

export default async function ImportarPage() {
  const supabase = createClient();

  const [{ data: cuentas }, { data: categorias }, { data: reglas }] = await Promise.all([
    supabase.from("cuentas").select("id, nombre, banco_nombre").eq("activa", true).order("nombre"),
    supabase.from("categorias").select("id, nombre, categoria_padre_id").order("nombre"),
    supabase.from("reglas_categorizacion").select("patron_descripcion, categoria_id, veces_usada"),
  ]);

  const categoriasOrdenadas = ordenarCategoriasJerarquia(categorias ?? []);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Importar movimientos desde CSV</h1>
          <Link href="/movimientos" className="text-sm text-slate-500 hover:text-slate-900">
            ← Volver a movimientos
          </Link>
        </div>

        {(cuentas ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">
            Antes de importar, da de alta una cuenta en la sección Cuentas.
          </p>
        ) : (
          <ImportarCSV cuentas={cuentas ?? []} categorias={categoriasOrdenadas} reglas={reglas ?? []} />
        )}
      </main>
    </>
  );
}
