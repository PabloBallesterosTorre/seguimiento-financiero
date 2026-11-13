import Link from "next/link";
import { formatMoneda } from "@/lib/formato";
import { cardClass } from "@/components/formStyles";

export type FilaPorEtiqueta = {
  id: string;
  nombre: string;
  movimientos: number;
  gastos: number;
  ingresos: number;
};

// Tanda 15: cuánto se ha ido en cada etiqueta dentro del rango y las cuentas elegidas.
// Un movimiento con dos etiquetas cuenta en las dos, así que las filas no se suman entre sí
// y no hay fila de total a propósito.
export function PorEtiqueta({
  filas,
  etiquetaRango,
  moneda,
}: {
  filas: FilaPorEtiqueta[];
  etiquetaRango: string;
  moneda: string;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const max = Math.max(1, ...filas.map((f) => f.gastos));

  return (
    <div className={`${cardClass} space-y-4`}>
      <div>
        <h2 className="font-sora text-base font-semibold text-ink">Por etiqueta</h2>
        <p className="text-[13px] text-ink-tertiary">
          {etiquetaRango}. Un movimiento con varias etiquetas cuenta en todas, así que no se suman entre sí.
        </p>
      </div>
      <ul className="space-y-3">
        {filas.map((f) => (
          <li key={f.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
              <Link href={`/movimientos?etiqueta=${f.id}`} className="font-semibold text-ink hover:underline">
                #{f.nombre}
                <span className="ml-2 text-[11px] font-normal text-ink-tertiary">
                  {f.movimientos} {f.movimientos === 1 ? "movimiento" : "movimientos"}
                </span>
              </Link>
              <span className="font-semibold tabular-nums text-ink">
                {formatEUR(f.gastos)}
                {f.ingresos > 0 && (
                  <span className="ml-2 text-[11px] font-normal text-success">+{formatEUR(f.ingresos)} ingresado</span>
                )}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-chip">
              <div className="h-1.5 rounded-full bg-ink/70" style={{ width: `${(f.gastos / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
