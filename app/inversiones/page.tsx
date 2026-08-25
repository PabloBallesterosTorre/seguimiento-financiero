import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { crearInversion, actualizarValorInversion, eliminarInversion } from "./actions";
import { ConfirmForm } from "@/components/ConfirmForm";
import { NuevaInversion } from "./NuevaInversion";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatMoneda } from "@/lib/formato";

function formatFecha(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

export default async function InversionesPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: inversiones }, config] = await Promise.all([
    supabase.from("inversiones").select("*").order("created_at", { ascending: true }),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  const formatEUR = (v: number) => formatMoneda(v, config?.moneda_base ?? "EUR");
  const total = (inversiones ?? []).reduce((sum, i) => sum + Number(i.valor_actual ?? 0), 0);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Inversión</h1>
          <p className="text-sm text-slate-500">
            Total: <span className="font-medium text-slate-900">{formatEUR(total)}</span>
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">Valor actual</th>
                <th className="px-4 py-2 font-medium">Actualizado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(inversiones ?? []).map((inv) => (
                <tr key={inv.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 capitalize">{inv.tipo_activo.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2">{inv.nombre}</td>
                  <td className="px-4 py-2">
                    <form action={actualizarValorInversion} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={inv.id} />
                      <input
                        name="valor_actual"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={Number(inv.valor_actual)}
                        className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Guardar
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                    {formatFecha(inv.fecha_actualizacion)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ConfirmForm
                      action={eliminarInversion}
                      mensaje={`¿Seguro que quieres eliminar la inversión "${inv.nombre}"? Esta acción no se puede deshacer.`}
                    >
                      <input type="hidden" name="id" value={inv.id} />
                      <button className="text-slate-400 hover:text-red-600" type="submit">
                        Eliminar
                      </button>
                    </ConfirmForm>
                  </td>
                </tr>
              ))}
              {(inversiones ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Todavía no has dado de alta ninguna inversión.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <NuevaInversion action={crearInversion} />

        <p className="text-sm text-slate-400">
          El valor de cada inversión se actualiza a mano por ahora — la sincronización automática con
          bróker/exchange es una mejora de fase 2.
        </p>
      </main>
    </>
  );
}
