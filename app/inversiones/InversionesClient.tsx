"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ConfirmForm } from "@/components/ConfirmForm";
import { formatMoneda } from "@/lib/formato";
import { tableWrapClass, rowLinkClass, rowDelClass, inputClass } from "@/components/formStyles";
import { InversionForm, type InversionParaEditar, type PrevistoInversionOption } from "./InversionForm";

type Inversion = {
  id: string;
  tipo_activo: string;
  nombre: string;
  valor_actual: number;
  fecha_actualizacion: string;
  es_recurrente: boolean;
  movimiento_previsto_id: string | null;
  rentabilidad_anual_asumida: number | null;
};

function formatFecha(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

export function InversionesClient({
  inversiones,
  moneda,
  previstosInversion,
  registrarValoracionInversion,
  editarInversion,
  eliminarInversion,
}: {
  inversiones: Inversion[];
  moneda: string;
  previstosInversion: PrevistoInversionOption[];
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
            <th className="px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Tipo</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Nombre</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Valor actual</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Actualizado</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Recurrente</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {inversiones.map((inv) => (
            <Fragment key={inv.id}>
              <tr className="border-t border-border">
                <td className="whitespace-nowrap px-4 py-3 capitalize text-ink-secondary">{inv.tipo_activo.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">
                  <Link href={`/inversiones/${inv.id}`} className={rowLinkClass}>
                    {inv.nombre}
                  </Link>
                </td>
                <td className="px-4 py-3">
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
                    <button type="submit" className="rounded-btn border border-border-strong px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-chip">
                      Guardar
                    </button>
                  </form>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-tertiary">{formatFecha(inv.fecha_actualizacion)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {inv.es_recurrente ? (
                    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">Sí</span>
                  ) : (
                    <span className="text-ink-tertiary">No</span>
                  )}
                </td>
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
                    mensaje={`¿Seguro que quieres eliminar la inversión "${inv.nombre}"? Esta acción no se puede deshacer.`}
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
                  <td colSpan={6} className="px-5 py-5">
                    <InversionForm
                      action={editarInversion}
                      previstosInversion={previstosInversion}
                      inversion={
                        {
                          id: inv.id,
                          tipo_activo: inv.tipo_activo,
                          nombre: inv.nombre,
                          es_recurrente: inv.es_recurrente,
                          movimiento_previsto_id: inv.movimiento_previsto_id,
                          rentabilidad_anual_asumida: inv.rentabilidad_anual_asumida,
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
              <td colSpan={6} className="px-4 py-6 text-center text-ink-tertiary">
                Todavía no has dado de alta ninguna inversión.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
