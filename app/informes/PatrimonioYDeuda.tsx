"use client";

import { useState } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { formatMoneda } from "@/lib/formato";
import type { MesPatrimonio } from "./InformesClient";

export function PatrimonioYDeuda({ moneda, datos }: { moneda: string; datos: MesPatrimonio[] }) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const [comoTabla, setComoTabla] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-700">Patrimonio neto y deuda pendiente</h2>
          <p className="text-xs text-slate-400">Histórico y previsión, mes a mes.</p>
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
                <th className="px-3 py-2 text-right font-medium">Patrimonio neto</th>
                <th className="px-3 py-2 text-right font-medium">Deuda pendiente</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((d) => (
                <tr key={d.label} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">
                    {d.label} {!d.esReal && <span className="text-xs text-sky-600">(previsión)</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium">{formatEUR(d.patrimonio)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-500">{formatEUR(d.deuda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatEUR(v)} width={80} />
              <Tooltip formatter={(value) => formatEUR(Number(value))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="patrimonio" name="Patrimonio neto" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="deuda" name="Deuda pendiente" stroke="#dc2626" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
