import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import {
  actualizarCategoriaMovimiento,
  crearMovimiento,
  crearTraspaso,
  eliminarMovimiento,
  eliminarTraspaso,
} from "./actions";
import { MovimientoForm } from "./MovimientoForm";
import { NuevoTraspaso } from "./NuevoTraspaso";
import { CategoriaCelda } from "./CategoriaCelda";
import { ConfirmForm } from "@/components/ConfirmForm";
import { ordenarCategoriasJerarquia } from "@/lib/categorias";

function formatEUR(value: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatFecha(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

export default async function MovimientosPage() {
  const supabase = createClient();

  const [{ data: movimientos }, { data: cuentas }, { data: categorias }, { data: reglas }] =
    await Promise.all([
      supabase
        .from("movimientos")
        .select("*, cuentas(nombre, banco_nombre), categorias!categoria_id(nombre)")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("cuentas").select("id, nombre, banco_nombre").eq("activa", true).order("nombre"),
      supabase.from("categorias").select("id, nombre, categoria_padre_id").order("nombre"),
      supabase.from("reglas_categorizacion").select("patron_descripcion, categoria_id, veces_usada"),
    ]);

  const categoriasOrdenadas = ordenarCategoriasJerarquia(categorias ?? []);
  const hayCuentas = (cuentas ?? []).length > 0;
  const hoy = new Date().toISOString().slice(0, 10);

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

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Cuenta</th>
                <th className="px-4 py-2 font-medium">Descripción</th>
                <th className="px-4 py-2 font-medium">Categoría</th>
                <th className="px-4 py-2 font-medium text-right">Importe</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(movimientos ?? []).map((mov) => {
                const esTraspaso = mov.tipo === "traspaso";
                return (
                  <tr key={mov.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 whitespace-nowrap text-slate-500">{formatFecha(mov.fecha)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {mov.cuentas ? `${mov.cuentas.banco_nombre} — ${mov.cuentas.nombre}` : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {mov.descripcion}
                      {esTraspaso && (
                        <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                          Traspaso
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {esTraspaso ? (
                        <span className="text-slate-500">—</span>
                      ) : (
                        <CategoriaCelda
                          movimientoId={mov.id}
                          descripcion={mov.descripcion}
                          categoriaId={mov.categoria_id}
                          categorias={categoriasOrdenadas}
                          action={actualizarCategoriaMovimiento}
                        />
                      )}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        esTraspaso
                          ? "text-sky-700"
                          : Number(mov.importe) < 0
                            ? "text-slate-900"
                            : "text-emerald-600"
                      }`}
                    >
                      {formatEUR(Number(mov.importe))}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {esTraspaso ? (
                        <ConfirmForm
                          action={eliminarTraspaso}
                          mensaje="¿Seguro que quieres eliminar este traspaso? Se eliminarán los dos movimientos enlazados (origen y destino)."
                        >
                          <input type="hidden" name="traspaso_grupo_id" value={mov.traspaso_grupo_id} />
                          <button className="text-slate-400 hover:text-red-600" type="submit">
                            Eliminar
                          </button>
                        </ConfirmForm>
                      ) : (
                        <ConfirmForm
                          action={eliminarMovimiento}
                          mensaje={`¿Seguro que quieres eliminar el movimiento "${mov.descripcion}" (${formatEUR(Number(mov.importe))})?`}
                        >
                          <input type="hidden" name="id" value={mov.id} />
                          <button className="text-slate-400 hover:text-red-600" type="submit">
                            Eliminar
                          </button>
                        </ConfirmForm>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(movimientos ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Todavía no hay movimientos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-medium text-slate-700">Añadir movimiento</h2>

          {!hayCuentas ? (
            <p className="text-sm text-slate-400">
              Antes de añadir movimientos, da de alta una cuenta en la sección Cuentas.
            </p>
          ) : (
            <MovimientoForm
              action={crearMovimiento}
              cuentas={cuentas ?? []}
              categorias={categoriasOrdenadas}
              reglas={reglas ?? []}
              hoy={hoy}
            />
          )}
        </div>
      </main>
    </>
  );
}
