"use client";

import { useRouter } from "next/navigation";
import { formatMonedaTabla, formatPorcentaje } from "@/lib/formato";

export type FilaCategoria = {
  nombre: string;
  neto: number;
  salidas: number;
  entradas: number;
  movimientosContrarios: number;
};

// Responde a "¿en qué se va mi dinero y de dónde viene?" con las dos mitades a la vista y
// a la misma escala, para que se puedan comparar de un vistazo.
//
// Las cifras van NETEADAS (ver netoPorCategoria en lib/informes.ts): una categoría aparece
// en un lado o en el otro, nunca en los dos. Cuando ha habido movimientos en contra —los
// Bizums de cuando pagas tú la cena— se dice debajo, para que la cifra no parezca sacada
// de la nada.
function Mitad({
  titulo,
  filas,
  moneda,
  color,
  vacio,
  esGasto,
}: {
  titulo: string;
  filas: FilaCategoria[];
  moneda: string;
  color: string;
  vacio: string;
  esGasto: boolean;
}) {
  const total = filas.reduce((s, f) => s + f.neto, 0);
  const mayor = filas[0]?.neto ?? 0;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink">{titulo}</h3>
        <span className="font-sora text-base font-bold tabular-nums text-ink">
          {formatMonedaTabla(total, moneda)}
        </span>
      </div>

      {filas.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-tertiary">{vacio}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {filas.map((f) => (
            <li key={f.nombre}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate text-ink" title={f.nombre}>
                  {f.nombre}
                </span>
                <span className="shrink-0 tabular-nums text-ink-secondary">
                  {formatMonedaTabla(f.neto, moneda)}
                  {total > 0 && (
                    <span className="ml-1.5 text-ink-tertiary">
                      {formatPorcentaje((f.neto / total) * 100, { decimales: 0 })}
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-chip">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{ width: `${mayor > 0 ? Math.max((f.neto / mayor) * 100, 1) : 0}%` }}
                />
              </div>
              {f.movimientosContrarios > 0 && (
                <p className="mt-1 text-[11px] text-ink-tertiary">
                  {esGasto ? (
                    <>
                      {formatMonedaTabla(f.salidas, moneda)} gastados menos{" "}
                      {formatMonedaTabla(f.entradas, moneda)} que te devolvieron
                    </>
                  ) : (
                    <>
                      {formatMonedaTabla(f.entradas, moneda)} recibidos menos{" "}
                      {formatMonedaTabla(f.salidas, moneda)} de gasto en la misma categoría
                    </>
                  )}{" "}
                  · {f.movimientosContrarios}{" "}
                  {f.movimientosContrarios === 1 ? "movimiento" : "movimientos"} en sentido contrario
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EnQueSeVa({
  gastos,
  ingresos,
  moneda,
  etiquetaRango,
  meses,
  mesSeleccionado,
  queryBase,
}: {
  gastos: FilaCategoria[];
  ingresos: FilaCategoria[];
  moneda: string;
  // Cómo se llama "todo el periodo" con el rango elegido arriba. No puede depender del mes
  // seleccionado, o la opción de quitar el filtro se etiquetaría con el mes que ya tienes.
  etiquetaRango: string;
  meses: { clave: string; etiqueta: string }[];
  mesSeleccionado: string | null;
  queryBase: string;
}) {
  const router = useRouter();

  return (
    <div className="rounded-card border border-border bg-surface p-7 shadow-card">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-sora text-base font-semibold text-ink">En qué se va y de dónde viene</h2>
        {/* El mes es de este bloque, no de la pantalla: el resto de gráficos siguen con el
            rango elegido arriba. Va en la URL para que se pueda compartir y para que el
            botón de atrás funcione. */}
        <label className="flex items-center gap-2 text-[13px] text-ink-tertiary">
          <span className="sr-only">Periodo del desglose</span>
          <select
            value={mesSeleccionado ?? ""}
            onChange={(e) =>
              router.push(`/informes?${queryBase}${e.target.value ? `&mes=${e.target.value}` : ""}`)
            }
            className="rounded-btn border border-border-strong bg-field px-2.5 py-1.5 text-[13px] text-ink"
          >
            <option value="">{etiquetaRango}</option>
            {meses.map((m) => (
              <option key={m.clave} value={m.clave}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-6 text-[13px] text-ink-tertiary">
        Cada categoría aparece en un solo lado, por su saldo neto. Si pagas tú una cena y te devuelven
        parte por Bizum, cuenta como lo que costó de verdad, no como un gasto y un ingreso.
      </p>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Mitad
          titulo="En qué se va"
          filas={gastos}
          moneda={moneda}
          color="bg-danger/70"
          vacio="No hay gastos en el periodo elegido."
          esGasto
        />
        <Mitad
          titulo="De dónde viene"
          filas={ingresos}
          moneda={moneda}
          color="bg-success/70"
          vacio="No hay ingresos en el periodo elegido."
          esGasto={false}
        />
      </div>
    </div>
  );
}
