import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { eliminarAmortizacionExtra, marcarAmortizacionAplicada, registrarAmortizacionExtra } from "../actions";
import { ConfirmForm } from "@/components/ConfirmForm";
import { CuadroAmortizacion } from "./CuadroAmortizacion";
import { RegistrarAmortizacion } from "./RegistrarAmortizacion";
import { simularAmortizacion } from "@/lib/amortizacion";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatMoneda } from "@/lib/formato";
import { cardClass, tableWrapClass, rowDelClass } from "@/components/formStyles";

function formatFecha(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <p className="text-xs text-ink-secondary">{label}</p>
      <p className="mt-1.5 font-sora text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

export default async function DeudaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: deuda } = await supabase.from("deudas").select("*").eq("id", id).single();
  if (!deuda) notFound();

  const [{ data: categoriaPago }, { data: amortizacionesExtra }, config] = await Promise.all([
    deuda.categoria_id
      ? supabase.from("categorias").select("nombre").eq("id", deuda.categoria_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("amortizaciones_extra").select("*").eq("deuda_id", id).order("fecha", { ascending: false }),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  const formatEUR = (v: number) => formatMoneda(v, config?.moneda_base ?? "EUR");

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
      <main className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-sora text-[26px] font-bold text-ink">{deuda.nombre}</h1>
          <div className="flex items-center gap-4">
            {tieneInteres && (
              <Link href={`/deudas/${deuda.id}/simular`} className="text-sm font-semibold text-accent hover:underline">
                Simular amortización →
              </Link>
            )}
            <Link href="/deudas" className="text-sm font-semibold text-ink-tertiary hover:text-ink">
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
          <p className="text-xs text-ink-tertiary">
            Categoría de pago:{" "}
            <Link href="/categorias" className="font-semibold text-accent hover:underline">
              {categoriaPago.nombre}
            </Link>
          </p>
        )}

        {!tieneInteres && (
          <p className="text-sm text-forecast">
            Falta el tipo de interés (o la cuota es 0) para poder calcular el cuadro de amortización.
            Puedes añadirlo desde Supabase mientras no haya edición en la UI.
          </p>
        )}

        {simulacion && (
          <>
            {simulacion.cuotaNoCubreIntereses && (
              <p className="text-sm text-danger">
                Con la cuota actual no se cubren los intereses generados: esta deuda nunca se terminaría de
                pagar a este ritmo.
              </p>
            )}

            <div className={`${cardClass} space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-sora text-base font-semibold text-ink">Cuadro de amortización actual</h2>
                <p className="text-[13px] text-ink-secondary">
                  {simulacion.mesesRestantes} meses restantes · {formatEUR(simulacion.interesesTotales)} en
                  intereses
                </p>
              </div>
              <CuadroAmortizacion filas={simulacion.filas} moneda={config?.moneda_base ?? "EUR"} />
            </div>
          </>
        )}

        <RegistrarAmortizacion action={registrarAmortizacionExtra} deudaId={deuda.id} hoy={hoy} />

        <div className={`overflow-hidden ${tableWrapClass}`}>
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-[13px] font-semibold text-ink-secondary">Amortizaciones extra</h2>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-xs font-semibold text-ink-tertiary">Fecha</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Importe</th>
                <th className="px-4 py-3 text-xs font-semibold text-ink-tertiary">Efecto</th>
                <th className="px-4 py-3 text-xs font-semibold text-ink-tertiary">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(amortizacionesExtra ?? []).map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-3.5 text-ink-secondary">{formatFecha(a.fecha)}</td>
                  <td className="px-4 py-3.5 text-right font-semibold text-ink">{formatEUR(Number(a.importe))}</td>
                  <td className="px-4 py-3.5 capitalize text-ink-secondary">{a.tipo_reduccion.replace("_", " ")}</td>
                  <td className="px-4 py-3.5">
                    {a.aplicado ? (
                      <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
                        Aplicada
                      </span>
                    ) : (
                      <span className="rounded-full bg-forecast/10 px-2.5 py-0.5 text-xs font-semibold text-forecast">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
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
                        <button className="mr-3.5 text-[13px] font-semibold text-accent" type="submit">
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
                      <button className={rowDelClass} type="submit">
                        Eliminar
                      </button>
                    </ConfirmForm>
                  </td>
                </tr>
              ))}
              {(amortizacionesExtra ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-tertiary">
                    Todavía no has registrado ninguna amortización extra.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </main>
    </>
  );
}
