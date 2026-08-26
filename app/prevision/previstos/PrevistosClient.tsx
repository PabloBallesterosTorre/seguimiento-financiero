"use client";

import { ConfirmForm } from "@/components/ConfirmForm";
import { formatMoneda } from "@/lib/formato";
import { ordenarFilas, type OrdenTabla } from "@/lib/ordenTabla";
import { useOrdenTabla, ThOrdenable } from "@/components/OrdenTabla";

export type FilaPrevisto = {
  id: string;
  descripcion: string;
  tipo: string;
  categoriaNombre: string;
  importe: number;
  recurrenciaLabel: string;
  estado: "activo" | "pausado";
  esMedia: boolean;
};

export function PrevistosClient({
  filas,
  moneda,
  cambiarEstadoPrevisto,
  eliminarMovimientoPrevisto,
  ordenInicial = null,
}: {
  filas: FilaPrevisto[];
  moneda: string;
  cambiarEstadoPrevisto: (formData: FormData) => void;
  eliminarMovimientoPrevisto: (formData: FormData) => void;
  ordenInicial?: OrdenTabla;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const { orden, toggle } = useOrdenTabla("movimientos_previstos", ordenInicial);

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
            <tr key={p.id} className="border-t border-slate-100">
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
              <td className="px-4 py-2 text-right">
                <ConfirmForm
                  action={eliminarMovimientoPrevisto}
                  mensaje={`¿Seguro que quieres eliminar la previsión "${p.descripcion}"? Esta acción no se puede deshacer.`}
                >
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-slate-400 hover:text-red-600" type="submit">
                    Eliminar
                  </button>
                </ConfirmForm>
              </td>
            </tr>
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
