import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import {
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  obtenerMovimientosDeCategoria,
  crearCategoriasSugeridas,
} from "./actions";
import { CategoriasClient } from "./CategoriasClient";
import { obtenerConfiguracion } from "@/lib/configuracion";

export default async function CategoriasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: categorias }, config, { data: movimientos }] = await Promise.all([
    supabase.from("categorias").select("id, nombre, categoria_padre_id, es_categoria_inversion").order("nombre"),
    user ? obtenerConfiguracion(supabase, user.id) : null,
    supabase.from("movimientos").select("categoria_id, subcategoria_id"),
  ]);

  // Cuántos movimientos usa cada categoría. Con 46 categorías es la diferencia entre poder
  // limpiarlas o no: sin este dato no hay forma de saber cuáles están muertas (auditoría de
  // diseño, tanda 11). Una subcategoría cuenta también para su padre, que es como se leen
  // los informes.
  const usos = new Map<string, number>();
  const sumar = (id: string | null) => {
    if (id) usos.set(id, (usos.get(id) ?? 0) + 1);
  };
  const padreDe = new Map((categorias ?? []).map((c) => [c.id, c.categoria_padre_id as string | null]));
  for (const m of movimientos ?? []) {
    sumar(m.categoria_id);
    sumar(m.subcategoria_id);
    const padre = m.categoria_id ? padreDe.get(m.categoria_id) : null;
    if (padre) sumar(padre);
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-10">
        <h1 className="font-sora text-[26px] font-bold text-ink">Categorías</h1>

        <CategoriasClient
          categorias={categorias ?? []}
          crearCategoria={crearCategoria}
          actualizarCategoria={actualizarCategoria}
          eliminarCategoria={eliminarCategoria}
          crearCategoriasSugeridas={crearCategoriasSugeridas}
          obtenerMovimientosDeCategoria={obtenerMovimientosDeCategoria}
          usos={Object.fromEntries(usos)}
          moneda={config?.moneda_base ?? "EUR"}
        />
      </main>
    </>
  );
}
