"use client";

import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell, ReferenceLine } from "recharts";
import { formatMoneda } from "@/lib/formato";

export type MesAhorroHome = { label: string; esReal: boolean; ahorro: number };

function TooltipAhorro({
  active,
  payload,
  formatEUR,
  objetivo,
}: {
  active?: boolean;
  payload?: { payload: MesAhorroHome }[];
  formatEUR: (v: number) => string;
  objetivo: number | null;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white p-2 text-xs shadow-sm">
      <p className="font-medium text-slate-700">
        {d.label} {!d.esReal && <span className="text-sky-600">(previsión)</span>}
      </p>
      <p className="font-medium">Ahorro: {formatEUR(d.ahorro)}</p>
      {objetivo !== null && (
        <p className={d.ahorro >= objetivo ? "text-emerald-600" : "text-red-600"}>
          Objetivo: {formatEUR(objetivo)} — {d.ahorro >= objetivo ? "cumplido" : "no cumplido"}
        </p>
      )}
    </div>
  );
}

export function FlujoMensualDisponible({
  moneda,
  datos,
  objetivo,
}: {
  moneda: string;
  datos: MesAhorroHome[];
  objetivo: number | null;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-3">
        <h2 className="text-sm font-medium text-slate-700">Flujo mensual disponible</h2>
        <p className="text-xs text-slate-400">
          Ahorro real (o previsto) de cada mes, aplicando tu criterio de si la inversión cuenta como ahorro.{" "}
          <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-sky-700">Meses en azul</span> son previsión.
          {objetivo === null && (
            <>
              {" "}
              Todavía no has fijado un objetivo de ahorro.{" "}
              <a href="/configuracion" className="underline">
                Configúralo aquí
              </a>
              .
            </>
          )}
        </p>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatEUR(v)} width={80} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            {objetivo !== null && (
              <ReferenceLine
                y={objetivo}
                stroke="#0f172a"
                strokeDasharray="4 4"
                label={{ value: `Objetivo: ${formatEUR(objetivo)}`, position: "insideTopRight", fontSize: 11 }}
              />
            )}
            <Tooltip content={<TooltipAhorro formatEUR={formatEUR} objetivo={objetivo} />} />
            <Bar dataKey="ahorro" name="Ahorro">
              {datos.map((d, i) => {
                const cumplido = objetivo !== null ? d.ahorro >= objetivo : d.ahorro >= 0;
                const color = !d.esReal ? "#38bdf8" : cumplido ? "#059669" : "#0f172a";
                return <Cell key={i} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
