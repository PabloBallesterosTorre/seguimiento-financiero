"use client";

import Link from "next/link";
import { ConfirmForm } from "@/components/ConfirmForm";
import { formatMoneda } from "@/lib/formato";
import { ordenarFilas, type OrdenTabla } from "@/lib/ordenTabla";
import { useOrdenTabla, ThOrdenable } from "@/components/OrdenTabla";

type Deuda = {
  id: string;
  tipo: string;
  nombre: string;
  capital_pendiente: number;
  cuota: number;
  tipo_interes: number | null;
};

export function DeudasClient({
  deudas,
  moneda,
  eliminarDeuda,
  ordenInicial = null,
}: {
  deudas: Deuda[];
  moneda: string;
  eliminarDeuda: (formData: FormData) => void;
  ordenInicial?: OrdenTabla;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const { orden, toggle } = useOrdenTabla("deudas", ordenInicial);

  const deudasOrdenadas = ordenarFilas(deudas, orden, {
    tipo: (d) => d.tipo,
    nombre: (d) => d.nombre,
    pendiente: (d) => Number(d.capital_pendiente),
    cuota: (d) => Number(d.cuota),
    interes: (d) => (d.tipo_interes !== null ? Number(d.tipo_interes) : null),
  });

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <ThOrdenable columna="tipo" orden={orden} onToggle={toggle}>Tipo</ThOrdenable>
            <ThOrdenable columna="nombre" orden={orden} onToggle={toggle}>Nombre</ThOrdenable>
            <ThOrdenable columna="pendiente" orden={orden} onToggle={toggle} align="right">Pendiente</ThOrdenable>
            <ThOrdenable columna="cuota" orden={orden} onToggle={toggle} align="right">Cuota</ThOrdenable>
            <ThOrdenable columna="interes" orden={orden} onToggle={toggle} align="right">Interés</ThOrdenable>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {deudasOrdenadas.map((deuda) => (
            <tr key={deuda.id} className="border-t border-slate-100">
              <td className="px-4 py-2 capitalize">{deuda.tipo}</td>
              <td className="px-4 py-2">
                <Link href={`/deudas/${deuda.id}`} className="underline hover:text-slate-900">
                  {deuda.nombre}
                </Link>
              </td>
              <td className="px-4 py-2 text-right">{formatEUR(Number(deuda.capital_pendiente))}</td>
              <td className="px-4 py-2 text-right">{formatEUR(Number(deuda.cuota))}</td>
              <td className="px-4 py-2 text-right text-slate-500">
                {deuda.tipo_interes !== null ? `${deuda.tipo_interes}%` : "—"}
              </td>
              <td className="px-4 py-2 text-right">
                <ConfirmForm
                  action={eliminarDeuda}
                  mensaje={`¿Seguro que quieres eliminar la deuda "${deuda.nombre}"? Esta acción no se puede deshacer.`}
                >
                  <input type="hidden" name="id" value={deuda.id} />
                  <button className="text-slate-400 hover:text-red-600" type="submit">
                    Eliminar
                  </button>
                </ConfirmForm>
              </td>
            </tr>
          ))}
          {deudasOrdenadas.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                Todavía no has dado de alta ninguna deuda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
