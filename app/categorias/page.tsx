import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { crearCategoria, actualizarCategoria, eliminarCategoria } from "./actions";
import { CategoriasClient } from "./CategoriasClient";

export default async function CategoriasPage() {
  const supabase = createClient();
  const { data: categorias } = await supabase
    .from("categorias")
    .select("id, nombre, categoria_padre_id, es_categoria_inversion")
    .order("nombre");

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
        />
      </main>
    </>
  );
}
