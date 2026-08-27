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
    <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-ink-tertiary">Categoría</th>
            {mesesLabel.map((label) => (
              <th key={label} className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold text-ink-tertiary">
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
                  className={`border-t border-border font-semibold text-ink ${
                    tieneHijos ? "cursor-pointer hover:bg-page" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {tieneHijos ? (abierta ? "▾ " : "▸ ") : ""}
                    {fila.nombre}
                  </td>
                  {fila.importesPorMes.map((importe, i) => (
                    <td
                      key={i}
                      className={`whitespace-nowrap px-4 py-2.5 text-right ${
                        importe === 0 ? "text-gridline" : importe > 0 ? "text-success" : "text-ink"
                      }`}
                    >
                      {importe === 0 ? "—" : (fila.mediaPorMes[i] ? "≈ " : "") + formatEUR(importe)}
                    </td>
                  ))}
                </tr>
                {abierta &&
                  fila.subfilas.map((hijo) => (
                    <tr key={hijo.categoriaId} className="border-t border-border text-ink-secondary">
                      <td className="whitespace-nowrap px-4 py-2.5 pl-9">{hijo.nombre}</td>
                      {hijo.importesPorMes.map((importe, i) => (
                        <td
                          key={i}
                          className={`whitespace-nowrap px-4 py-2.5 text-right ${
                            importe === 0 ? "text-gridline" : importe > 0 ? "text-success" : "text-ink-secondary"
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
              <td colSpan={mesesLabel.length + 1} className="px-4 py-6 text-center text-ink-tertiary">
                No hay ninguna previsión activa en este horizonte.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
