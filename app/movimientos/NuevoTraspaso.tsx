"use client";

import { useState } from "react";

type Cuenta = { id: string; nombre: string; banco_nombre: string };

export function NuevoTraspaso({
  cuentas,
  action,
  hoy,
}: {
  cuentas: Cuenta[];
  action: (formData: FormData) => void;
  hoy: string;
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Nuevo traspaso
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-medium text-slate-700">Nuevo traspaso entre cuentas</h2>
      <form
        action={async (formData) => {
          await action(formData);
          setAbierto(false);
        }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-5"
      >
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
          <label className="block text-xs text-slate-500">Cuenta origen</label>
          <select
            name="cuenta_origen_id"
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.banco_nombre} — {cuenta.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Cuenta destino</label>
          <select
            name="cuenta_destino_id"
            required
            defaultValue={cuentas[1]?.id ?? cuentas[0]?.id}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {cuenta.banco_nombre} — {cuenta.nombre}
              </option>
            ))}
          </select>
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
          <label className="block text-xs text-slate-500">Descripción (opcional)</label>
          <input
            name="descripcion"
            placeholder="Se autogenera si se deja vacío"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-3 sm:col-span-5">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Registrar traspaso
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
