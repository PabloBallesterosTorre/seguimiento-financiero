import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import {
  actualizarCategoriaMovimiento,
  crearMovimiento,
  crearTraspaso,
  eliminarMovimiento,
  eliminarTraspaso,
  vincularComoTraspaso,
} from "./actions";
import { NuevoMovimiento } from "./NuevoMovimiento";
import { NuevoTraspaso } from "./NuevoTraspaso";
import { MovimientosTabla, type MovimientoFila } from "./MovimientosTabla";
import { ordenarCategoriasJerarquia } from "@/lib/categorias";
import { sugerirCategoria, type ReglaCategorizacion } from "@/lib/categorizacion";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { obtenerOrdenTabla } from "@/lib/ordenTabla";
import { encontrarCandidatosTraspaso, type CandidatoTraspaso } from "@/lib/traspasos";

type Movimiento = {
  id: string;
  cuenta_id: string | null;
  fecha: string;
  descripcion: string;
  importe: number;
  tipo: string;
  categoria_id: string | null;
  traspaso_grupo_id: string | null;
  tipo_original: string | null;
  cuentas: { nombre: string; banco_nombre: string } | null;
  categorias: { nombre: string } | null;
};

export default async function MovimientosPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: movimientos },
    { data: cuentas },
    { data: categorias },
    { data: reglas },
    config,
    ordenSinCategorizar,
    ordenCategorizados,
  ] = await Promise.all([
    supabase
      .from("movimientos")
      .select("*, cuentas(nombre, banco_nombre), categorias!categoria_id(nombre)")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("cuentas").select("id, nombre, banco_nombre").eq("activa", true).order("nombre"),
    supabase.from("categorias").select("id, nombre, categoria_padre_id").order("nombre"),
    supabase.from("reglas_categorizacion").select("patron_descripcion, categoria_id, veces_usada"),
    user ? obtenerConfiguracion(supabase, user.id) : null,
    user ? obtenerOrdenTabla(supabase, user.id, "movimientos_sin_categorizar") : null,
    user ? obtenerOrdenTabla(supabase, user.id, "movimientos") : null,
  ]);

  const categoriasOrdenadas = ordenarCategoriasJerarquia(categorias ?? []);
  const hayCuentas = (cuentas ?? []).length > 0;
  const hoy = new Date().toISOString().slice(0, 10);
  const moneda = config?.moneda_base ?? "EUR";
  const reglasCategorizacion = (reglas ?? []) as ReglaCategorizacion[];

  const todos = (movimientos ?? []) as unknown as Movimiento[];
  const sinCategorizar = todos.filter((m) => m.tipo !== "traspaso" && !m.categoria_id);
  const categorizados = todos.filter((m) => m.tipo === "traspaso" || m.categoria_id);

  const candidatosPorMovimiento = new Map<string, CandidatoTraspaso[]>(
    todos.filter((m) => m.tipo !== "traspaso").map((m) => [m.id, encontrarCandidatosTraspaso(m, todos)])
  );

  const filasSinCategorizar: MovimientoFila[] = sinCategorizar.map((m) => ({
    ...m,
    sugeridaId: sugerirCategoria(m.descripcion, reglasCategorizacion),
    candidatosTraspaso: candidatosPorMovimiento.get(m.id) ?? [],
  }));

  const filasCategorizados: MovimientoFila[] = categorizados.map((m) => ({
    ...m,
    candidatosTraspaso: candidatosPorMovimiento.get(m.id) ?? [],
  }));

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Movimientos</h1>
          <div className="flex items-center gap-3">
            <NuevoTraspaso cuentas={cuentas ?? []} action={crearTraspaso} hoy={hoy} />
            <Link
              href="/movimientos/importar"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Importar CSV
            </Link>
          </div>
        </div>

        {filasSinCategorizar.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-amber-200 bg-white">
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-2">
              <h2 className="text-sm font-medium text-amber-800">
                Sin categorizar ({filasSinCategorizar.length})
              </h2>
            </div>
            <MovimientosTabla
              tablaKey="movimientos_sin_categorizar"
              movimientos={filasSinCategorizar}
              categoriasOrdenadas={categoriasOrdenadas}
              moneda={moneda}
              ordenInicial={ordenSinCategorizar}
              actualizarCategoriaMovimiento={actualizarCategoriaMovimiento}
              vincularComoTraspaso={vincularComoTraspaso}
              eliminarTraspaso={eliminarTraspaso}
              eliminarMovimiento={eliminarMovimiento}
            />
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <MovimientosTabla
            tablaKey="movimientos"
            movimientos={filasCategorizados}
            categoriasOrdenadas={categoriasOrdenadas}
            moneda={moneda}
            ordenInicial={ordenCategorizados}
            mensajeVacio="Todavía no hay movimientos categorizados."
            actualizarCategoriaMovimiento={actualizarCategoriaMovimiento}
            vincularComoTraspaso={vincularComoTraspaso}
            eliminarTraspaso={eliminarTraspaso}
            eliminarMovimiento={eliminarMovimiento}
          />
        </div>

        {!hayCuentas ? (
          <p className="text-sm text-slate-400">
            Antes de añadir movimientos, da de alta una cuenta en la sección Cuentas.
          </p>
        ) : (
          <NuevoMovimiento
            action={crearMovimiento}
            cuentas={cuentas ?? []}
            categorias={categoriasOrdenadas}
            reglas={reglasCategorizacion}
            hoy={hoy}
          />
        )}
      </main>
    </>
  );
}
