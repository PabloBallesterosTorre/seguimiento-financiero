"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { formatMonedaTabla, formatPorcentaje } from "@/lib/formato";
import type { PuntoMini } from "./InformesClient";

export function KpiDineroDisponible({
  moneda,
  valor,
  variacion,
  miniSerie,
  titulo = "Dinero disponible ahora (líquido + inversión, sin descontar deuda)",
  fechaCierreAnterior,
}: {
  moneda: string;
  valor: number;
  variacion: { abs: number; pct: number } | null;
  miniSerie: PuntoMini[];
  titulo?: string;
  // Contra qué se compara exactamente: el saldo de hoy frente al del CIERRE del último mes
  // cerrado. Con los meses de nómina a nómina ese cierre no cae el día 31, así que decir la
  // fecha evita tener que adivinarla.
  fechaCierreAnterior?: string;
}) {
  const formatEUR = (v: number) => formatMonedaTabla(v, moneda);
  // Tres estados, no dos: sube, baja y no se ha movido. Sin el caso "igual", una variación
  // de 0,00 € se pintaba en verde con una flecha hacia arriba, que dice algo que no ha
  // pasado (auditoría de diseño, tanda 11).
  const sinCambio = variacion !== null && Math.abs(variacion.abs) < 0.005;
  const subiendo = variacion !== null && variacion.abs > 0;
  const referencia = fechaCierreAnterior
    ? `frente al cierre del ${new Intl.DateTimeFormat("es-ES", {
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }).format(new Date(`${fechaCierreAnterior}T00:00:00Z`))}`
    : "frente al mes anterior";

  return (
    <div className="rounded-card border border-border bg-surface p-6 shadow-card">
      <p className="text-sm text-ink-secondary">{titulo}</p>
      <div className="mt-2.5">
        <div>
          <p className="break-words font-sora text-2xl font-bold text-ink sm:text-[30px]">{formatEUR(valor)}</p>
          {variacion === null ? (
            <p className="mt-2 text-[13px] text-ink-tertiary">Sin periodo anterior con el que comparar todavía.</p>
          ) : (
            <p
              className={`mt-2 flex items-center gap-1.5 text-[13px] font-semibold ${
                sinCambio ? "text-ink-tertiary" : subiendo ? "text-success" : "text-danger"
              }`}
            >
              {!sinCambio && (
                <svg width="9" height="9" viewBox="0 0 10 10" className={subiendo ? "" : "rotate-180"} aria-hidden="true">
                  <path d="M1 3 L9 3 L5 8 Z" fill="currentColor" />
                </svg>
              )}
              {sinCambio
                ? `Sin cambios ${referencia}`
                : `${formatEUR(Math.abs(variacion.abs))} (${formatPorcentaje(variacion.pct, {
                    decimales: 1,
                    signo: "siempre",
                  })}) ${referencia}`}
            </p>
          )}
        </div>
        <div className="mt-3 h-[34px] w-full">
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
