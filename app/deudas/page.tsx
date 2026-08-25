import Link from "next/link";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { crearDeuda, eliminarDeuda } from "./actions";
import { ConfirmForm } from "@/components/ConfirmForm";
import { NuevaDeuda } from "./NuevaDeuda";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatMoneda } from "@/lib/formato";

export default async function DeudasPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: deudas }, config] = await Promise.all([
    supabase.from("deudas").select("*").order("created_at", { ascending: true }),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  const formatEUR = (v: number) => formatMoneda(v, config?.moneda_base ?? "EUR");

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

        <NuevaDeuda action={crearDeuda} />
      </main>
    </>
  );
}
