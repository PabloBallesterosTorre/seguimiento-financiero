"use client";

import { useState } from "react";
import { MovimientoForm } from "./MovimientoForm";
import type { CategoriaJerarquica } from "@/lib/categorias";
import type { ReglaCategorizacion } from "@/lib/categorizacion";

type Cuenta = { id: string; nombre: string; banco_nombre: string };

export function NuevoMovimiento({
  action,
  cuentas,
  categorias,
  reglas,
  hoy,
}: {
  action: (formData: FormData) => void;
  cuentas: Cuenta[];
  categorias: CategoriaJerarquica[];
  reglas: ReglaCategorizacion[];
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
        Nuevo movimiento
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">Añadir movimiento</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
      <MovimientoForm
        action={async (formData) => {
          await action(formData);
          setAbierto(false);
        }}
        cuentas={cuentas}
        categorias={categorias}
        reglas={reglas}
        hoy={hoy}
      />
    </div>
  );
}
