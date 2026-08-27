"use client";

import { useState } from "react";
import { MovimientoForm } from "./MovimientoForm";
import type { CategoriaJerarquica } from "@/lib/categorias";
import type { ReglaCategorizacion } from "@/lib/categorizacion";
import { btnPrimaryClass, cardClass } from "@/components/formStyles";

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
      <button type="button" onClick={() => setAbierto(true)} className={btnPrimaryClass}>
        + Nuevo movimiento
      </button>
    );
  }

  return (
    <div className={cardClass}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-sora text-base font-semibold text-ink">Añadir movimiento</h2>
        <button type="button" onClick={() => setAbierto(false)} className="text-[13px] font-semibold text-ink-tertiary hover:text-ink">
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
