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
import { cardClass, rowLinkClass } from "@/components/formStyles";
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
    <div className="rounded-btn border border-border bg-surface p-2.5 text-[13px] shadow-card">
      <p className="font-semibold text-ink">
        {d.label} {!d.esReal && <span className="text-accent">(previsión)</span>}
      </p>
      <p className="text-success">Ingresos: {formatEUR(d.ingresos)}</p>
      <p className="text-ink">Gastos: {formatEUR(d.gastos)}</p>
      <p className="font-semibold text-ink">Neto: {formatEUR(d.neto)}</p>
    </div>
  );
}

export function FlujoMensual({ moneda, datos }: { moneda: string; datos: MesFlujo[] }) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const [comoTabla, setComoTabla] = useState(false);

  return (
    <div className={cardClass}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-sora text-[15px] font-bold text-ink">Flujo mensual disponible</h2>
          <p className="mt-1 text-[13px] text-ink-tertiary">
            Ingresos menos gastos de cada mes.{" "}
            <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-accent">Meses en azul</span> son
            previsión.
          </p>
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
                <th className="px-3 py-2 text-right font-semibold">Ingresos</th>
                <th className="px-3 py-2 text-right font-semibold">Gastos</th>
                <th className="px-3 py-2 text-right font-semibold">Neto</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((d) => (
                <tr key={d.label} className="border-t border-border">
                  <td className="px-3 py-2 text-ink">
                    {d.label} {!d.esReal && <span className="text-xs text-accent">(previsión)</span>}
                  </td>
                  <td className="px-3 py-2 text-right text-success">{formatEUR(d.ingresos)}</td>
                  <td className="px-3 py-2 text-right text-ink">{formatEUR(d.gastos)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-ink">{formatEUR(d.neto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#c3c2b7" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#898781" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "#898781" }} tickFormatter={(v) => formatEUR(v)} width={80} />
              <ReferenceLine y={0} stroke="#898781" />
              <Tooltip content={<TooltipFlujo formatEUR={formatEUR} />} />
              <Bar dataKey="neto" name="Neto">
                {datos.map((d, i) => (
                  <Cell key={i} fill={d.esReal ? (d.neto >= 0 ? "#0ca30c" : "#0b0b0b") : "#2a78d6"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
