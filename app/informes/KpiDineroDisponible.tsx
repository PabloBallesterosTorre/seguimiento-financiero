"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { formatMoneda } from "@/lib/formato";
import type { PuntoMini } from "./InformesClient";

export function KpiDineroDisponible({
  moneda,
  valor,
  variacion,
  miniSerie,
  titulo = "Dinero disponible ahora (líquido + inversión, sin descontar deuda)",
}: {
  moneda: string;
  valor: number;
  variacion: { abs: number; pct: number } | null;
  miniSerie: PuntoMini[];
  titulo?: string;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const subiendo = variacion !== null && variacion.abs >= 0;

  return (
    <div className="rounded-card border border-border bg-surface p-6 shadow-card">
      <p className="text-sm text-ink-secondary">{titulo}</p>
      <div className="mt-2.5 flex items-end justify-between">
        <div>
          <p className="break-words font-sora text-2xl font-bold text-ink sm:text-[30px]">{formatEUR(valor)}</p>
          {variacion === null ? (
            <p className="mt-2 text-[13px] text-ink-tertiary">Sin periodo anterior con el que comparar todavía.</p>
          ) : (
            <p className={`mt-2 flex items-center gap-1.5 text-[13px] font-semibold ${subiendo ? "text-success" : "text-danger"}`}>
              <svg width="9" height="9" viewBox="0 0 10 10" className={subiendo ? "" : "rotate-180"}>
                <path d="M1 3 L9 3 L5 8 Z" fill="currentColor" />
              </svg>
              {formatEUR(Math.abs(variacion.abs))} ({variacion.pct >= 0 ? "+" : ""}
              {variacion.pct.toFixed(1)}%) frente al mes anterior
            </p>
          )}
        </div>
        <div className="h-[34px] w-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={miniSerie}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                formatter={(value) => formatEUR(Number(value))}
                labelFormatter={(label) => label}
                contentStyle={{ fontSize: 12, fontFamily: "var(--font-manrope)" }}
              />
              <Line type="monotone" dataKey="valor" stroke="#c3c2b7" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: "#2a78d6" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="mt-2.5 text-[11px] text-ink-tertiary">Últimos 12 meses</p>
    </div>
  );
}
