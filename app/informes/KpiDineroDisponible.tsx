"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { formatMoneda } from "@/lib/formato";
import type { PuntoMini } from "./InformesClient";

export function KpiDineroDisponible({
  moneda,
  valor,
  variacionAbs,
  variacionPct,
  miniSerie,
}: {
  moneda: string;
  valor: number;
  variacionAbs: number;
  variacionPct: number;
  miniSerie: PuntoMini[];
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const subiendo = variacionAbs >= 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <p className="text-sm text-slate-500">Dinero disponible ahora (líquido + inversión, sin descontar deuda)</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-semibold">{formatEUR(valor)}</p>
          <p className={`mt-1 text-sm font-medium ${subiendo ? "text-emerald-600" : "text-slate-900"}`}>
            {subiendo ? "▲" : "▼"} {formatEUR(Math.abs(variacionAbs))} ({variacionPct >= 0 ? "+" : ""}
            {variacionPct.toFixed(1)}%) frente al mes anterior
          </p>
        </div>
        <div className="h-16 w-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={miniSerie}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                formatter={(value) => formatEUR(Number(value))}
                labelFormatter={(label) => label}
                contentStyle={{ fontSize: 12 }}
              />
              <Line type="monotone" dataKey="valor" stroke="#0f172a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-400">Últimos 12 meses</p>
    </div>
  );
}
