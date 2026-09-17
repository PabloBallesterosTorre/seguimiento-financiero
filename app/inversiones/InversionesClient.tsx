"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ConfirmForm } from "@/components/ConfirmForm";
import { formatMonedaTabla, formatPorcentaje, formatPrecio } from "@/lib/formato";
import { tableWrapClass, rowLinkClass, rowDelClass, inputClass } from "@/components/formStyles";
import {
  InversionForm,
  type InversionParaEditar,
  type PrevistoInversionOption,
  type CuentaOption,
} from "./InversionForm";

export type InversionEnListado = {
  id: string;
  tipo_activo: string;
  nombre: string;
  isin: string | null;
  cuenta_id: string | null;
  valor_actual: number;
  fecha_actualizacion: string;
  es_recurrente: boolean;
  movimiento_previsto_id: string | null;
  rentabilidad_anual_asumida: number | null;
  // Derivados del libro de operaciones, calculados en el servidor.
  participaciones: number;
  aportadoNeto: number;
  precioMedioCompra: number | null;
  ganancia: number;
  rentabilidadSimple: number | null;
  peso: number;
  operaciones: number;
};

function formatFecha(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

function formatParticipaciones(v: number) {
  // Muchas posiciones son fracciones muy pequeñas (0,079233 de un fondo): cortar a dos
  // decimales las dejaría todas en "0,08". Se recortan los ceros sobrantes por la derecha
  // para que una posición de 5 participaciones no se lea "5,000000".
  return v.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 6 });
}

// Las cifras van con `tabular-nums` para que los dígitos ocupen todos lo mismo y las
// columnas de importes queden alineadas de verdad, no solo justificadas a la derecha.
const celdaNumero = "whitespace-nowrap px-4 py-3 text-right tabular-nums";

