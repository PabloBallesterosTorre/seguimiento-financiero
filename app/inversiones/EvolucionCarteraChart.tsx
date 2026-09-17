"use client";

// ComposedChart y no AreaChart: mezclar un Area con una Line es justo para lo que
// existe, y es la forma que Recharts documenta para combinar dos tipos de serie.
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoneda } from "@/lib/formato";
import type { PuntoCartera } from "@/lib/inversiones";

// El gráfico que responde a "¿estoy ganando dinero?": la distancia entre el valor de
// mercado y lo aportado ES la ganancia. Una línea de valor subiendo no dice nada por sí
// sola si no se ve cuánto dinero se ha ido metiendo para conseguirlo.
export function EvolucionCarteraChart({ puntos, moneda }: { puntos: PuntoCartera[]; moneda: string }) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);

  if (puntos.length < 2) {
    return (
      <p className="text-sm text-ink-tertiary">
        Hace falta más de un mes de histórico para dibujar la evolución de la cartera.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={puntos} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gradienteValorCartera" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1baf7a" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#1baf7a" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#c3c2b7" />
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#898781" }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: "#898781" }} tickFormatter={(v) => formatEUR(v)} width={80} />
          <Tooltip
            formatter={(value, name) => [formatEUR(Number(value)), name === "valor" ? "Valor de mercado" : "Aportado"]}
            contentStyle={{ fontSize: 12, fontFamily: "var(--font-manrope)" }}
          />
          <Legend
            formatter={(value) => (value === "valor" ? "Valor de mercado" : "Aportado acumulado")}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Area type="monotone" dataKey="valor" stroke="#1baf7a" strokeWidth={2} fill="url(#gradienteValorCartera)" />
          <Line type="monotone" dataKey="aportado" stroke="#898781" strokeWidth={2} strokeDasharray="5 4" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
