import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { crearCategoria, actualizarCategoria, eliminarCategoria, obtenerMovimientosDeCategoria } from "./actions";
import { CategoriasClient } from "./CategoriasClient";
import { obtenerConfiguracion } from "@/lib/configuracion";

export default async function CategoriasPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: categorias }, config] = await Promise.all([
    supabase.from("categorias").select("id, nombre, categoria_padre_id, es_categoria_inversion").order("nombre"),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <h1 className="text-xl font-semibold">Categorías</h1>

        <CategoriasClient
          categorias={categorias ?? []}
          crearCategoria={crearCategoria}
          actualizarCategoria={actualizarCategoria}
          eliminarCategoria={eliminarCategoria}
          obtenerMovimientosDeCategoria={obtenerMovimientosDeCategoria}
          moneda={config?.moneda_base ?? "EUR"}
        />
      </main>
    </>
  );
}
