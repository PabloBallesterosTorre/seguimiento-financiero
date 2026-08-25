"use client";

import { useState } from "react";

export function NuevaDeuda({ action }: { action: (formData: FormData) => void }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Nueva deuda
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">Añadir deuda</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
      <form
        action={async (formData) => {
          await action(formData);
          setAbierto(false);
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-4"
      >
        <div>
          <label className="block text-xs text-slate-500">Tipo</label>
          <input
            name="tipo"
            required
            placeholder="Hipoteca, préstamo, coche…"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Nombre</label>
          <input
            name="nombre"
            required
            placeholder="Hipoteca vivienda habitual"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Capital inicial</label>
          <input
            name="capital_inicial"
            type="number"
            step="0.01"
            min="0"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Capital pendiente actual</label>
          <input
            name="capital_pendiente"
            type="number"
            step="0.01"
            min="0"
            placeholder="Igual al inicial si es nueva"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Cuota</label>
          <input
            name="cuota"
            type="number"
            step="0.01"
            min="0"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Tipo de interés (% anual)</label>
          <input
            name="tipo_interes"
            type="number"
            step="0.001"
            placeholder="3.1"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Modalidad</label>
          <select name="modalidad_interes" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="fijo">Fijo</option>
            <option value="variable">Variable</option>
            <option value="mixto">Mixto</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Fecha inicio</label>
          <input
            name="fecha_inicio"
            type="date"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Fecha fin (opcional)</label>
          <input name="fecha_fin" type="date" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Valor residual (opcional)</label>
          <input
            name="valor_residual"
            type="number"
            step="0.01"
            min="0"
            placeholder="Financiación con pago final"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-4">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Añadir deuda
          </button>
        </div>
      </form>
    </div>
  );
}
