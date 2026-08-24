import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { cambiarEstadoPrevisto, crearMovimientoPrevisto, eliminarMovimientoPrevisto } from "../actions";
import { MovimientoPrevistoForm } from "./MovimientoPrevistoForm";
import { importeEstimado } from "@/lib/prevision";

function formatEUR(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

export default async function PrevistosPage() {
  const supabase = createClient();

  const [{ data: previstos }, { data: categorias }, { data: cuentas }] = await Promise.all([
    supabase
      .from("movimientos_previstos")
      .select("*, categorias!categoria_id(nombre)")
      .order("created_at", { ascending: false }),
    supabase.from("categorias").select("id, nombre, tipo").is("categoria_padre_id", null).order("nombre"),
    supabase.from("cuentas").select("id, nombre, banco_nombre").eq("activa", true).order("nombre"),
  ]);

  const categoriasGasto = (categorias ?? []).filter((c) => c.tipo === "gasto");
  const categoriasIngreso = (categorias ?? []).filter((c) => c.tipo === "ingreso");
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Movimientos previstos</h1>
          <div className="flex items-center gap-4">
            <Link href="/prevision/sugerencias" className="text-sm text-slate-500 hover:text-slate-900">
              Ver sugerencias →
            </Link>
            <Link href="/prevision" className="text-sm text-slate-500 hover:text-slate-900">
              ← Ver proyección
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Descripción</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium">Categoría</th>
                <th className="px-4 py-2 font-medium text-right">Importe</th>
                <th className="px-4 py-2 font-medium">Recurrencia</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(previstos ?? []).map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{p.descripcion}</td>
                  <td className="px-4 py-2 capitalize">{p.tipo}</td>
                  <td className="px-4 py-2 text-slate-500">{p.categorias?.nombre ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{formatEUR(importeEstimado(p))}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {p.tipo_recurrencia === "unica_vez" ? "Única vez" : `Recurrente (${p.periodicidad})`}
                  </td>
                  <td className="px-4 py-2">
                    <form action={cambiarEstadoPrevisto} className="inline">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="estado" value={p.estado === "activo" ? "pausado" : "activo"} />
                      <button
                        type="submit"
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.estado === "activo"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {p.estado === "activo" ? "Activo" : "Pausado"}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={eliminarMovimientoPrevisto}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-slate-400 hover:text-red-600" type="submit">
                        Eliminar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(previstos ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                    Todavía no hay movimientos previstos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-medium text-slate-700">Añadir previsión</h2>
          <MovimientoPrevistoForm
            action={crearMovimientoPrevisto}
            categoriasGasto={categoriasGasto}
            categoriasIngreso={categoriasIngreso}
            cuentas={cuentas ?? []}
            hoy={hoy}
          />
        </div>
      </main>
    </>
  );
}
