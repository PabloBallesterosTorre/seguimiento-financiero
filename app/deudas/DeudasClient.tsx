"use client";

import Link from "next/link";
import { ConfirmForm } from "@/components/ConfirmForm";
import { formatMonedaTabla, formatPorcentaje } from "@/lib/formato";
import { ordenarFilas, type OrdenTabla } from "@/lib/ordenTabla";
import { useOrdenTabla, ThOrdenable } from "@/components/OrdenTabla";
import { tableWrapClass, rowDelClass } from "@/components/formStyles";

type Deuda = {
  id: string;
  tipo: string;
  nombre: string;
  capital_pendiente: number;
  cuota: number;
  tipo_interes: number | null;
  valor_residual: number | null;
  fecha_fin: string | null;
};

// Meses que quedan al ritmo de la cuota actual. Es una estimación deliberadamente simple
// —no simula el cuadro completo, para eso está el detalle— pero responde de un vistazo a
// "¿cuánto me queda?", que es lo que se busca en un listado.
function mesesRestantes(deuda: Deuda): number | null {
  const pendiente = Number(deuda.capital_pendiente) - Number(deuda.valor_residual ?? 0);
  const cuota = Number(deuda.cuota);
  if (pendiente <= 0) return 0;
  if (cuota <= 0) return null;

  const tasa = (Number(deuda.tipo_interes ?? 0) / 100) / 12;
  if (tasa <= 0) return Math.ceil(pendiente / cuota);

  const interesDelPrimerMes = pendiente * tasa;
  // Si la cuota no cubre ni los intereses, la deuda no se amortiza nunca: mejor decirlo
  // que enseñar un número inventado.
  if (cuota <= interesDelPrimerMes) return null;

  return Math.ceil(-Math.log(1 - (pendiente * tasa) / cuota) / Math.log(1 + tasa));
}

function formatPlazo(meses: number | null): string {
  if (meses === null) return "—";
  if (meses === 0) return "Pagada";
  if (meses < 12) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const años = Math.floor(meses / 12);
  const resto = meses % 12;
  return resto === 0 ? `${años} ${años === 1 ? "año" : "años"}` : `${años} a. ${resto} m.`;
}

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
  const totalPendiente = deudas.reduce((s, d) => s + Number(d.capital_pendiente), 0);
  const totalCuota = deudas.reduce((s, d) => s + Number(d.cuota), 0);
  const formatEUR = (v: number) => formatMonedaTabla(v, moneda);
  const { orden, toggle } = useOrdenTabla("deudas", ordenInicial);

  const deudasOrdenadas = ordenarFilas(deudas, orden, {
    tipo: (d) => d.tipo,
    nombre: (d) => d.nombre,
    pendiente: (d) => Number(d.capital_pendiente),
    cuota: (d) => Number(d.cuota),
    interes: (d) => (d.tipo_interes !== null ? Number(d.tipo_interes) : null),
    plazo: (d) => mesesRestantes(d),
  });

  return (
    <div className={tableWrapClass}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <ThOrdenable columna="tipo" orden={orden} onToggle={toggle}>Tipo</ThOrdenable>
            <ThOrdenable columna="nombre" orden={orden} onToggle={toggle}>Nombre</ThOrdenable>
            <ThOrdenable columna="pendiente" orden={orden} onToggle={toggle} align="right">Pendiente</ThOrdenable>
            <ThOrdenable columna="cuota" orden={orden} onToggle={toggle} align="right">Cuota</ThOrdenable>
            <ThOrdenable columna="interes" orden={orden} onToggle={toggle} align="right">Interés</ThOrdenable>
            <ThOrdenable columna="plazo" orden={orden} onToggle={toggle} align="right">Le queda</ThOrdenable>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {deudasOrdenadas.map((deuda) => (
            <tr key={deuda.id} className="group border-t border-border">
              <td className="px-4 py-3.5 capitalize text-ink">{deuda.tipo}</td>
              <td className="px-4 py-3.5">
                <Link href={`/deudas/${deuda.id}`} className="text-[14px] font-semibold text-accent hover:underline">
                  {deuda.nombre}
                </Link>
              </td>
              <td className="px-4 py-3.5 text-right text-[15px] font-semibold tabular-nums text-ink">
                {formatEUR(Number(deuda.capital_pendiente))}
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums text-ink-secondary">{formatEUR(Number(deuda.cuota))}</td>
              <td className="px-4 py-3.5 text-right tabular-nums text-ink-secondary">
                {deuda.tipo_interes !== null ? formatPorcentaje(Number(deuda.tipo_interes), { decimales: 2 }) : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-ink-tertiary">
                {formatPlazo(mesesRestantes(deuda))}
              </td>
              <td className="whitespace-nowrap px-4 py-3.5 text-right opacity-100 transition-opacity md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
                {/* "Editar" explícito como en Cuentas e Inversión: antes había que adivinar
                    que se editaba pinchando el nombre. */}
                <Link href={`/deudas/${deuda.id}`} className="mr-3.5 text-[13px] font-semibold text-accent">
                  Editar
                </Link>
                <ConfirmForm
                  action={eliminarDeuda}
                  mensaje={`¿Seguro que quieres eliminar la deuda "${deuda.nombre}"? Esta acción no se puede deshacer.`}
                >
                  <input type="hidden" name="id" value={deuda.id} />
                  <button className={rowDelClass} type="submit">
                    Eliminar
                  </button>
                </ConfirmForm>
              </td>
            </tr>
          ))}
          {deudasOrdenadas.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-ink-tertiary">
                Todavía no has dado de alta ninguna deuda.
              </td>
            </tr>
          )}
        </tbody>
        {deudasOrdenadas.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-border-strong bg-chip/60">
              <td colSpan={2} className="px-4 py-3 text-[13px] font-semibold text-ink">
                Total
              </td>
              <td className="px-4 py-3 text-right font-sora text-base font-bold tabular-nums text-ink">
                {formatEUR(totalPendiente)}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">{formatEUR(totalCuota)}</td>
              <td colSpan={3} className="px-4 py-3 text-right text-[11px] text-ink-tertiary">
                al mes
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
