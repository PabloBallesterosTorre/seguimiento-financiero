"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from "recharts";
import { formatMoneda } from "@/lib/formato";
import type { MesFlujo } from "./InformesClient";

function TooltipFlujo({
  active,
  payload,
  formatEUR,
}: {
  active?: boolean;
  payload?: { payload: MesFlujo }[];
  formatEUR: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-sm">
      <p className="font-medium text-slate-700">
        {d.label} {!d.esReal && <span className="text-sky-600">(previsión)</span>}
      </p>
      <p className="text-emerald-600">Ingresos: {formatEUR(d.ingresos)}</p>
      <p className="text-slate-900">Gastos: {formatEUR(d.gastos)}</p>
      <p className="font-medium">Neto: {formatEUR(d.neto)}</p>
    </div>
  );
}

export function FlujoMensual({ moneda, datos }: { moneda: string; datos: MesFlujo[] }) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const [comoTabla, setComoTabla] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-700">Flujo mensual disponible</h2>
          <p className="text-xs text-slate-400">
            Ingresos menos gastos de cada mes.{" "}
            <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-sky-700">Meses en azul</span> son previsión.
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

      {comoTabla ? (
        <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-md border border-slate-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Mes</th>
                <th className="px-3 py-2 text-right font-medium">Ingresos</th>
                <th className="px-3 py-2 text-right font-medium">Gastos</th>
                <th className="px-3 py-2 text-right font-medium">Neto</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((d) => (
                <tr key={d.label} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">
                    {d.label} {!d.esReal && <span className="text-xs text-sky-600">(previsión)</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right text-emerald-600">{formatEUR(d.ingresos)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-900">{formatEUR(d.gastos)}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{formatEUR(d.neto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatEUR(v)} width={80} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Tooltip content={<TooltipFlujo formatEUR={formatEUR} />} />
              <Bar dataKey="neto" name="Neto">
                {datos.map((d, i) => (
                  <Cell key={i} fill={d.esReal ? (d.neto >= 0 ? "#059669" : "#0f172a") : "#38bdf8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
