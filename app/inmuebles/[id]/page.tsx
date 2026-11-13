import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { ConfirmForm } from "@/components/ConfirmForm";
import { createClient } from "@/lib/supabase/server";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { formatMonedaTabla as formatMoneda, formatPorcentaje } from "@/lib/formato";
import {
  costeTuParte,
  estadoHipoteca,
  etiquetaUso,
  rendimientoInmueble,
  revalorizacion,
  valorTuParte,
} from "@/lib/inmuebles";
import { btnPrimaryClass, cardClass, inputClass, labelClass, rowDelClass } from "@/components/formStyles";
import {
  actualizarInmueble,
  eliminarInmueble,
  eliminarValoracionInmueble,
  registrarValoracionInmueble,
  vincularMovimientosDeEtiqueta,
} from "../actions";
import { EditarFicha } from "../InmuebleForm";
import { movimientosPorInmueble } from "../datos";
import { FlujoMensualChart } from "./FlujoMensualChart";

function formatFecha(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

function Kpi({ label, valor, nota, tono }: { label: string; valor: string; nota?: string; tono?: "danger" | "success" }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <p className="text-xs text-ink-secondary">{label}</p>
      <p className={`mt-1.5 font-sora text-xl font-semibold ${tono === "danger" ? "text-danger" : tono === "success" ? "text-success" : "text-ink"}`}>
        {valor}
      </p>
      {nota && <p className="mt-1 text-[11px] text-ink-tertiary">{nota}</p>}
    </div>
  );
}

