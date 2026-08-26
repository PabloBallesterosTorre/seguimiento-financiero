"use client";

import { Fragment, useState } from "react";
import { ConfirmForm } from "@/components/ConfirmForm";
import { MovimientoPrevistoForm } from "./MovimientoPrevistoForm";
import { formatMoneda } from "@/lib/formato";
import { ordenarFilas, type OrdenTabla } from "@/lib/ordenTabla";
import { useOrdenTabla, ThOrdenable } from "@/components/OrdenTabla";
import type { CategoriaJerarquica } from "@/lib/categorias";

type Cuenta = { id: string; nombre: string; banco_nombre: string };

export type FilaPrevisto = {
  id: string;
  descripcion: string;
  tipo: "gasto" | "ingreso" | "traspaso";
  categoriaNombre: string;
  categoria_id: string | null;
  cuenta_id: string | null;
  importe: number;
  importe_estimado: number;
  importe_min: number | null;
  importe_max: number | null;
  recurrenciaLabel: string;
  tipo_recurrencia: "unica_vez" | "recurrente";
  periodicidad: string | null;
  fecha: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: "activo" | "pausado";
  esMedia: boolean;
};

export function PrevistosClient({
  filas,
  moneda,
  categorias,
  cuentas,
  hoy,
  cambiarEstadoPrevisto,
  actualizarMovimientoPrevisto,
  eliminarMovimientoPrevisto,
  ordenInicial = null,
}: {
  filas: FilaPrevisto[];
  moneda: string;
  categorias: CategoriaJerarquica[];
  cuentas: Cuenta[];
  hoy: string;
  cambiarEstadoPrevisto: (formData: FormData) => void;
  actualizarMovimientoPrevisto: (formData: FormData) => void;
  eliminarMovimientoPrevisto: (formData: FormData) => void;
  ordenInicial?: OrdenTabla;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const { orden, toggle } = useOrdenTabla("movimientos_previstos", ordenInicial);
  const [editando, setEditando] = useState<string | null>(null);

  const filasOrdenadas = ordenarFilas(filas, orden, {
    descripcion: (f) => f.descripcion,
    tipo: (f) => f.tipo,
    categoria: (f) => f.categoriaNombre,
    importe: (f) => f.importe,
    recurrencia: (f) => f.recurrenciaLabel,
    estado: (f) => f.estado,
  });

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <ThOrdenable columna="descripcion" orden={orden} onToggle={toggle}>Descripción</ThOrdenable>
            <ThOrdenable columna="tipo" orden={orden} onToggle={toggle}>Tipo</ThOrdenable>
            <ThOrdenable columna="categoria" orden={orden} onToggle={toggle}>Categoría</ThOrdenable>
            <ThOrdenable columna="importe" orden={orden} onToggle={toggle} align="right">Importe</ThOrdenable>
            <ThOrdenable columna="recurrencia" orden={orden} onToggle={toggle}>Recurrencia</ThOrdenable>
            <ThOrdenable columna="estado" orden={orden} onToggle={toggle}>Estado</ThOrdenable>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {filasOrdenadas.map((p) => (
            <Fragment key={p.id}>
              <tr className="border-t border-slate-100">
                <td className="px-4 py-2">
                  {p.descripcion}
                  {p.esMedia && (
                    <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                      Media
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 capitalize">{p.tipo}</td>
                <td className="px-4 py-2 text-slate-500">{p.categoriaNombre}</td>
                <td className="px-4 py-2 text-right">{formatEUR(p.importe)}</td>
                <td className="px-4 py-2 text-slate-500">{p.recurrenciaLabel}</td>
                <td className="px-4 py-2">
                  <form action={cambiarEstadoPrevisto} className="inline">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="estado" value={p.estado === "activo" ? "pausado" : "activo"} />
                    <button
                      type="submit"
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.estado === "activo" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {p.estado === "activo" ? "Activo" : "Pausado"}
                    </button>
                  </form>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setEditando(editando === p.id ? null : p.id)}
                    className="mr-3 text-slate-500 hover:text-slate-900"
                  >
                    Editar
                  </button>
                  <ConfirmForm
                    action={eliminarMovimientoPrevisto}
                    mensaje={`¿Seguro que quieres eliminar la previsión "${p.descripcion}"? Esta acción no se puede deshacer.`}
                    className="inline"
                  >
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-slate-400 hover:text-red-600" type="submit">
                      Eliminar
                    </button>
                  </ConfirmForm>
                </td>
              </tr>
              {editando === p.id && (
                <tr className="border-t border-slate-100 bg-slate-50">
                  <td colSpan={7} className="px-4 py-4">
                    <MovimientoPrevistoForm
                      action={async (formData) => {
                        await actualizarMovimientoPrevisto(formData);
                        setEditando(null);
                      }}
                      categorias={categorias}
                      cuentas={cuentas}
                      hoy={hoy}
                      previsto={{
                        id: p.id,
                        descripcion: p.descripcion,
                        tipo: p.tipo,
                        categoria_id: p.categoria_id,
                        cuenta_id: p.cuenta_id,
                        importe_estimado: p.importe_estimado,
                        importe_min: p.importe_min,
                        importe_max: p.importe_max,
                        tipo_recurrencia: p.tipo_recurrencia,
                        periodicidad: p.periodicidad,
                        fecha: p.fecha,
                        fecha_inicio: p.fecha_inicio,
                        fecha_fin: p.fecha_fin,
                      }}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {filasOrdenadas.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                Todavía no hay movimientos previstos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
