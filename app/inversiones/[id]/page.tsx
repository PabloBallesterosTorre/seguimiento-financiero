import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { registrarValoracionInversion } from "../actions";
import { RegistrarValoracion } from "./RegistrarValoracion";
import { EvolucionInversionChart } from "./EvolucionInversionChart";
import { construirEvolucionInversion } from "@/lib/inversiones";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatMoneda } from "@/lib/formato";
import { cardClass, tableWrapClass } from "@/components/formStyles";

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

export default async function InversionDetallePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inversion } = await supabase.from("inversiones").select("*").eq("id", params.id).single();
  if (!inversion) notFound();

  const [{ data: valoraciones }, { data: previsto }, config] = await Promise.all([
    supabase
      .from("inversion_valoraciones")
      .select("fecha, valor, origen")
      .eq("inversion_id", params.id)
      .order("fecha", { ascending: false }),
    inversion.movimiento_previsto_id
      ? supabase.from("movimientos_previstos").select("descripcion, importe_estimado").eq("id", inversion.movimiento_previsto_id).maybeSingle()
      : Promise.resolve({ data: null }),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  const formatEUR = (v: number) => formatMoneda(v, config?.moneda_base ?? "EUR");
  const hoy = new Date().toISOString().slice(0, 10);

  const rentabilidad = inversion.rentabilidad_anual_asumida !== null ? Number(inversion.rentabilidad_anual_asumida) : null;
  const evolucion = construirEvolucionInversion(
    (valoraciones ?? []).map((v) => ({ fecha: v.fecha, valor: Number(v.valor) })),
    rentabilidad,
    hoy
  );

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-sora text-[26px] font-bold text-ink">{inversion.nombre}</h1>
          <Link href="/inversiones" className="text-sm font-semibold text-ink-tertiary hover:text-ink">
            ← Volver a inversión
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <InfoCard label="Valor actual" value={formatEUR(Number(inversion.valor_actual))} />
          <InfoCard label="Tipo de activo" value={inversion.tipo_activo.replace(/_/g, " ")} />
          <InfoCard label="Rentabilidad anual asumida" value={rentabilidad !== null ? `${rentabilidad}%` : "Sin definir"} />
          <InfoCard label="Actualizado" value={formatFecha(inversion.fecha_actualizacion)} />
        </div>

        {inversion.es_recurrente && (
          <p className="text-[13px] text-ink-secondary">
            Aportación recurrente vinculada a{" "}
            {previsto ? (
              <Link href="/prevision/previstos" className="font-semibold text-accent hover:underline">
                {previsto.descripcion} ({formatEUR(Number(previsto.importe_estimado))})
              </Link>
            ) : (
              <span className="font-semibold text-forecast">ningún movimiento previsto todavía</span>
            )}
            . Se concilia cada mes con el mecanismo habitual de previsión.
          </p>
        )}

        <div className={`${cardClass} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-sora text-base font-semibold text-ink">Evolución</h2>
            <RegistrarValoracion action={registrarValoracionInversion} inversionId={inversion.id} hoy={hoy} />
          </div>
          <EvolucionInversionChart puntos={evolucion} moneda={config?.moneda_base ?? "EUR"} />
        </div>

        <div className={`overflow-hidden ${tableWrapClass}`}>
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-[13px] font-semibold text-ink-secondary">Valoraciones registradas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Fecha</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Origen</th>
                </tr>
              </thead>
              <tbody>
                {(valoraciones ?? []).map((v) => (
                  <tr key={v.fecha} className="border-t border-border">
                    <td className="px-4 py-3 text-ink-secondary">{formatFecha(v.fecha)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink">{formatEUR(Number(v.valor))}</td>
                    <td className="px-4 py-3 capitalize text-ink-tertiary">{v.origen}</td>
                  </tr>
                ))}
                {(valoraciones ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-ink-tertiary">
                      Todavía no hay ninguna valoración registrada.
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
