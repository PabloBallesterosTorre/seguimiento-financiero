"use client";

import { useState } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { formatMoneda } from "@/lib/formato";
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
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-700">Evolución mensual por categoría de gasto</h2>
          <p className="text-xs text-slate-400">Para detectar si una categoría tiene una tendencia sostenida o un pico puntual.</p>
        </div>
        <button
          type="button"
          onClick={() => setComoTabla((v) => !v)}
          className="text-xs text-slate-500 underline hover:text-slate-900"
        >
          {comoTabla ? "Ver como gráfico" : "Ver como tabla"}
        </button>
      </div>

      {seriesOrdenadas.length === 0 ? (
        <p className="text-sm text-slate-400">Sin datos en este periodo.</p>
      ) : comoTabla ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Categoría</th>
                {etiquetas.map((e) => (
                  <th key={e} className="whitespace-nowrap px-2 py-1.5 text-right font-medium">
                    {e}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seriesOrdenadas.map((s) => (
                <tr key={s.nombre} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3 text-slate-600">{s.nombre}</td>
                  {s.valores.map((v, i) => (
                    <td key={i} className="whitespace-nowrap px-2 py-1.5 text-right">
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
              <div key={s.nombre} className="rounded-md border border-slate-100 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-700">{s.nombre}</p>
                  <p className="text-xs font-medium text-slate-500">{formatEUR(ultimo)}</p>
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
                      <Line type="monotone" dataKey="valor" stroke="#0f172a" strokeWidth={2} dot={false} />
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
