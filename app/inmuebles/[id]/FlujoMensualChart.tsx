"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonedaTabla as formatMoneda } from "@/lib/formato";
import type { MesInmueble } from "@/lib/inmuebles";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const etiquetaMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(2, 4)}`;

// Lo que dejó (verde) o costó (rojo) el inmueble cada mes: rentas menos gastos y cuotas.
// El tooltip desglosa las tres partes, que es lo que explica un mes raro (una derrama, el
// IBI, un mes sin inquilino).
export function FlujoMensualChart({ meses, moneda }: { meses: MesInmueble[]; moneda: string }) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={meses} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#c3c2b7" />
          <XAxis dataKey="mes" tickFormatter={etiquetaMes} tick={{ fontSize: 11, fill: "#898781" }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: "#898781" }} tickFormatter={(v) => formatEUR(v)} width={72} />
          <ReferenceLine y={0} stroke="#898781" />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const m = payload[0].payload as MesInmueble;
              return (
                <div className="rounded-btn border border-border bg-surface px-3 py-2 text-xs shadow-card">
                  <p className="mb-1 font-semibold text-ink">{etiquetaMes(m.mes)}</p>
                  <p className="text-ink-secondary">Ingresos: {formatEUR(m.ingresos)}</p>
                  <p className="text-ink-secondary">Gastos: {m.gastos > 0 ? "−" : ""}{formatEUR(m.gastos)}</p>
                  <p className="text-ink-secondary">Cuotas hipoteca: {m.cuotas > 0 ? "−" : ""}{formatEUR(m.cuotas)}</p>
                  <p className={`mt-1 font-semibold ${m.neto < 0 ? "text-danger" : "text-success"}`}>
                    Neto: {m.neto >= 0 ? "+" : "−"}
                    {formatEUR(Math.abs(m.neto))}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="neto" radius={[3, 3, 3, 3]} maxBarSize={28}>
            {meses.map((m) => (
              <Cell key={m.mes} fill={m.neto < 0 ? "#d03b3b" : "#0ca30c"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
