"use client";

import { useState } from "react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { formatMoneda } from "@/lib/formato";
import { cardClass, rowLinkClass } from "@/components/formStyles";
import type { FilaComparativa } from "./InformesClient";

export function PrevistoVsReal({
  moneda,
  filas,
  etiquetaMes,
}: {
  moneda: string;
  filas: FilaComparativa[];
  etiquetaMes: string;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const [comoTabla, setComoTabla] = useState(false);

  return (
    <div className={cardClass}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-sora text-[15px] font-bold text-ink">Previsto vs. real por categoría</h2>
          <p className="mt-1 text-[13px] text-ink-tertiary">
            {etiquetaMes ? `Último mes cerrado: ${etiquetaMes}` : "Todavía no hay un mes cerrado con histórico."}
          </p>
        </div>
        {filas.length > 0 && (
          <button type="button" onClick={() => setComoTabla((v) => !v)} className={`shrink-0 ${rowLinkClass} hover:underline`}>
            {comoTabla ? "Ver como gráfico" : "Ver como tabla"}
          </button>
        )}
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-ink-tertiary">No hay categorías con previsión o gasto real que comparar ese mes.</p>
      ) : comoTabla ? (
        <table className="w-full text-sm">
          <thead className="text-left text-ink-secondary">
            <tr>
              <th className="py-2 font-semibold">Categoría</th>
              <th className="py-2 text-right font-semibold">Previsto</th>
              <th className="py-2 text-right font-semibold">Real</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.nombre} className="border-t border-border">
                <td className="py-2 text-ink-secondary">{f.nombre}</td>
                <td className="py-2 text-right text-forecast">{formatEUR(f.previsto)}</td>
                <td className="py-2 text-right text-actual">{formatEUR(f.real)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ height: Math.max(200, filas.length * 40) }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filas} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#c3c2b7" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#898781" }} tickFormatter={(v) => formatEUR(v)} />
              <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12, fill: "#52514e" }} width={140} />
              <Tooltip formatter={(value) => formatEUR(Number(value))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="previsto" name="Previsto" fill="#eda100" radius={[0, 4, 4, 0]} />
              <Bar dataKey="real" name="Real" fill="#1baf7a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
