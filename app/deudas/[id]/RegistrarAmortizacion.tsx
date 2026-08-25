"use client";

import { useState } from "react";

export function RegistrarAmortizacion({
  action,
  deudaId,
  hoy,
}: {
  action: (formData: FormData) => void;
  deudaId: string;
  hoy: string;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Registrar amortización
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">Registrar amortización</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
      <p className="text-xs text-slate-400">
        Elige la fecha libremente: si es hoy o pasada se aplica al capital pendiente al guardar; si es
        futura, queda como plan pendiente hasta que la marques como aplicada.
      </p>
      <form
        action={async (formData) => {
          await action(formData);
          setAbierto(false);
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-4"
      >
        <input type="hidden" name="deuda_id" value={deudaId} />
        <div>
          <label className="block text-xs text-slate-500">Fecha</label>
          <input
            name="fecha"
            type="date"
            required
            defaultValue={hoy}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Importe</label>
          <input
            name="importe"
            type="number"
            step="0.01"
            min="0"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Efecto</label>
          <select name="tipo_reduccion" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="reducir_plazo">Reducir plazo</option>
            <option value="reducir_cuota">Reducir cuota</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Etiqueta (informativa)</label>
          <select name="recurrencia" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="puntual">Puntual</option>
            <option value="mensual">Parte de un plan mensual</option>
            <option value="anual">Parte de un plan anual</option>
          </select>
        </div>
        <div className="sm:col-span-4">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Registrar
          </button>
        </div>
      </form>
    </div>
  );
}
