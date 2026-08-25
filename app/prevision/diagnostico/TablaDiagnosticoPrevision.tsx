"use client";

import { Fragment, useState } from "react";
import type { FilaDiagnostico } from "@/lib/prevision";
import { formatMoneda } from "@/lib/formato";

export function TablaDiagnosticoPrevision({
  filas,
  mesesLabel,
  moneda = "EUR",
}: {
  filas: FilaDiagnostico[];
  mesesLabel: string[];
  moneda?: string;
}) {
  const formatEUR = (v: number) => formatMoneda(v, moneda);
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  function toggle(categoriaId: string) {
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(categoriaId)) next.delete(categoriaId);
      else next.add(categoriaId);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-100">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Categoría</th>
            {mesesLabel.map((label) => (
              <th key={label} className="whitespace-nowrap px-3 py-2 text-right font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const tieneHijos = fila.subfilas.length > 0;
            const abierta = abiertas.has(fila.categoriaId);

            return (
              <Fragment key={fila.categoriaId}>
                <tr
                  onClick={tieneHijos ? () => toggle(fila.categoriaId) : undefined}
                  className={`border-t border-slate-100 font-medium text-slate-700 ${
                    tieneHijos ? "cursor-pointer hover:bg-slate-50" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-2">
                    {tieneHijos ? (abierta ? "▾ " : "▸ ") : ""}
                    {fila.nombre}
                  </td>
                  {fila.importesPorMes.map((importe, i) => (
                    <td
                      key={i}
                      className={`whitespace-nowrap px-3 py-2 text-right ${
                        importe === 0 ? "text-slate-300" : importe > 0 ? "text-emerald-600" : "text-slate-900"
                      }`}
                    >
                      {importe === 0 ? "—" : (fila.mediaPorMes[i] ? "≈ " : "") + formatEUR(importe)}
                    </td>
                  ))}
                </tr>
                {abierta &&
                  fila.subfilas.map((hijo) => (
                    <tr key={hijo.categoriaId} className="border-t border-slate-50 text-slate-500">
                      <td className="whitespace-nowrap px-3 py-2 pl-8">{hijo.nombre}</td>
                      {hijo.importesPorMes.map((importe, i) => (
                        <td
                          key={i}
                          className={`whitespace-nowrap px-3 py-2 text-right ${
                            importe === 0 ? "text-slate-300" : importe > 0 ? "text-emerald-600" : "text-slate-700"
                          }`}
                        >
                          {importe === 0 ? "—" : (hijo.mediaPorMes[i] ? "≈ " : "") + formatEUR(importe)}
                        </td>
                      ))}
                    </tr>
                  ))}
              </Fragment>
            );
          })}
          {filas.length === 0 && (
            <tr>
              <td colSpan={mesesLabel.length + 1} className="px-3 py-6 text-center text-slate-400">
                No hay ninguna previsión activa en este horizonte.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
