"use client";

import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Dot } from "recharts";
import { formatMoneda } from "@/lib/formato";

type Punto = { fecha: string; valor: number; esReal: boolean };

function PuntoReal(props: { cx?: number; cy?: number; payload?: Punto }) {
  const { cx, cy, payload } = props;
  if (!payload?.esReal || cx === undefined || cy === undefined) return null;
  return <Dot cx={cx} cy={cy} r={3.5} fill="#2a78d6" stroke="#ffffff" strokeWidth={1.5} />;
}

export function EvolucionInversionChart({ puntos, moneda }: { puntos: Punto[]; moneda: string }) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);

  if (puntos.length === 0) {
    return <p className="text-sm text-ink-tertiary">Todavía no hay ninguna valoración registrada.</p>;
  }

  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={puntos}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#c3c2b7" />
            <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#898781" }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: "#898781" }} tickFormatter={(v) => formatEUR(v)} width={80} />
            <Tooltip
              formatter={(value, _name, item) => [
                formatEUR(Number(value)) + (item?.payload?.esReal ? "" : " (estimado)"),
                "Valor",
              ]}
              labelFormatter={(label) => label}
              contentStyle={{ fontSize: 12, fontFamily: "var(--font-manrope)" }}
            />
            <Line type="monotone" dataKey="valor" stroke="#eda100" strokeWidth={2} strokeDasharray="5 4" dot={<PuntoReal />} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-ink-tertiary">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-accent align-middle" /> Punto real (actualización
        manual) · línea discontinua = estimación entre valoraciones, según la rentabilidad anual asumida.
      </p>
    </div>
  );
}
