"use client";

import { useState } from "react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { formatMoneda } from "@/lib/formato";
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
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-700">Previsto vs. real por categoría</h2>
          <p className="text-xs text-slate-400">
            {etiquetaMes ? `Último mes cerrado: ${etiquetaMes}` : "Todavía no hay un mes cerrado con histórico."}
          </p>
        </div>
        {filas.length > 0 && (
          <button
            type="button"
            onClick={() => setComoTabla((v) => !v)}
            className="text-xs text-slate-500 underline hover:text-slate-900"
          >
            {comoTabla ? "Ver como gráfico" : "Ver como tabla"}
          </button>
        )}
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-slate-400">No hay categorías con previsión o gasto real que comparar ese mes.</p>
      ) : comoTabla ? (
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1.5 font-medium">Categoría</th>
              <th className="py-1.5 text-right font-medium">Previsto</th>
              <th className="py-1.5 text-right font-medium">Real</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.nombre} className="border-t border-slate-100">
                <td className="py-1.5 text-slate-600">{f.nombre}</td>
                <td className="py-1.5 text-right text-amber-600">{formatEUR(f.previsto)}</td>
                <td className="py-1.5 text-right text-emerald-600">{formatEUR(f.real)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ height: Math.max(200, filas.length * 40) }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filas} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatEUR(v)} />
              <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12 }} width={140} />
              <Tooltip formatter={(value) => formatEUR(Number(value))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="previsto" name="Previsto" fill="#d97706" radius={[0, 4, 4, 0]} />
              <Bar dataKey="real" name="Real" fill="#059669" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
