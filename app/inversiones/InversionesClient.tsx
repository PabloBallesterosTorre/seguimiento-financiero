"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ConfirmForm } from "@/components/ConfirmForm";
import { formatMoneda } from "@/lib/formato";
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
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className={tableWrapClass}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Posición</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Participaciones</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Precio medio</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Aportado</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Valor</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Ganancia</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">Peso</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {inversiones.map((inv) => (
            <Fragment key={inv.id}>
              <tr className="border-t border-border align-top">
                <td className="px-4 py-3">
                  <Link href={`/inversiones/${inv.id}`} className={rowLinkClass}>
                    {inv.nombre}
                  </Link>
                  <p className="mt-0.5 text-[11px] capitalize text-ink-tertiary">
                    {inv.tipo_activo.replace(/_/g, " ")}
                    {inv.isin && <span className="ml-1.5 font-mono uppercase">{inv.isin}</span>}
                    {inv.es_recurrente && <span className="ml-1.5 font-semibold text-accent">· recurrente</span>}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-ink-secondary">
                  {inv.participaciones !== 0 ? formatParticipaciones(inv.participaciones) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-ink-secondary">
                  {inv.precioMedioCompra !== null ? formatEUR(inv.precioMedioCompra) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-ink-secondary">
                  {inv.operaciones > 0 ? formatEUR(inv.aportadoNeto) : "—"}
                </td>
                <td className="px-4 py-3">
                  {/* La edición rápida del valor sigue aquí para las inversiones sin libro
                      de operaciones (un depósito, algo custodiado fuera). Cuando la posición
                      se alimenta de operaciones, el valor lo calcula la app y teclearlo a
                      mano es la excepción, no lo normal. */}
                  <form action={registrarValoracionInversion} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={inv.id} />
                    <input
                      name="valor_actual"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={Number(inv.valor_actual)}
                      className={`${inputClass} w-28 py-1.5`}
                    />
                    <button
                      type="submit"
                      className="rounded-btn border border-border-strong px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-chip"
                    >
                      Guardar
                    </button>
                  </form>
                  <p className="mt-1 text-[11px] text-ink-tertiary">{formatFecha(inv.fecha_actualizacion)}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {inv.operaciones > 0 ? (
                    <>
                      <span className={`font-semibold ${inv.ganancia >= 0 ? "text-success" : "text-danger"}`}>
                        {inv.ganancia >= 0 ? "+" : ""}
                        {formatEUR(inv.ganancia)}
                      </span>
                      {inv.rentabilidadSimple !== null && (
                        <p className="text-[11px] text-ink-tertiary">
                          {inv.rentabilidadSimple >= 0 ? "+" : ""}
                          {inv.rentabilidadSimple.toFixed(1)}%
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-ink-tertiary">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-ink-tertiary">{inv.peso.toFixed(1)}%</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setEditando(editando === inv.id ? null : inv.id)}
                    className={`mr-3.5 ${rowLinkClass}`}
                  >
                    Editar
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
                </td>
              </tr>
              {editando === inv.id && (
                <tr className="border-t border-border bg-page">
                  <td colSpan={8} className="px-5 py-5">
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
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {inversiones.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-6 text-center text-ink-tertiary">
                Todavía no has dado de alta ninguna inversión.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
