"use client";

import { useState } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { formatMoneda } from "@/lib/formato";
import { cardClass, rowLinkClass } from "@/components/formStyles";
import type { MesPatrimonio } from "./InformesClient";

export function PatrimonioYDeuda({ moneda, datos }: { moneda: string; datos: MesPatrimonio[] }) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const [comoTabla, setComoTabla] = useState(false);

  return (
    <div className={cardClass}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-sora text-[15px] font-bold text-ink">Patrimonio neto y deuda pendiente</h2>
          <p className="mt-1 text-[13px] text-ink-tertiary">Histórico y previsión, mes a mes.</p>
        </div>
        <button type="button" onClick={() => setComoTabla((v) => !v)} className={`shrink-0 ${rowLinkClass} hover:underline`}>
          {comoTabla ? "Ver como gráfico" : "Ver como tabla"}
        </button>
      </div>

      {comoTabla ? (
        <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-btn border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-chip text-left text-ink-secondary">
              <tr>
                <th className="px-3 py-2 font-semibold">Mes</th>
                <th className="px-3 py-2 text-right font-semibold">Patrimonio neto</th>
                <th className="px-3 py-2 text-right font-semibold">Deuda pendiente</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((d) => (
                <tr key={d.label} className="border-t border-border">
                  <td className="px-3 py-2 text-ink">
                    {d.label} {!d.esReal && <span className="text-xs text-accent">(previsión)</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-ink">{formatEUR(d.patrimonio)}</td>
                  <td className="px-3 py-2 text-right text-ink-secondary">{formatEUR(d.deuda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#c3c2b7" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#898781" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "#898781" }} tickFormatter={(v) => formatEUR(v)} width={80} />
              <Tooltip formatter={(value) => formatEUR(Number(value))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="patrimonio" name="Patrimonio neto" stroke="#0ca30c" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="deuda" name="Deuda pendiente" stroke="#d03b3b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
