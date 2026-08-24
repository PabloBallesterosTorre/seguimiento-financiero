"use client";

import { useMemo, useState } from "react";
import { simularAmortizacionExtra, type Recurrencia, type TipoReduccion } from "@/lib/amortizacion";

const formatEUR = (v: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v);

export function SimuladorAmortizacion({
  capitalPendiente,
  tasaAnual,
  cuotaActual,
  valorResidual,
}: {
  capitalPendiente: number;
  tasaAnual: number;
  cuotaActual: number;
  valorResidual: number;
}) {
  const [importe, setImporte] = useState(1000);
  const [recurrencia, setRecurrencia] = useState<Recurrencia>("puntual");
  const [tipoReduccion, setTipoReduccion] = useState<TipoReduccion>("reducir_plazo");

  const efectoAplicado: TipoReduccion = recurrencia === "puntual" ? tipoReduccion : "reducir_plazo";

  const resultado = useMemo(() => {
    if (importe <= 0) return null;
    return simularAmortizacionExtra({
      saldoActual: capitalPendiente,
      tasaAnual,
      cuotaActual,
      valorResidual,
      importeExtra: importe,
      recurrencia,
      tipoReduccion: efectoAplicado,
    });
  }, [importe, recurrencia, efectoAplicado, capitalPendiente, tasaAnual, cuotaActual, valorResidual]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-slate-700">Simulador de amortización anticipada</h2>
        <p className="text-xs text-slate-400">
          Solo de consulta — prueba escenarios libremente, nada se guarda aquí. Para registrar una
          amortización real, hazlo desde el detalle de la deuda.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-slate-500">Importe extra</label>
          <input
            type="number"
            min="0"
            step="10"
            value={importe}
            onChange={(e) => setImporte(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Recurrencia</label>
          <select
            value={recurrencia}
            onChange={(e) => setRecurrencia(e.target.value as Recurrencia)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="puntual">Puntual (un pago ahora)</option>
            <option value="mensual">Recurrente cada mes</option>
            <option value="anual">Recurrente cada año</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">
            Efecto {recurrencia !== "puntual" && <span className="text-slate-400">(fijo en recurrentes)</span>}
          </label>
          <select
            value={efectoAplicado}
            onChange={(e) => setTipoReduccion(e.target.value as TipoReduccion)}
            disabled={recurrencia !== "puntual"}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="reducir_plazo">Reducir plazo (misma cuota)</option>
            <option value="reducir_cuota">Reducir cuota (mismo plazo)</option>
          </select>
        </div>
      </div>

      {resultado && (
        <div className="grid grid-cols-2 gap-4 rounded-md bg-slate-50 p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Meses restantes</p>
            <p className="text-sm font-medium">
              {resultado.despues.mesesRestantes}{" "}
              <span className="text-slate-400">(antes {resultado.antes.mesesRestantes})</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Intereses totales</p>
            <p className="text-sm font-medium">{formatEUR(resultado.despues.interesesTotales)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Ahorro en intereses</p>
            <p className="text-sm font-medium text-emerald-600">{formatEUR(resultado.ahorroIntereses)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{resultado.cuotaNueva ? "Nueva cuota" : "Meses ahorrados"}</p>
            <p className="text-sm font-medium">
              {resultado.cuotaNueva ? formatEUR(resultado.cuotaNueva) : resultado.mesesAhorrados}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
