"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoneda } from "@/lib/formato";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

function etiquetaMes(mes: string) {
  return `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(2, 4)}`;
}

// Barras de un importe por mes: rentas cobradas o capital aportado. Un mes en cero se
// dibuja vacío a propósito, para que se vea el hueco y no parezca que el cobro fue continuo.
export function BarrasMensuales({
  datos,
  moneda,
  color,
  nombre,
}: {
  datos: { mes: string; importe: number }[];
  moneda: string;
  color: string;
  nombre: string;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#c3c2b7" />
          <XAxis
            dataKey="mes"
            tickFormatter={etiquetaMes}
            tick={{ fontSize: 11, fill: "#898781" }}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 11, fill: "#898781" }} tickFormatter={(v) => formatEUR(v)} width={72} />
          <Tooltip
            formatter={(value) => [formatEUR(Number(value)), nombre]}
            labelFormatter={(mes) => etiquetaMes(String(mes))}
            contentStyle={{ fontSize: 12, fontFamily: "var(--font-manrope)" }}
          />
          <Bar dataKey="importe" fill={color} radius={[3, 3, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
