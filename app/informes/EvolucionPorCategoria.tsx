"use client";

import { useState } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { formatMoneda } from "@/lib/formato";
import { cardClass, rowLinkClass } from "@/components/formStyles";
import type { SerieCategoria } from "./InformesClient";

export function EvolucionPorCategoria({
  moneda,
  series,
  etiquetas,
}: {
  moneda: string;
  series: SerieCategoria[];
  etiquetas: string[];
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const [comoTabla, setComoTabla] = useState(false);

  const seriesOrdenadas = [...series].sort(
    (a, b) => b.valores.reduce((s, v) => s + v, 0) - a.valores.reduce((s, v) => s + v, 0)
  );

  return (
    <div className={cardClass}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-sora text-[15px] font-bold text-ink">Evolución mensual por categoría de gasto</h2>
          <p className="mt-1 text-[13px] text-ink-tertiary">
            Para detectar si una categoría tiene una tendencia sostenida o un pico puntual.
          </p>
        </div>
        <button type="button" onClick={() => setComoTabla((v) => !v)} className={`shrink-0 ${rowLinkClass} hover:underline`}>
          {comoTabla ? "Ver como gráfico" : "Ver como tabla"}
        </button>
      </div>

      {seriesOrdenadas.length === 0 ? (
        <p className="text-sm text-ink-tertiary">Sin datos en este periodo.</p>
      ) : comoTabla ? (
        <div className="overflow-x-auto rounded-btn border border-border">
          <table className="w-full text-sm">
            <thead className="bg-chip text-left text-ink-secondary">
              <tr>
                <th className="py-2 pl-3 pr-3 font-semibold">Categoría</th>
                {etiquetas.map((e) => (
                  <th key={e} className="whitespace-nowrap px-2 py-2 text-right font-semibold">
                    {e}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seriesOrdenadas.map((s) => (
                <tr key={s.nombre} className="border-t border-border">
                  <td className="py-2 pl-3 pr-3 text-ink-secondary">{s.nombre}</td>
                  {s.valores.map((v, i) => (
                    <td key={i} className="whitespace-nowrap px-2 py-2 text-right text-ink">
                      {v === 0 ? "—" : formatEUR(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {seriesOrdenadas.map((s) => {
            const datos = s.valores.map((v, i) => ({ mes: etiquetas[i] ?? "", valor: v }));
            const ultimo = s.valores.at(-1) ?? 0;
            return (
              <div key={s.nombre} className="rounded-btn border border-border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-ink">{s.nombre}</p>
                  <p className="text-[13px] font-semibold text-ink-secondary">{formatEUR(ultimo)}</p>
                </div>
                <div className="h-20 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={datos}>
                      <XAxis dataKey="mes" hide />
                      <Tooltip
                        formatter={(value) => formatEUR(Number(value))}
                        labelFormatter={(label) => label}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Line type="monotone" dataKey="valor" stroke="#0b0b0b" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
