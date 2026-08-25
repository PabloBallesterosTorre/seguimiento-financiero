"use client";

import { useState } from "react";
import { MovimientoPrevistoForm } from "./MovimientoPrevistoForm";
import type { CategoriaJerarquica } from "@/lib/categorias";

type Cuenta = { id: string; nombre: string; banco_nombre: string };

export function NuevoPrevisto({
  action,
  categorias,
  cuentas,
  hoy,
}: {
  action: (formData: FormData) => void;
  categorias: CategoriaJerarquica[];
  cuentas: Cuenta[];
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
        Nueva previsión
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">Añadir previsión</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
      <MovimientoPrevistoForm
        action={async (formData) => {
          await action(formData);
          setAbierto(false);
        }}
        categorias={categorias}
        cuentas={cuentas}
        hoy={hoy}
      />
    </div>
  );
}