export function InversionesClient({
  inversiones,
  moneda,
  previstosInversion,
  cuentas,
  registrarValoracionInversion,
  editarInversion,
  eliminarInversion,
}: {
  inversiones: InversionEnListado[];
  moneda: string;
  previstosInversion: PrevistoInversionOption[];
  cuentas: CuentaOption[];
  registrarValoracionInversion: (formData: FormData) => void;
  editarInversion: (formData: FormData) => void;
  eliminarInversion: (formData: FormData) => void;
}) {
  const formatEUR = (v: number) => formatMonedaTabla(v, moneda);
  const [editando, setEditando] = useState<string | null>(null);

  const totalAportado = inversiones.reduce((s, i) => s + (i.operaciones > 0 ? i.aportadoNeto : 0), 0);
  const totalValor = inversiones.reduce((s, i) => s + i.valor_actual, 0);
  const totalGanancia = totalValor - totalAportado;

  const formularioEdicion = (inv: InversionEnListado) => (
    <InversionForm
      action={editarInversion}
      previstosInversion={previstosInversion}
      cuentas={cuentas}
      inversion={
        {
          id: inv.id,
          tipo_activo: inv.tipo_activo,
          nombre: inv.nombre,
          es_recurrente: inv.es_recurrente,
          movimiento_previsto_id: inv.movimiento_previsto_id,
          rentabilidad_anual_asumida: inv.rentabilidad_anual_asumida,
          isin: inv.isin,
          cuenta_id: inv.cuenta_id,
        } satisfies InversionParaEditar
      }
      onGuardado={() => setEditando(null)}
    />
  );

  const campoValor = (inv: InversionEnListado) => (
    <form action={registrarValoracionInversion} className="flex items-center gap-2">
      <input type="hidden" name="id" value={inv.id} />
      {/* `min-w-[6.5rem]` además de la anchura: dentro de una tabla el navegador encoge los
          inputs hasta dejarlos inservibles — este acababa renderizado a 26 px, con el valor
          dentro pero ilegible (auditoría de diseño, tanda 11). */}
      <input
        name="valor_actual"
        type="number"
        step="0.01"
        min="0"
        aria-label={`Valor actual de ${inv.nombre}`}
        defaultValue={Number(inv.valor_actual)}
        className={`${inputClass} w-28 min-w-[6.5rem] py-1.5 text-right tabular-nums`}
      />
      <button
        type="submit"
        className="rounded-btn border border-border-strong px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-chip"
      >
        Guardar
      </button>
    </form>
  );

  if (inversiones.length === 0) {
    return (
      <div className={`${tableWrapClass} px-4 py-6 text-center text-ink-tertiary`}>
        Todavía no has dado de alta ninguna inversión.
      </div>
    );
  }

  return (
    <>
      {/* ---------- Móvil: una tarjeta por posición ---------- */}
      {/* La tabla mide 887 px y en un móvil vive en 333: arrastrarse por ocho columnas para
          leer una posición no es usable. Por debajo de `md` cada posición es una tarjeta. */}
      <div className="space-y-3 md:hidden">
        {inversiones.map((inv) => (
          <div key={inv.id} className="rounded-card border border-border bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/inversiones/${inv.id}`} className={`block truncate ${rowLinkClass}`} title={inv.nombre}>
                  {inv.nombre}
                </Link>
                <p className="mt-0.5 truncate text-[11px] capitalize text-ink-tertiary">
                  {inv.tipo_activo.replace(/_/g, " ")}
                  {inv.isin && <span className="ml-1.5 font-mono uppercase">{inv.isin}</span>}
                </p>
              </div>
              <p className="shrink-0 text-right font-sora text-lg font-bold tabular-nums text-ink">
                {formatEUR(inv.valor_actual)}
              </p>
            </div>

            {inv.operaciones > 0 && (
              <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px]">
                <span className={`font-semibold tabular-nums ${inv.ganancia >= 0 ? "text-success" : "text-danger"}`}>
                  {inv.ganancia >= 0 ? "+" : ""}
                  {formatEUR(inv.ganancia)}
                </span>
                {inv.rentabilidadSimple !== null && (
                  <span className="tabular-nums text-ink-tertiary">
                    {formatPorcentaje(inv.rentabilidadSimple, { decimales: 1, signo: "siempre" })}
                  </span>
                )}
                <span className="tabular-nums text-ink-tertiary">
                  Aportado {formatEUR(inv.aportadoNeto)}
                </span>
              </div>
            )}

            <div className="mt-3 border-t border-border pt-3">{campoValor(inv)}</div>

            <div className="mt-3 flex items-center gap-4">
              <button type="button" onClick={() => setEditando(editando === inv.id ? null : inv.id)} className={rowLinkClass}>
                {editando === inv.id ? "Cerrar" : "Editar"}
              </button>
              <ConfirmForm
                action={eliminarInversion}
                mensaje={`¿Seguro que quieres eliminar la inversión "${inv.nombre}"? Se borrarán también sus ${inv.operaciones} operaciones y todo su histórico de valoraciones. Esta acción no se puede deshacer.`}
                className="inline"
              >
                <input type="hidden" name="id" value={inv.id} />
                <button className={rowDelClass} type="submit">
                  Eliminar
                </button>
              </ConfirmForm>
            </div>

            {editando === inv.id && <div className="mt-4">{formularioEdicion(inv)}</div>}
          </div>
        ))}

        <div className="rounded-card border border-border bg-chip px-4 py-3 text-[13px]">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-ink">Total</span>
            <span className="font-sora text-base font-bold tabular-nums text-ink">{formatEUR(totalValor)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-ink-tertiary">
            <span>Aportado {formatEUR(totalAportado)}</span>
            <span className={`font-semibold tabular-nums ${totalGanancia >= 0 ? "text-success" : "text-danger"}`}>
              {totalGanancia >= 0 ? "+" : ""}
              {formatEUR(totalGanancia)}
            </span>
          </div>
        </div>
      </div>

      {/* ---------- Escritorio: tabla ---------- */}
      <div className={`hidden md:block ${tableWrapClass}`}>
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col />
            <col className="w-[13%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[20%]" />
            <col className="w-[13%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Posición</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Particip.</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Precio medio</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Aportado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Valor</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Ganancia</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Peso</th>
            </tr>
          </thead>
          <tbody>
            {inversiones.map((inv) => (
              <Fragment key={inv.id}>
                <tr className="group border-t border-border align-top">
                  <td className="px-4 py-3">
                    {/* Truncado con el nombre completo en `title`: los nombres legales del
                        extracto ("SSGA SPDR ETFs Europe I plc - State Street SPDR MSCI All
                        Country World...") ocupaban cinco líneas y hacían filas de 208 px. */}
                    <Link
                      href={`/inversiones/${inv.id}`}
                      title={inv.nombre}
                      className={`block truncate ${rowLinkClass}`}
                    >
                      {inv.nombre}
                    </Link>
                    <p className="mt-0.5 truncate text-[11px] capitalize text-ink-tertiary">
                      {inv.tipo_activo.replace(/_/g, " ")}
                      {inv.isin && <span className="ml-1.5 font-mono uppercase">{inv.isin}</span>}
                      {inv.es_recurrente && <span className="ml-1.5 font-semibold text-accent">· recurrente</span>}
                    </p>
                    {/* Las acciones aparecen al señalar la fila. Con siete posiciones no
                        molestan, pero el patrón es el mismo que en Movimientos, donde
                        "Eliminar" se repetía 98 veces con peso completo. */}
                    <div className="mt-1.5 flex items-center gap-3 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setEditando(editando === inv.id ? null : inv.id)}
                        className={rowLinkClass}
                      >
                        {editando === inv.id ? "Cerrar" : "Editar"}
                      </button>
                      <ConfirmForm
                        action={eliminarInversion}
                        mensaje={`¿Seguro que quieres eliminar la inversión "${inv.nombre}"? Se borrarán también sus ${inv.operaciones} operaciones y todo su histórico de valoraciones. Esta acción no se puede deshacer.`}
                        className="inline"
                      >
                        <input type="hidden" name="id" value={inv.id} />
                        <button className={rowDelClass} type="submit">
                          Eliminar
                        </button>
                      </ConfirmForm>
                    </div>
                  </td>
                  <td className={`${celdaNumero} text-ink-secondary`}>
                    {inv.participaciones !== 0 ? formatParticipaciones(inv.participaciones) : "—"}
                  </td>
                  <td className={`${celdaNumero} text-ink-secondary`}>
                    {inv.precioMedioCompra !== null ? formatPrecio(inv.precioMedioCompra, moneda) : "—"}
                  </td>
                  <td className={`${celdaNumero} text-ink-secondary`}>
                    {inv.operaciones > 0 ? formatEUR(inv.aportadoNeto) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {campoValor(inv)}
                    <p className="mt-1 text-[11px] text-ink-tertiary">{formatFecha(inv.fecha_actualizacion)}</p>
                  </td>
                  <td className={celdaNumero}>
                    {inv.operaciones > 0 ? (
                      <>
                        <span className={`font-semibold ${inv.ganancia >= 0 ? "text-success" : "text-danger"}`}>
                          {inv.ganancia >= 0 ? "+" : ""}
                          {formatEUR(inv.ganancia)}
                        </span>
                        {inv.rentabilidadSimple !== null && (
                          <p className="text-[11px] text-ink-tertiary">
                            {formatPorcentaje(inv.rentabilidadSimple, { decimales: 1, signo: "siempre" })}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-ink-tertiary">—</span>
                    )}
                  </td>
                  <td className={`${celdaNumero} text-ink-tertiary`}>
                    {formatPorcentaje(inv.peso, { decimales: 1 })}
                  </td>
                </tr>
                {editando === inv.id && (
                  <tr className="border-t border-border bg-page">
                    <td colSpan={7} className="px-5 py-5">
                      {formularioEdicion(inv)}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-strong bg-chip/60">
              <td className="px-4 py-3 text-sm font-semibold text-ink">Total</td>
              <td />
              <td />
              <td className={`${celdaNumero} font-semibold text-ink`}>{formatEUR(totalAportado)}</td>
              <td className="whitespace-nowrap px-4 py-3 font-sora text-base font-bold tabular-nums text-ink">
                {formatEUR(totalValor)}
              </td>
              <td className={`${celdaNumero} font-semibold ${totalGanancia >= 0 ? "text-success" : "text-danger"}`}>
                {totalGanancia >= 0 ? "+" : ""}
                {formatEUR(totalGanancia)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
