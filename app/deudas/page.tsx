import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { crearDeuda, eliminarDeuda } from "./actions";
import { ConfirmForm } from "@/components/ConfirmForm";

function formatEUR(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

export default async function DeudasPage() {
  const supabase = createClient();
  const { data: deudas } = await supabase
    .from("deudas")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <h1 className="text-xl font-semibold">Deuda</h1>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium text-right">Pendiente</th>
                <th className="px-4 py-2 font-medium text-right">Cuota</th>
                <th className="px-4 py-2 font-medium text-right">Interés</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(deudas ?? []).map((deuda) => (
                <tr key={deuda.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 capitalize">{deuda.tipo}</td>
                  <td className="px-4 py-2">
                    <Link href={`/deudas/${deuda.id}`} className="underline hover:text-slate-900">
                      {deuda.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right">{formatEUR(Number(deuda.capital_pendiente))}</td>
                  <td className="px-4 py-2 text-right">{formatEUR(Number(deuda.cuota))}</td>
                  <td className="px-4 py-2 text-right text-slate-500">
                    {deuda.tipo_interes !== null ? `${deuda.tipo_interes}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ConfirmForm
                      action={eliminarDeuda}
                      mensaje={`¿Seguro que quieres eliminar la deuda "${deuda.nombre}"? Esta acción no se puede deshacer.`}
                    >
                      <input type="hidden" name="id" value={deuda.id} />
                      <button className="text-slate-400 hover:text-red-600" type="submit">
                        Eliminar
                      </button>
                    </ConfirmForm>
                  </td>
                </tr>
              ))}
              {(deudas ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Todavía no has dado de alta ninguna deuda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-medium text-slate-700">Añadir deuda</h2>
          <form action={crearDeuda} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs text-slate-500">Tipo</label>
              <input
                name="tipo"
                required
                placeholder="Hipoteca, préstamo, coche…"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Nombre</label>
              <input
                name="nombre"
                required
                placeholder="Hipoteca vivienda habitual"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Capital inicial</label>
              <input
                name="capital_inicial"
                type="number"
                step="0.01"
                min="0"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Capital pendiente actual</label>
              <input
                name="capital_pendiente"
                type="number"
                step="0.01"
                min="0"
                placeholder="Igual al inicial si es nueva"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Cuota</label>
              <input
                name="cuota"
                type="number"
                step="0.01"
                min="0"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Tipo de interés (% anual)</label>
              <input
                name="tipo_interes"
                type="number"
                step="0.001"
                placeholder="3.1"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Modalidad</label>
              <select
                name="modalidad_interes"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="fijo">Fijo</option>
                <option value="variable">Variable</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Fecha inicio</label>
              <input
                name="fecha_inicio"
                type="date"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Fecha fin (opcional)</label>
              <input
                name="fecha_fin"
                type="date"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Valor residual (opcional)</label>
              <input
                name="valor_residual"
                type="number"
                step="0.01"
                min="0"
                placeholder="Financiación con pago final"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-4">
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Añadir deuda
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
