"use client";

import { useState } from "react";
import { formatMoneda } from "@/lib/formato";
import type { MesAhorro } from "./InformesClient";

export function ObjetivoAhorro({
  moneda,
  datos,
  objetivo,
}: {
  moneda: string;
  datos: MesAhorro[];
  objetivo: number | null;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const [seleccionado, setSeleccionado] = useState<number | null>(null);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-medium text-slate-700">Objetivo de ahorro — cumplimiento mensual</h2>

      {objetivo === null ? (
        <p className="mt-2 text-sm text-slate-400">
          Todavía no has fijado un objetivo de ahorro. Configúralo en Configuración de perfil.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-400">Objetivo: {formatEUR(objetivo)}/mes. Histórico y previsión.</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {datos.map((d, i) => {
              const cumplido = d.cumplido === true;
              return (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setSeleccionado(seleccionado === i ? null : i)}
                  className={`flex h-9 min-w-9 items-center justify-center rounded-md border px-1.5 text-xs font-medium ${
                    cumplido
                      ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                      : "border-red-200 bg-red-100 text-red-700"
                  } ${!d.esReal ? "opacity-70" : ""}`}
                  title={`${d.label}: ${formatEUR(d.ahorro)} de ${formatEUR(objetivo)}`}
                >
                  {cumplido ? "✓" : "✕"}
                </button>
              );
            })}
          </div>
          {seleccionado !== null && datos[seleccionado] && (
            <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
              <p className="font-medium text-slate-700">
                {datos[seleccionado].label} {!datos[seleccionado].esReal && <span className="text-xs text-sky-600">(previsión)</span>}
              </p>
              <p className="text-slate-600">
                Ahorrado: <span className="font-medium">{formatEUR(datos[seleccionado].ahorro)}</span> de{" "}
                {formatEUR(objetivo)} —{" "}
                {datos[seleccionado].cumplido ? (
                  <span className="text-emerald-600">cumplido</span>
                ) : (
                  <span className="text-red-600">no cumplido</span>
                )}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
