import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { eliminarAmortizacionExtra } from "../actions";
import { SimuladorAmortizacion } from "./SimuladorAmortizacion";
import { simularAmortizacion } from "@/lib/amortizacion";

function formatEUR(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
}

function formatFecha(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-medium">{value}</p>
    </div>
  );
}

export default async function DeudaDetallePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: deuda } = await supabase.from("deudas").select("*").eq("id", params.id).single();
  if (!deuda) notFound();

  const { data: amortizacionesExtra } = await supabase
    .from("amortizaciones_extra")
    .select("*")
    .eq("deuda_id", params.id)
    .order("fecha", { ascending: false });

  const tieneInteres = deuda.tipo_interes !== null && Number(deuda.cuota) > 0;
  const simulacion = tieneInteres
    ? simularAmortizacion(
        Number(deuda.capital_pendiente),
        Number(deuda.tipo_interes),
        Number(deuda.cuota),
        Number(deuda.valor_residual ?? 0)
      )
    : null;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{deuda.nombre}</h1>
          <Link href="/deudas" className="text-sm text-slate-500 hover:text-slate-900">
            ← Volver a deudas
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <InfoCard label="Capital pendiente" value={formatEUR(Number(deuda.capital_pendiente))} />
          <InfoCard label="Cuota" value={formatEUR(Number(deuda.cuota))} />
          <InfoCard
            label="Interés"
            value={deuda.tipo_interes !== null ? `${deuda.tipo_interes}% (${deuda.modalidad_interes})` : "—"}
          />
          <InfoCard label="Capital inicial" value={formatEUR(Number(deuda.capital_inicial))} />
        </div>

        {!tieneInteres && (
          <p className="text-sm text-amber-600">
            Falta el tipo de interés (o la cuota es 0) para poder calcular el cuadro de amortización y el
            simulador. Puedes añadirlo desde Supabase mientras no haya edición en la UI.
          </p>
        )}

        {simulacion && (
          <>
            {simulacion.cuotaNoCubreIntereses && (
              <p className="text-sm text-red-600">
                Con la cuota actual no se cubren los intereses generados: esta deuda nunca se terminaría de
                pagar a este ritmo.
              </p>
            )}

            <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-slate-700">Cuadro de amortización actual</h2>
                <p className="text-sm text-slate-500">
                  {simulacion.mesesRestantes} meses restantes · {formatEUR(simulacion.interesesTotales)} en
                  intereses
                </p>
              </div>
              <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-md border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Mes</th>
                      <th className="px-3 py-2 font-medium text-right">Interés</th>
                      <th className="px-3 py-2 font-medium text-right">Amortizado</th>
                      <th className="px-3 py-2 font-medium text-right">Pendiente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simulacion.filas.map((f) => (
                      <tr key={f.mes} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-500">{f.mes}</td>
                        <td className="px-3 py-2 text-right">{formatEUR(f.interes)}</td>
                        <td className="px-3 py-2 text-right">{formatEUR(f.principal)}</td>
                        <td className="px-3 py-2 text-right">{formatEUR(f.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <SimuladorAmortizacion
              deudaId={deuda.id}
              capitalPendiente={Number(deuda.capital_pendiente)}
              tasaAnual={Number(deuda.tipo_interes)}
              cuotaActual={Number(deuda.cuota)}
              valorResidual={Number(deuda.valor_residual ?? 0)}
            />
          </>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-medium text-slate-700">Amortizaciones anticipadas aplicadas</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium text-right">Importe</th>
                <th className="px-4 py-2 font-medium">Efecto</th>
                <th className="px-4 py-2 font-medium">Recurrencia</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(amortizacionesExtra ?? []).map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-500">{formatFecha(a.fecha)}</td>
                  <td className="px-4 py-2 text-right">{formatEUR(Number(a.importe))}</td>
                  <td className="px-4 py-2 capitalize">{a.tipo_reduccion.replace("_", " ")}</td>
                  <td className="px-4 py-2 capitalize">{a.recurrencia}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={eliminarAmortizacionExtra}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="deuda_id" value={deuda.id} />
                      <button className="text-slate-400 hover:text-red-600" type="submit">
                        Eliminar
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(amortizacionesExtra ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Todavía no has aplicado ninguna amortización anticipada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
