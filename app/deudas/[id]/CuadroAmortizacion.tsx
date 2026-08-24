"use client";

import { Fragment, useState } from "react";
import type { FilaAmortizacion } from "@/lib/amortizacion";

const formatEUR = (v: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v);

// Primeros 12 meses siempre expandidos; a partir de ahí, una fila resumen por año
// (intereses, amortizado y pendiente a cierre) que se puede desplegar de forma
// independiente para ver el detalle mes a mes de ese año concreto.
export function CuadroAmortizacion({ filas }: { filas: FilaAmortizacion[] }) {
  const [aniosAbiertos, setAniosAbiertos] = useState<Set<number>>(new Set());

  const primeros12 = filas.filter((f) => f.mes <= 12);
  const resto = filas.filter((f) => f.mes > 12);

  const grupos = new Map<number, FilaAmortizacion[]>();
  for (const fila of resto) {
    const anio = Math.floor((fila.mes - 1) / 12) + 1;
    if (!grupos.has(anio)) grupos.set(anio, []);
    grupos.get(anio)!.push(fila);
  }

  function toggleAnio(anio: number) {
    setAniosAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(anio)) next.delete(anio);
      else next.add(anio);
      return next;
    });
  }

  return (
    <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-md border border-slate-100">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Mes</th>
            <th className="px-3 py-2 font-medium text-right">Interés</th>
            <th className="px-3 py-2 font-medium text-right">Amortizado</th>
            <th className="px-3 py-2 font-medium text-right">Pendiente</th>
          </tr>
        </thead>
        <tbody>
          {primeros12.map((f) => (
            <tr key={f.mes} className="border-t border-slate-100">
              <td className="px-3 py-2 text-slate-500">{f.mes}</td>
              <td className="px-3 py-2 text-right">{formatEUR(f.interes)}</td>
              <td className="px-3 py-2 text-right">{formatEUR(f.principal)}</td>
              <td className="px-3 py-2 text-right">{formatEUR(f.saldo)}</td>
            </tr>
          ))}

          {Array.from(grupos.entries()).map(([anio, filasAnio]) => {
            const abierto = aniosAbiertos.has(anio);
            const interesAnio = filasAnio.reduce((sum, f) => sum + f.interes, 0);
            const principalAnio = filasAnio.reduce((sum, f) => sum + f.principal, 0);
            const saldoCierre = filasAnio[filasAnio.length - 1].saldo;

            return (
              <Fragment key={anio}>
                <tr
                  onClick={() => toggleAnio(anio)}
                  className="cursor-pointer border-t border-slate-200 bg-slate-50 font-medium hover:bg-slate-100"
                >
                  <td className="px-3 py-2 text-slate-700">
                    {abierto ? "▾" : "▸"} Año {anio}
                  </td>
                  <td className="px-3 py-2 text-right">{formatEUR(interesAnio)}</td>
                  <td className="px-3 py-2 text-right">{formatEUR(principalAnio)}</td>
                  <td className="px-3 py-2 text-right">{formatEUR(saldoCierre)}</td>
                </tr>
                {abierto &&
                  filasAnio.map((f) => (
                    <tr key={f.mes} className="border-t border-slate-100 text-slate-500">
                      <td className="px-3 py-2 pl-8">{f.mes}</td>
                      <td className="px-3 py-2 text-right">{formatEUR(f.interes)}</td>
                      <td className="px-3 py-2 text-right">{formatEUR(f.principal)}</td>
                      <td className="px-3 py-2 text-right">{formatEUR(f.saldo)}</td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
