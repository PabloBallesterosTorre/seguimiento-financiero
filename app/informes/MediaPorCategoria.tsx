"use client";

import { useState } from "react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatMoneda } from "@/lib/formato";
import type { CategoriaMedia } from "./InformesClient";

function GraficoMedia({
  datos,
  formatEUR,
  color,
}: {
  datos: CategoriaMedia[];
  formatEUR: (v: number) => string;
  color: string;
}) {
  const alto = Math.max(120, datos.length * 32);
  return (
    <div style={{ height: alto }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatEUR(v)} />
          <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12 }} width={140} />
          <Tooltip formatter={(value) => formatEUR(Number(value))} />
          <Bar dataKey="media" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TablaMedia({ datos, formatEUR }: { datos: CategoriaMedia[]; formatEUR: (v: number) => string }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {datos.map((d) => (
          <tr key={d.nombre} className="border-t border-slate-100">
            <td className="py-1.5 text-slate-600">{d.nombre}</td>
            <td className="py-1.5 text-right font-medium">{formatEUR(d.media)}/mes</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MediaPorCategoria({
  moneda,
  gasto,
  ingreso,
  mesesUsados,
}: {
  moneda: string;
  gasto: CategoriaMedia[];
  ingreso: CategoriaMedia[];
  mesesUsados: number;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const [comoTabla, setComoTabla] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-700">Gasto e ingreso medio mensual por categoría</h2>
          <p className="text-xs text-slate-400">
            Media de los últimos {mesesUsados} {mesesUsados === 1 ? "mes con datos" : "meses con datos"} (nunca se
            divide entre más meses de los que realmente hay histórico).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setComoTabla((v) => !v)}
          className="text-xs text-slate-500 underline hover:text-slate-900"
        >
          {comoTabla ? "Ver como gráfico" : "Ver como tabla"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Gasto</h3>
          {gasto.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos en este periodo.</p>
          ) : comoTabla ? (
            <TablaMedia datos={gasto} formatEUR={formatEUR} />
          ) : (
            <GraficoMedia datos={gasto} formatEUR={formatEUR} color="#0f172a" />
          )}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Ingreso</h3>
          {ingreso.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos en este periodo.</p>
          ) : comoTabla ? (
            <TablaMedia datos={ingreso} formatEUR={formatEUR} />
          ) : (
            <GraficoMedia datos={ingreso} formatEUR={formatEUR} color="#059669" />
          )}
        </div>
      </div>
    </div>
  );
}
