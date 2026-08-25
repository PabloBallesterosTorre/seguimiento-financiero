import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { eliminarAmortizacionExtra, marcarAmortizacionAplicada, registrarAmortizacionExtra } from "../actions";
import { ConfirmForm } from "@/components/ConfirmForm";
import { CuadroAmortizacion } from "./CuadroAmortizacion";
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

  const { data: categoriaPago } = deuda.categoria_id
    ? await supabase.from("categorias").select("nombre").eq("id", deuda.categoria_id).maybeSingle()
    : { data: null };

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

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{deuda.nombre}</h1>
          <div className="flex items-center gap-4">
            {tieneInteres && (
              <Link
                href={`/deudas/${deuda.id}/simular`}
                className="text-sm text-slate-500 hover:text-slate-900"
              >
                Simular amortización →
              </Link>
            )}
            <Link href="/deudas" className="text-sm text-slate-500 hover:text-slate-900">
              ← Volver a deudas
            </Link>
          </div>
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

        {categoriaPago && (
          <p className="text-xs text-slate-400">
            Categoría de pago:{" "}
            <Link href="/categorias" className="underline hover:text-slate-600">
              {categoriaPago.nombre}
            </Link>
          </p>
        )}

        {!tieneInteres && (
          <p className="text-sm text-amber-600">
            Falta el tipo de interés (o la cuota es 0) para poder calcular el cuadro de amortización.
            Puedes añadirlo desde Supabase mientras no haya edición en la UI.
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
              <CuadroAmortizacion filas={simulacion.filas} />
            </div>
          </>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-medium text-slate-700">Registrar amortización</h2>
          <p className="text-xs text-slate-400">
            Elige la fecha libremente: si es hoy o pasada se aplica al capital pendiente al guardar; si
            es futura, queda como plan pendiente hasta que la marques como aplicada.
          </p>
          <form action={registrarAmortizacionExtra} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <input type="hidden" name="deuda_id" value={deuda.id} />
            <div>
              <label className="block text-xs text-slate-500">Fecha</label>
              <input
                name="fecha"
                type="date"
                required
                defaultValue={hoy}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Importe</label>
              <input
                name="importe"
                type="number"
                step="0.01"
                min="0"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Efecto</label>
              <select
                name="tipo_reduccion"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="reducir_plazo">Reducir plazo</option>
                <option value="reducir_cuota">Reducir cuota</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Etiqueta (informativa)</label>
              <select
                name="recurrencia"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="puntual">Puntual</option>
                <option value="mensual">Parte de un plan mensual</option>
                <option value="anual">Parte de un plan anual</option>
              </select>
            </div>
            <div className="sm:col-span-4">
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Registrar
              </button>
            </div>
          </form>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-medium text-slate-700">Amortizaciones extra</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium text-right">Importe</th>
                <th className="px-4 py-2 font-medium">Efecto</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(amortizacionesExtra ?? []).map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-500">{formatFecha(a.fecha)}</td>
                  <td className="px-4 py-2 text-right">{formatEUR(Number(a.importe))}</td>
                  <td className="px-4 py-2 capitalize">{a.tipo_reduccion.replace("_", " ")}</td>
                  <td className="px-4 py-2">
                    {a.aplicado ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Aplicada
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {!a.aplicado && (
                      <ConfirmForm
                        action={marcarAmortizacionAplicada}
                        mensaje={`¿Confirmas que esta amortización de ${formatEUR(Number(a.importe))} ya se ha pagado? Se descontará del capital pendiente y no se puede deshacer.`}
                        className="inline"
                      >
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="deuda_id" value={deuda.id} />
                        <input type="hidden" name="importe" value={a.importe} />
                        <input type="hidden" name="tipo_reduccion" value={a.tipo_reduccion} />
                        <button
                          className="mr-3 text-slate-500 hover:text-slate-900"
                          type="submit"
                        >
                          Marcar como aplicado
                        </button>
                      </ConfirmForm>
                    )}
                    <ConfirmForm
                      action={eliminarAmortizacionExtra}
                      mensaje={`¿Seguro que quieres eliminar esta amortización de ${formatEUR(Number(a.importe))}?`}
                      className="inline"
                    >
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="deuda_id" value={deuda.id} />
                      <button className="text-slate-400 hover:text-red-600" type="submit">
                        Eliminar
                      </button>
                    </ConfirmForm>
                  </td>
                </tr>
              ))}
              {(amortizacionesExtra ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Todavía no has registrado ninguna amortización extra.
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
