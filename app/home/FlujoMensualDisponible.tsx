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
    <div className="rounded-btn border border-border bg-surface p-2.5 text-xs shadow-card">
      <p className="font-semibold text-ink">
        {d.label} {!d.esReal && <span className="text-accent">(previsión)</span>}
      </p>
      <p className="font-semibold text-ink-secondary">Ahorro: {formatEUR(d.ahorro)}</p>
      {objetivo !== null && (
        <p className={d.ahorro >= objetivo ? "text-success" : "text-danger"}>
          Objetivo: {formatEUR(objetivo)} — {d.ahorro >= objetivo ? "cumplido" : "no cumplido"}
        </p>
      )}
    </div>
  );
}

function Leyenda() {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-4 text-xs text-ink-secondary">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-sm bg-success" />
        Real (cumple objetivo)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-sm bg-ink" />
        Real (no cumple)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-sm bg-accent" />
        Previsto
      </span>
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
    <div className="rounded-card border border-border bg-surface p-7 shadow-card">
      <div className="mb-1">
        <h2 className="font-sora text-lg font-semibold text-ink">Flujo mensual disponible</h2>
        <p className="mb-4 mt-1 max-w-xl text-[13px] text-ink-secondary">
          Ahorro real (o previsto) de cada mes, aplicando tu criterio de si la inversión cuenta como ahorro.
          {objetivo === null && (
            <>
              {" "}
              Todavía no has fijado un objetivo de ahorro.{" "}
              <a href="/configuracion" className="font-semibold text-accent">
                Configúralo aquí
              </a>
              .
            </>
          )}
        </p>
      </div>

      <Leyenda />

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#898781" }} interval="preserveStartEnd" axisLine={{ stroke: "#e1e0d9" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#898781" }} tickFormatter={(v) => formatEUR(v)} width={80} axisLine={false} tickLine={false} />
            <ReferenceLine y={0} stroke="#c3c2b7" />
            {objetivo !== null && (
              <ReferenceLine
                y={objetivo}
                stroke="#898781"
                strokeDasharray="4 4"
                label={{ value: `Objetivo: ${formatEUR(objetivo)}`, position: "insideTopRight", fontSize: 11, fill: "#898781" }}
              />
            )}
            <Tooltip content={<TooltipAhorro formatEUR={formatEUR} objetivo={objetivo} />} cursor={{ fill: "rgba(11,11,11,0.03)" }} />
            <Bar dataKey="ahorro" name="Ahorro" radius={[4, 4, 0, 0]}>
              {datos.map((d, i) => {
                const cumplido = objetivo !== null ? d.ahorro >= objetivo : d.ahorro >= 0;
                const color = !d.esReal ? "#2a78d6" : cumplido ? "#0ca30c" : "#0b0b0b";
                return <Cell key={i} fill={color} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
