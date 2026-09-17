import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { registrarValoracionInversion, registrarOperacion, eliminarOperacion } from "../actions";
import { RegistrarValoracion } from "./RegistrarValoracion";
import { EvolucionInversionChart } from "./EvolucionInversionChart";
import { OperacionesInversion, type OperacionEnTabla } from "./OperacionesInversion";
import {
  construirEvolucionInversion,
  calcularPosicion,
  flujosParaTIR,
  tirAnualizada,
  type OperacionInversion,
} from "@/lib/inversiones";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatMoneda, formatPorcentaje, formatPrecio } from "@/lib/formato";
import { cardClass, tableWrapClass } from "@/components/formStyles";

function formatFecha(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

function InfoCard({ label, value, clase, nota }: { label: string; value: string; clase?: string; nota?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <p className="text-xs text-ink-secondary">{label}</p>
      <p className={`mt-1.5 font-sora text-lg font-semibold ${clase ?? "text-ink"}`}>{value}</p>
      {nota && <p className="mt-1 text-[11px] text-ink-tertiary">{nota}</p>}
    </div>
  );
}

export default async function InversionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inversion } = await supabase.from("inversiones").select("*").eq("id", id).single();
  if (!inversion) notFound();

  const [{ data: valoraciones }, { data: operacionesRaw }, { data: previsto }, { data: cuenta }, config] =
    await Promise.all([
      supabase
        .from("inversion_valoraciones")
        .select("fecha, valor, origen")
        .eq("inversion_id", id)
        .order("fecha", { ascending: false }),
      supabase
        .from("inversion_operaciones")
        .select("id, fecha, tipo, importe, participaciones, precio, comision, nota, origen, movimiento_id")
        .eq("inversion_id", id)
        .order("fecha", { ascending: false }),
      inversion.movimiento_previsto_id
        ? supabase
            .from("movimientos_previstos")
            .select("descripcion, importe_estimado")
            .eq("id", inversion.movimiento_previsto_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      inversion.cuenta_id
        ? supabase.from("cuentas").select("nombre, banco_nombre").eq("id", inversion.cuenta_id).maybeSingle()
        : Promise.resolve({ data: null }),
      user ? obtenerConfiguracion(supabase, user.id) : null,
    ]);

  const moneda = config?.moneda_base ?? "EUR";
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const hoy = new Date().toISOString().slice(0, 10);

  const operaciones: OperacionEnTabla[] = (operacionesRaw ?? []).map((o) => ({
    id: o.id,
    fecha: o.fecha,
    tipo: o.tipo,
    importe: Number(o.importe),
    participaciones: o.participaciones !== null ? Number(o.participaciones) : null,
    precio: o.precio !== null ? Number(o.precio) : null,
    comision: Number(o.comision ?? 0),
    nota: o.nota,
    origen: o.origen,
    movimiento_id: o.movimiento_id,
  }));

  // calcularPosicion no depende del orden, pero la TIR sí necesita las fechas en orden
  // ascendente para tomar la primera como origen del plazo.
  const paraCalculo: OperacionInversion[] = [...operaciones]
    .reverse()
    .map((o) => ({ fecha: o.fecha, tipo: o.tipo as OperacionInversion["tipo"], importe: o.importe, participaciones: o.participaciones, precio: o.precio }));

  const valorMercado = Number(inversion.valor_actual);
  const posicion = calcularPosicion(paraCalculo, valorMercado);
  const tir = tirAnualizada(flujosParaTIR(paraCalculo, valorMercado, hoy));
  const hayLibro = operaciones.length > 0;
  const comisiones = operaciones.reduce((suma, o) => suma + o.comision, 0);

  const rentabilidad = inversion.rentabilidad_anual_asumida !== null ? Number(inversion.rentabilidad_anual_asumida) : null;
  const evolucion = construirEvolucionInversion(
    (valoraciones ?? []).map((v) => ({ fecha: v.fecha, valor: Number(v.valor) })),
    rentabilidad,
    hoy
  );

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-sora text-[26px] font-bold text-ink">{inversion.nombre}</h1>
            <p className="mt-1 text-[13px] capitalize text-ink-tertiary">
              {inversion.tipo_activo.replace(/_/g, " ")}
              {inversion.isin && <span className="ml-2 font-mono uppercase">{inversion.isin}</span>}
              {cuenta && (
                <span className="ml-2 normal-case">
                  · custodiada en {cuenta.banco_nombre} — {cuenta.nombre}
                </span>
              )}
            </p>
          </div>
          <Link href="/inversiones" className="text-sm font-semibold text-ink-tertiary hover:text-ink">
            ← Volver a inversión
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <InfoCard
            label="Valor de mercado"
            value={formatEUR(valorMercado)}
            nota={`Actualizado el ${formatFecha(inversion.fecha_actualizacion)}`}
          />
          <InfoCard
            label="Aportado neto"
            value={hayLibro ? formatEUR(posicion.aportadoNeto) : "—"}
            nota={hayLibro ? undefined : "Sin operaciones registradas"}
          />
          <InfoCard
            label="Ganancia"
            value={hayLibro ? `${posicion.ganancia >= 0 ? "+" : ""}${formatEUR(posicion.ganancia)}` : "—"}
            clase={hayLibro ? (posicion.ganancia >= 0 ? "text-success" : "text-danger") : undefined}
            nota={
              posicion.rentabilidadSimple !== null
                ? `${formatPorcentaje(posicion.rentabilidadSimple, { signo: "siempre" })} sobre lo aportado`
                : undefined
            }
          />
          <InfoCard
            label="TIR anual"
            value={tir !== null ? formatPorcentaje(tir, { signo: "siempre" }) : "—"}
            clase={tir !== null ? (tir >= 0 ? "text-success" : "text-danger") : undefined}
            nota="Rentabilidad anualizada real"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <InfoCard
            label="Participaciones"
            value={
              posicion.participaciones !== 0
                ? posicion.participaciones.toLocaleString("es-ES", { maximumFractionDigits: 6 })
                : "—"
            }
          />
          <InfoCard
            label="Precio medio de compra"
            value={posicion.precioMedioCompra !== null ? formatPrecio(posicion.precioMedioCompra, moneda) : "—"}
            nota="Media ponderada de lo comprado"
          />
          <InfoCard
            label="Comisiones pagadas"
            value={hayLibro ? formatEUR(comisiones) : "—"}
            nota="Ya contadas dentro del aportado"
          />
          <InfoCard
            label="Rentabilidad anual asumida"
            value={rentabilidad !== null ? formatPorcentaje(rentabilidad, { decimales: 1 }) : "Sin definir"}
            nota="Supuesto, solo para proyectar"
          />
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
          <EvolucionInversionChart puntos={evolucion} moneda={moneda} />
        </div>

        <OperacionesInversion
          inversionId={inversion.id}
          operaciones={operaciones}
          moneda={moneda}
          hoy={hoy}
          registrarOperacion={registrarOperacion}
          eliminarOperacion={eliminarOperacion}
        />

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
                    <td className="px-4 py-3 text-ink-tertiary">
                      {v.origen === "automatico" ? "Precio del extracto" : "Manual"}
                    </td>
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
