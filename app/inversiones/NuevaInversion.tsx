"use client";

import { useState } from "react";

export function NuevaInversion({ action }: { action: (formData: FormData) => void }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Nueva inversión
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">Añadir inversión</h2>
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
          <label className="block text-xs text-slate-500">Tipo de activo</label>
          <input
            name="tipo_activo"
            required
            placeholder="fondo_indexado, acciones, cripto…"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Nombre</label>
          <input
            name="nombre"
            required
            placeholder="MSCI World (Vanguard)"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Valor actual</label>
          <input
            name="valor_actual"
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Añadir inversión
          </button>
        </div>
      </form>
    </div>
  );
}
