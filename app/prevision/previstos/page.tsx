import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { cambiarEstadoPrevisto, crearMovimientoPrevisto, eliminarMovimientoPrevisto } from "../actions";
import { ConfirmForm } from "@/components/ConfirmForm";
import { NuevoPrevisto } from "./NuevoPrevisto";
import { importeEstimado, categoriaEfectivaId } from "@/lib/prevision";
import { ordenarCategoriasJerarquia } from "@/lib/categorias";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatMoneda } from "@/lib/formato";

export default async function PrevistosPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: previstos }, { data: categorias }, { data: cuentas }, config] = await Promise.all([
    supabase.from("movimientos_previstos").select("*").order("created_at", { ascending: false }),
    supabase.from("categorias").select("id, nombre, categoria_padre_id").order("nombre"),
    supabase.from("cuentas").select("id, nombre, banco_nombre").eq("activa", true).order("nombre"),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  const formatEUR = (v: number) => formatMoneda(v, config?.moneda_base ?? "EUR");

  const idsMovimientosReales = (previstos ?? [])
    .map((p) => p.movimiento_real_id)
    .filter((id): id is string => Boolean(id));

  const { data: movimientosReales } =
    idsMovimientosReales.length > 0
      ? await supabase.from("movimientos").select("id, categoria_id").in("id", idsMovimientosReales)
      : { data: [] as { id: string; categoria_id: string | null }[] };

  const categoriaPorMovimientoReal = new Map((movimientosReales ?? []).map((m) => [m.id, m.categoria_id]));
  const nombrePorCategoria = new Map((categorias ?? []).map((c) => [c.id, c.nombre]));

  function categoriaMostrada(p: { categoria_id: string | null; movimiento_real_id: string | null }) {
    const categoriaId = categoriaEfectivaId(p, categoriaPorMovimientoReal);
    return categoriaId ? nombrePorCategoria.get(categoriaId) ?? "—" : "—";
  }

  const categoriasOrdenadas = ordenarCategoriasJerarquia(categorias ?? []);
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
                  <td className="px-4 py-2 text-slate-500">{categoriaMostrada(p)}</td>
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
                    <ConfirmForm
                      action={eliminarMovimientoPrevisto}
                      mensaje={`¿Seguro que quieres eliminar la previsión "${p.descripcion}"? Esta acción no se puede deshacer.`}
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-slate-400 hover:text-red-600" type="submit">
                        Eliminar
                      </button>
                    </ConfirmForm>
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

        <NuevoPrevisto
          action={crearMovimientoPrevisto}
          categorias={categoriasOrdenadas}
          cuentas={cuentas ?? []}
          hoy={hoy}
        />

        <p className="text-sm text-slate-400">
          Da de alta previsiones a mano solo para: gastos/ingresos nuevos sin histórico todavía (una
          suscripción recién contratada), ítems puntuales que ya sabes que van a pasar (una paga extra
          concreta), o mientras no tengas suficiente histórico importado para que la detección automática
          (
          <Link href="/prevision/sugerencias" className="underline">
            Sugerencias
          </Link>
          ) lo identifique sola. Para gastos recurrentes con histórico ya importado (hipoteca, nómina,
          seguros), deja que el motor de patrones lo proponga — evita duplicar la previsión a mano y con el
          motor.
        </p>
      </main>
    </>
  );
}