export default async function InmuebleDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inmueble } = await supabase.from("inmuebles").select("*").eq("id", id).maybeSingle();
  if (!inmueble) notFound();

  const [{ data: deudas }, { data: valoraciones }, { data: etiquetas }, config] = await Promise.all([
    supabase
      .from("deudas")
      .select("id, nombre, categoria_id, capital_inicial, capital_pendiente, cuota, tipo_interes, fecha_fin, valor_residual")
      .order("nombre"),
    supabase.from("inmueble_valoraciones").select("id, fecha, valor").eq("inmueble_id", id).order("fecha", { ascending: false }),
    supabase.from("etiquetas").select("id, nombre").order("nombre"),
    user ? obtenerConfiguracion(supabase, user.id) : null,
  ]);

  const moneda = config?.moneda_base ?? "EUR";
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const conSigno = (v: number) => `${v >= 0 ? "+" : "−"}${formatEUR(Math.abs(v))}`;
  const hoy = new Date().toISOString().slice(0, 10);

  const base = {
    valor_actual: inmueble.valor_actual === null ? null : Number(inmueble.valor_actual),
    porcentaje_propiedad: Number(inmueble.porcentaje_propiedad),
    precio_compra: inmueble.precio_compra === null ? null : Number(inmueble.precio_compra),
    gastos_compra: Number(inmueble.gastos_compra ?? 0),
  };
  const valor = valorTuParte(base);
  const coste = costeTuParte(base);
  const reval = revalorizacion(base);
  const parcial = base.porcentaje_propiedad < 100;

  const deuda = (deudas ?? []).find((d) => d.id === inmueble.deuda_id) ?? null;
  const hipoteca = deuda
    ? estadoHipoteca(
        {
          capital_inicial: Number(deuda.capital_inicial),
          capital_pendiente: Number(deuda.capital_pendiente),
          cuota: Number(deuda.cuota),
          tipo_interes: deuda.tipo_interes === null ? null : Number(deuda.tipo_interes),
          fecha_fin: deuda.fecha_fin,
          valor_residual: deuda.valor_residual === null ? null : Number(deuda.valor_residual),
        },
        hoy
      )
    : null;

  // Todo el histórico para la lista; el rendimiento ya se queda solo con los últimos 12 meses.
  const movimientos =
    (
      await movimientosPorInmueble(
        supabase,
        [{ id: inmueble.id, deuda_id: inmueble.deuda_id }],
        (deudas ?? []).map((d) => ({ id: d.id, categoria_id: d.categoria_id }))
      )
    ).get(inmueble.id) ?? [];
  const rendimiento = rendimientoInmueble(movimientos, valor, hipoteca, hoy);
  const capitalPropio = valor - (hipoteca?.pendiente ?? 0);

  const ficha = {
    id: inmueble.id,
    nombre: inmueble.nombre,
    uso: inmueble.uso,
    direccion: inmueble.direccion,
    superficie_m2: inmueble.superficie_m2 === null ? null : Number(inmueble.superficie_m2),
    fecha_compra: inmueble.fecha_compra,
    precio_compra: base.precio_compra,
    gastos_compra: base.gastos_compra,
    porcentaje_propiedad: base.porcentaje_propiedad,
    deuda_id: inmueble.deuda_id,
    fianza: inmueble.fianza === null ? null : Number(inmueble.fianza),
    ambito: inmueble.ambito,
    notas: inmueble.notas,
  };

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-sora text-[26px] font-bold text-ink">{inmueble.nombre}</h1>
            <p className="text-sm text-ink-tertiary">
              {etiquetaUso(inmueble.uso)}
              {inmueble.direccion && ` · ${inmueble.direccion}`}
              {inmueble.superficie_m2 && ` · ${Number(inmueble.superficie_m2).toLocaleString("es-ES")} m²`}
              {parcial && ` · tuyo al ${formatPorcentaje(base.porcentaje_propiedad, { decimales: 0 })}`}
            </p>
          </div>
          <Link href="/inmuebles" className="text-sm font-semibold text-ink-tertiary hover:text-ink">
            ← Volver a inmuebles
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Kpi
            label={parcial ? "Valor de tu parte" : "Valor"}
            valor={inmueble.valor_actual === null ? "Sin valorar" : formatEUR(valor)}
            nota={
              inmueble.fecha_valoracion
                ? `${parcial ? `Entero: ${formatEUR(Number(inmueble.valor_actual))} · ` : ""}valorado el ${formatFecha(inmueble.fecha_valoracion)}`
                : "Registra una valoración abajo."
            }
          />
          <Kpi
            label="Revalorización"
            valor={reval ? conSigno(reval.abs) : "—"}
            nota={reval && coste !== null ? `${reval.pct !== null ? `${formatPorcentaje(reval.pct, { signo: "siempre" })} sobre ` : "Sobre "}${formatEUR(coste)} de compra y gastos` : "Falta el precio de compra en la ficha."}
            tono={reval ? (reval.abs < 0 ? "danger" : "success") : undefined}
          />
          <Kpi label="Hipoteca pendiente" valor={hipoteca ? formatEUR(hipoteca.pendiente) : "—"} nota={deuda ? deuda.nombre : "Sin hipoteca enlazada."} />
          <Kpi label="Capital propio" valor={formatEUR(capitalPropio)} nota="Valor menos hipoteca: lo que suma al patrimonio con deuda." tono={capitalPropio < 0 ? "danger" : undefined} />
        </div>

        <section className={`${cardClass} space-y-5`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-sora text-base font-semibold text-ink">Cuánto te deja al mes</h2>
              <p className="text-[13px] text-ink-tertiary">
                Últimos 12 meses naturales
                {rendimiento.mesesConDatos > 0 && rendimiento.mesesConDatos < 12 && ` (con datos desde hace ${rendimiento.mesesConDatos} meses)`}.
                Las cuotas de la hipoteca entran solas por su categoría de pago.
              </p>
            </div>
            <p className={`font-sora text-2xl font-bold ${rendimiento.flujoMensual < 0 ? "text-danger" : "text-success"}`}>
              {rendimiento.mesesConDatos === 0 ? "—" : `${conSigno(rendimiento.flujoMensual)}/mes`}
            </p>
          </div>

          {rendimiento.mesesConDatos === 0 ? (
            <p className="text-sm text-ink-tertiary">
              Todavía no hay movimientos vinculados. Vincúlalos desde Movimientos («Vincular a un inmueble») o, si ya los
              tenías con una etiqueta, de una vez desde abajo.
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
                <div>
                  <dt className="text-xs text-ink-tertiary">Ingresos</dt>
                  <dd className="font-semibold text-success">{formatEUR(rendimiento.ingresos)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-tertiary">Gastos</dt>
                  <dd className="font-semibold text-ink">{rendimiento.gastos > 0 ? "−" : ""}{formatEUR(rendimiento.gastos)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-tertiary">Cuotas hipoteca</dt>
                  <dd className="font-semibold text-ink">{rendimiento.cuotas > 0 ? "−" : ""}{formatEUR(rendimiento.cuotas)}</dd>
                  {rendimiento.interesesEstimados > 0 && (
                    <dd className="text-[11px] text-ink-tertiary">≈ {formatEUR(rendimiento.interesesEstimados)} de intereses</dd>
                  )}
                </div>
                <div>
                  <dt className="text-xs text-ink-tertiary">Rentabilidad bruta</dt>
                  <dd className="font-semibold text-ink">
                    {rendimiento.rentabilidadBruta === null ? "—" : formatPorcentaje(rendimiento.rentabilidadBruta)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-tertiary">Rentabilidad neta</dt>
                  <dd className="font-semibold text-ink">
                    {rendimiento.rentabilidadNeta === null ? "—" : formatPorcentaje(rendimiento.rentabilidadNeta)}
                  </dd>
                </div>
              </dl>
              <FlujoMensualChart meses={rendimiento.meses} moneda={moneda} />
              <p className="text-[11px] text-ink-tertiary">
                Rentabilidad sobre el valor de tu parte, anualizada. La neta descuenta gastos e intereses, pero no el capital
                que amortizas: ese dinero no se pierde, pasa de deuda a patrimonio. Los intereses se estiman con el reparto
                de la cuota actual.
              </p>
            </>
          )}
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {hipoteca && deuda && (
            <section className={`${cardClass} space-y-4`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-sora text-base font-semibold text-ink">Así va tu hipoteca</h2>
                <Link href={`/deudas/${deuda.id}`} className="text-[13px] font-semibold text-accent hover:underline">
                  Ver deuda →
                </Link>
              </div>
              <div>
                <div className="flex justify-between text-xs text-ink-tertiary">
                  <span>{formatPorcentaje(hipoteca.pctDevuelto, { decimales: 1 })} devuelto</span>
                  <span>quedan {formatEUR(hipoteca.pendiente)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-chip">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${hipoteca.pctDevuelto}%` }} />
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-ink-tertiary">Cuota</dt>
                  <dd className="font-semibold text-ink">{formatEUR(hipoteca.cuota)}</dd>
                  {hipoteca.tin !== null && (
                    <dd className="text-[11px] text-ink-tertiary">
                      {formatEUR(hipoteca.interesCuota)} intereses · {formatEUR(hipoteca.capitalCuota)} capital
                    </dd>
                  )}
                </div>
                <div>
                  <dt className="text-xs text-ink-tertiary">Tipo de interés</dt>
                  <dd className="font-semibold text-ink">{hipoteca.tin === null ? "—" : formatPorcentaje(hipoteca.tin, { decimales: 2 })}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-tertiary">Fin</dt>
                  <dd className="font-semibold text-ink">{hipoteca.fechaFin ? formatFecha(hipoteca.fechaFin) : "—"}</dd>
                  {hipoteca.mesesRestantes !== null && (
                    <dd className="text-[11px] text-ink-tertiary">
                      {Math.floor(hipoteca.mesesRestantes / 12)} años y {hipoteca.mesesRestantes % 12} meses
                    </dd>
                  )}
                </div>
                <div>
                  <dt className="text-xs text-ink-tertiary">Préstamo inicial</dt>
                  <dd className="font-semibold text-ink">{formatEUR(Number(deuda.capital_inicial))}</dd>
                </div>
              </dl>
            </section>
          )}

          <section className={`${cardClass} space-y-4`}>
            <h2 className="font-sora text-base font-semibold text-ink">Valoraciones</h2>
            <p className="text-[13px] text-ink-tertiary">
              El valor del inmueble entero. Un tasador, un portal inmobiliario o el precio de pisos parecidos en la zona
              valen; actualízalo una o dos veces al año.
            </p>
            <form action={registrarValoracionInmueble} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <input type="hidden" name="inmueble_id" value={inmueble.id} />
              <div>
                <label className={labelClass}>Fecha</label>
                <input name="fecha" type="date" defaultValue={hoy} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Valor</label>
                <input name="valor" type="number" step="0.01" min="0" required placeholder="Al 100 %" className={inputClass} />
              </div>
              <button type="submit" className={btnPrimaryClass}>
                Registrar
              </button>
            </form>
            {(valoraciones ?? []).length > 0 && (
              <ul className="divide-y divide-border text-sm">
                {(valoraciones ?? []).map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-ink-tertiary">{formatFecha(v.fecha)}</span>
                    <span className="ml-auto font-semibold text-ink">{formatEUR(Number(v.valor))}</span>
                    <ConfirmForm action={eliminarValoracionInmueble} mensaje={`¿Borrar la valoración del ${formatFecha(v.fecha)}?`} className="inline">
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="inmueble_id" value={inmueble.id} />
                      <button type="submit" className={rowDelClass}>
                        Borrar
                      </button>
                    </ConfirmForm>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className={`${cardClass} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-sora text-base font-semibold text-ink">Movimientos del inmueble</h2>
            {(etiquetas ?? []).length > 0 && (
              <form action={vincularMovimientosDeEtiqueta} className="flex flex-wrap items-center gap-2 text-[13px]">
                <input type="hidden" name="inmueble_id" value={inmueble.id} />
                <span className="text-ink-tertiary">Vincular los de la etiqueta</span>
                <select name="etiqueta_id" required defaultValue="" className="rounded-btn border border-border-strong bg-field px-2 py-1 text-[13px]">
                  <option value="" disabled>
                    Elegir…
                  </option>
                  {(etiquetas ?? []).map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
                <button type="submit" className="font-semibold text-accent hover:underline">
                  Vincular
                </button>
              </form>
            )}
          </div>
          {movimientos.length === 0 ? (
            <p className="text-sm text-ink-tertiary">Ninguno todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-ink-tertiary">
                    <th className="px-3 py-2 font-semibold">Fecha</th>
                    <th className="px-3 py-2 font-semibold">Descripción</th>
                    <th className="px-3 py-2 font-semibold">Categoría</th>
                    <th className="px-3 py-2 text-right font-semibold">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.slice(0, 100).map((m) => (
                    <tr key={m.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2.5 text-ink-tertiary">{formatFecha(m.fecha)}</td>
                      <td className="px-3 py-2.5 text-ink">
                        {m.descripcion}
                        {m.esCuotaHipoteca && (
                          <span className="ml-2 rounded-full bg-chip px-2 py-0.5 text-[11px] text-ink-secondary">Cuota hipoteca</span>
                        )}
                        {m.cuenta && <span className="block text-[11px] text-ink-tertiary">{m.cuenta}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-ink-secondary">{m.categoria ?? "—"}</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums ${m.importe < 0 ? "text-ink" : "text-success"}`}>
                        {formatEUR(m.importe)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {movimientos.length > 100 && <p className="mt-2 text-xs text-ink-tertiary">Se muestran los 100 más recientes.</p>}
            </div>
          )}
        </section>

        <section className="space-y-4">
          {(ficha.fianza !== null || ficha.notas || ficha.fecha_compra) && (
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              {ficha.fecha_compra && (
                <div>
                  <dt className="text-xs text-ink-tertiary">Comprado</dt>
                  <dd className="text-ink">
                    {formatFecha(ficha.fecha_compra)}
                    {ficha.precio_compra !== null && ` por ${formatEUR(ficha.precio_compra)}`}
                  </dd>
                </div>
              )}
              {ficha.fianza !== null && (
                <div>
                  <dt className="text-xs text-ink-tertiary">Fianza cobrada</dt>
                  <dd className="text-ink">{formatEUR(ficha.fianza)} (a devolver; no suma al patrimonio)</dd>
                </div>
              )}
              {ficha.notas && (
                <div className="col-span-2">
                  <dt className="text-xs text-ink-tertiary">Notas</dt>
                  <dd className="text-ink">{ficha.notas}</dd>
                </div>
              )}
            </dl>
          )}
          <div className="flex flex-wrap items-start gap-3">
            <EditarFicha action={actualizarInmueble} ficha={ficha} deudas={(deudas ?? []).map((d) => ({ id: d.id, nombre: d.nombre }))} />
            <ConfirmForm
              action={eliminarInmueble}
              mensaje={`¿Eliminar "${inmueble.nombre}" y sus valoraciones? Los movimientos se quedan, solo pierden el vínculo. No se puede deshacer.`}
              className="inline"
            >
              <input type="hidden" name="id" value={inmueble.id} />
              <button type="submit" className="px-2 py-2.5 text-sm font-semibold text-faint hover:text-danger">
                Eliminar inmueble
              </button>
            </ConfirmForm>
          </div>
        </section>
      </main>
    </>
  );
}
